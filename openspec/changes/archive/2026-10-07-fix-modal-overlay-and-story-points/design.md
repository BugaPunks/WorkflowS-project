## Context

El proyecto usa **Tailwind CSS v4** (`tailwindcss ^4.1.17` + `@tailwindcss/postcss`), donde las utilidades `bg-opacity-*`, `text-opacity-*` y `border-opacity-*` fueron **eliminadas** a favor de la sintaxis de modificador de opacidad (`bg-black/50`).

Estado actual:
- `src/components/Modal.tsx` es el modal compartido (overlay `bg-gray-900/60 backdrop-blur-sm`, cierre con ESC y clic, header con ✕) — usado por `UserStories.tsx`, `UserManagement.tsx`, `Projects.tsx`, etc.
- `src/pages/ProjectDetail.tsx` tiene **2 modales inline** que NO usan el componente compartido:
  - Línea ~582: modal "Añadir Miembro" → `fixed inset-0 bg-black bg-opacity-50 ...`
  - Línea ~1201: modal "Nuevo Sprint" → misma clase
  - Con Tailwind v4, `bg-opacity-50` es una clase muerta (no-op), por lo que queda `bg-black` **opaco** → el fondo se ve negro sólido.
- `src/pages/UserStories.tsx`: el modal de creación no tiene campo `storyPoints` (formData: title, description, acceptance, priority, projectId) → la DB guarda `NULL`.
- Backend `POST /api/user-stories` **ya acepta** `storyPoints` (zod schema, líneas 92-103 de `src/server/routes/user-stories.ts`) — sin cambios necesarios.
- `src/pages/ProjectDetail.tsx` ya muestra `storyPoints` en sus tarjetas si no es null (líneas ~1074, ~1178).

Stakeholders: docente (ADMIN) que creó el proyecto, PO/SM que crean historias y sprints, developers que ven el tablero.

## Goals / Non-Goals

**Goals:**
- Eliminar el fondo negro opaco de los modales de `ProjectDetail.tsx` (Añadir Miembro y Nuevo Sprint).
- Unificar ambos modales en el componente `<Modal>` compartido (consistencia de UX: ESC, clic fuera, header, scroll).
- Permitir ingresar Story Points al crear una historia de usuario y mostrarlos en la tarjeta.
- Verificación con lint (`npm run check`) y tests (`npm run test`).

**Non-Goals:**
- Cambios de backend o migraciones de base de datos (el API ya soporta `storyPoints`).
- Editar/estimar historias existentes (no hay UI de edición; fuera de alcance).
- Revisar otros aspectos del flujo Scrum (tablero, sprint, evaluaciones).
- Corregir la discrepancia de permisos `PRODUCT_OWNER` vs `ADMIN` en la creación de proyectos (hallazgo aparte, anotado para futuro).

## Decisions

### D1 — Migrar al `<Modal>` compartido en vez de solo cambiar la clase (Opción B elegida)
- **Alternativa descartada (Opción A):** cambiar `bg-black bg-opacity-50` → `bg-black/50` (2 caracteres). Arregla el síntoma pero mantiene 2 implementaciones de modal paralelas, sin cierre con ESC ni clic fuera, y sin header/scroll consistentes.
- **Decisión:** mover el contenido de cada formulario dentro de `<Modal>`; la lógica (`handleAddMember`, `handleCreateSprint`, estados `selectedUser`, `sprintForm`) **no se toca**. Se elimina el `<div>` overlay inline y el padding interno redundante (`Modal` ya aplica `p-6` al contenido).

### D2 — Story Points como input numérico opcional
- Input `type="number"` con `min={0}` `max={99}` `step={1}` junto al selector de Prioridad.
- En `formData` se maneja como string (`""` = vacío) y se convierte a `number` solo si no está vacío al enviar; se envía el campo **solo cuando tiene valor** para no pisar el default `null` de Prisma.
- Validación con HTML5 (`required` NO se aplica — el campo es opcional) + saneamiento `Number.parseInt` con clamp a rango.
- **Alternativa descartada:** select con Fibonacci (1,2,3,5,8,13) — más "Scrum", pero menos flexible y requiere más UI; se deja como posible mejora futura.

### D3 — Badge de puntos solo si existe
- En `UserStories.tsx` la tarjeta muestra `N pts` **solo si** `storyPoints != null`, replicando el patrón ya existente en `ProjectDetail.tsx` (consistencia visual).
- Se agrega `storyPoints?: number | null` al `interface UserStory` local.

### D4 — Sin cambios de API
El endpoint y el schema zod ya existen; el frontend solo pasa a enviar un campo que el backend ya valida. Reduce el riesgo a cero en el lado servidor.

## Risks / Trade-offs

- [El contenido de los formularios hereda el `p-6` del `Modal`, causando doble padding] → Quitar el `p-6`/padding propio del div interno al migrar; verificar visualmente.
- [Clic en overlay o ESC cierra el modal y pierde lo tipeado] → Comportamiento ya aceptado en todos los demás modales de la app; consistencia > protección extra (no hay datos críticos en estos formularios).
- [Conflicto de z-index con el tablero Kanban (DragDropContext)] → Ambos usan `z-50`; el `Modal` compartido ya funciona sobre otras páginas; verificar al abrir "Nuevo Sprint" desde el tablero.
- [Romper el submit del formulario al anidarlo en `Modal`] → `Modal` renderiza `children` dentro de un `<div>`, no intercepta eventos; el `onSubmit` del `<form>` sigue funcionando. Verificación manual en tests.
- [Tailwind purga clases no detectadas dinámicamente] → Las clases nuevas son literales en el JSX; sin riesgo de purge.
- [Story Points fuera de rango o negativos] → `min/max` en el input + clamp numérico antes de enviar.

## Migration Plan

1. Sin migración de DB ni despliegue especial — es un cambio de frontend puro con HMR en desarrollo.
2. Orden: Tarea 1 (modales) → Tarea 2 (story points) → Tarea 3 (verificación lint/tests) → Tarea 4 (prueba manual).
3. **Rollback:** `git revert` del commit (no hay datos persistentes involucrados).

## Open Questions

- ¿Se desea estimación de historias ya existentes (UI de edición)? Fuera de alcance por ahora; posible cambio futuro.
