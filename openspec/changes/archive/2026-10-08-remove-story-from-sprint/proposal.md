# Remove Story From Sprint

## Why

No existe ninguna manera de quitar una historia de usuario de un sprint una vez asignada: el drag & drop del `ProjectDetail.tsx` solo acepta movimientos Backlog → Sprint (`onDragEnd` solo maneja `source.droppableId === "backlog"`), la API solo expone `POST /sprints/:id/add-story`, y `PUT /api/user-stories/:id` no acepta `sprintId`. La única alternativa actual es que un ADMIN borre el sprint entero (`DELETE /sprints/:id`, rol ADMIN) — solución destructiva y desproporcionada para un error de planificación normal (HU arrastrada al sprint equivocado, repriorización del PO, etc.).

## What Changes

- Agregar endpoint **`DELETE /api/sprints/:id/stories/:storyId`** que quita la historia del sprint (pone `sprintId` en `null` y devuelve la historia en backlog), con la misma autorización que `POST /:id/add-story`: `SCRUM_MASTER` o `PRODUCT_OWNER` del proyecto del sprint (bypass ADMIN). Verificar que la historia pertenezca realmente a ese sprint (404 si no).
- Habilitar el **drag & drop inverso** en `ProjectDetail.tsx`: arrastrar una HU desde el `userStories` de un sprint hacia el droppable `backlog` la devuelve al backlog, con la misma experiencia optimista + rollback (recargar en error) que el movimiento actual.
- Refrescar el estado local (Backlog + sprint) tras el movimiento, igual que ya hace `add-story`.

## Capabilities

### New Capabilities
- `sprint-story-assignment`: cubre asignar y desasignar historias de usuario a sprints (moverlas dentro/fuera del backlog), incluyendo autorización, comportamiento del drag & drop y estados de error.

### Modified Capabilities
<!-- Ninguna: user-story-management no cambia requisitos; esto es una capacidad nueva. -->

## Impact

- `src/server/routes/sprints.ts`: nuevo `router.delete("/:id/stories/:storyId", ...)` con `requireProjectRole` y resolver por `req.params.id`
- `src/pages/ProjectDetail.tsx`: extender el handler de drag & drop (`onDragEnd`) para el caso sprint → backlog y el estado de intro de `backlogStories`
- `src/server/routes/sprints-remove-story.test.ts` (nuevo): primer test de integración del proyecto (vitest + `fetch` nativo + `vi.mock("../db")`), cubriendo autorización y handler — sin dependencias nuevas
- Ningún cambio de schema: `UserStory.sprintId` ya es anulable (`sprintId String?`)
- Sin cambios en pruebas existentes; suma los tests nuevos del grupo 3