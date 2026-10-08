# Design — Remove Story From Sprint

## Context

El sistema actual solo permite **asignar** historias a sprints (`POST /api/sprints/:id/add-story` + drag & drop Backlog → Sprint en `ProjectDetail.tsx`). No existe operación inversa: `onDragEnd` solo maneja `source.droppableId === "backlog"`, no hay endpoint de desasignación, y el schema de `PUT /api/user-stories/:id` no incluye `sprintId`. La DB sí lo soporta: `UserStory.sprintId` es opcional y anulable (`sprintId String?`, sin `onDelete` restrictivo).

Rol de referencia: `POST /:id/add-story` usa `requireProjectRole(["SCRUM_MASTER", "PRODUCT_OWNER"])` con el resolver por defecto (`req.params.id`), y el middleware project-rbac aplica bypass para `ADMIN`.

## Goals / Non-Goals

**Goals:**
- Endpoint de desasignación de historia ↔ sprint, con autorización idéntica a `add-story`
- Drag & drop inverso Sprint → Backlog en la UI con el mismo patrón de experiencia (optimista + reload en error) que el movimiento actual
- La historia vuelve a backlog (`sprintId = null`) y aparece en la sección Backlog

**Non-Goals:**
- Reordenar HU dentro de un sprint (scope futuro)
- Mover una HU directamente entre sprints (se hace quitando y agregando)
- Cambios de schema en DB
- Cambiar permisos existentes de `add-story`

## Decisions

### 1. Endpoint `DELETE /api/sprints/:id/stories/:storyId`
Espacio de ruta consistente con `POST /sprints/:id/add-story`. Alternativa considerada: `PUT /api/user-stories/:id` con `sprintId` en el body — **descartada** porque cambia el contrato del resource de user-story, obliga a ampliar su schema de validación y el endpoint correría bajo la autorización de stories, no de sprints.

Autorización: `requireProjectRole(["SCRUM_MASTER", "PRODUCT_OWNER"])` con resolver por defecto (lee `req.params.id` = sprintId) → valida membresía PO/SM en el proyecto del sprint; `ADMIN` bypass (igual que add-story).

Validación de pertenencia: el handler verifica que la story exista **y** que `story.sprintId === sprintId`; si no, `404` (la historia no pertenece a ese sprint). Luego `prisma.userStory.update({ data: { sprintId: null } })` y responde con la historia actualizada.

### 2. Drag & drop inverso en `onDragEnd`
Extender el handler existente con el caso `source.droppableId.startsWith("sprint-") && destination.droppableId === "backlog"`:
1. Actualización optimista: sacar la HU del array `userStories` del sprint y agregarla a `backlogStories`
2. `fetch DELETE /api/sprints/${sprintId}/stories/${storyId}`
3. En error: `alert(data.error)` + `loadProject()` (rollback real por recarga, mismo patrón que add-story); en éxito: `loadProject()` para IDs reales

Se reutiliza `loadProject()` que ya reconstruye backlog y sprints a partir de `project.userStories.sprintId` (líneas ~737-744).

### 3. Mantener invariante de unicidad
Cada story pertenece a un único sprint a la vez: `add-story` ya responde `400` si la story ya estaba asignada a ese sprint (líneas ~193-197 de `sprints.ts`), y `remove-story` solo actúa sobre una story cuyo `sprintId === sprintId`. No hay riesgo de doble pertenencia.

### 4. Test de integración sin dependencias nuevas
El proyecto no tiene infraestructura de tests de API (los 35 tests existentes cubren solo funciones puras: CSV, métricas, rate-limit) y no hay `supertest` instalado. Para el **primer test de integración** de la `change` se usa:
- **`vi.mock("../db")`** con el mock de `prisma` hoisteado: se aíslan exactamente las consultas que toca la ruta (`user.findUnique`, `sprint.findUnique`, `projectMember.findUnique`, `userStory.findUnique`, `userStory.update`) — **sin tocar `dev.db`**
- **Middlewares reales**: `authenticateToken` (verifica JWT `HS256`, issuer/audience reales y `tokenVersion`) y `requireProjectRole` (chequea membresía y bypass ADMIN) — la autorización se prueba de verdad, no se mookea
- **Transacciones con `fetch` nativo** (Node 24) sobre `app.listen(0)` (puerto efímero), montando solo el router de sprints con `express.json()` (sin CSRF/rate-limit, no aplican vía Authorization header sin Origin)

Se firman tokens reales con `jsonwebtoken` usando `JWT_SECRET` definido dentro del test (el import de `auth.ts` lo exige). Cobertura: 401 sin token, 403 dev/no-miembro, 200 PO/SM/ADMIN-bypass, 400 sprint inexistente, 404 historia no encontrada, 404 pertenencia incorrecta, y verificación de que `userStory.update` se invoca con `data: { sprintId: null }`.

## Risks / Trade-offs

- [Doble click / arrastres rápidos duplican peticiones] → Mitigación: recarga tras cada resultado normaliza el estado; el endpoint es idempotente en efecto (poner `sprintId = null` cuando ya es null devuelve 404 por el chequeo de pertenencia, sin corrupción)
- [Drag accidental desde el sprint que no termina con destino válido] → El branch solo dispara con destino `backlog`; cualquier otro destino no hace nada (igual que hoy)
- [404 del backend confundido con "no existe el URL"] → El handler responde `{ error: "La historia no pertenece a este sprint" }` y la UI muestra el mensaje con `alert`

## Migration Plan

- Sin migración de datos: cambio aditivo en API y frontend
- Rollback: revertir los 2 archivos (`sprints.ts`, `ProjectDetail.tsx`); no hay dato que migrar

## Open Questions

- Ninguna (el patrón replicado es el vigente de add-story)