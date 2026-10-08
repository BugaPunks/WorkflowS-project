## 1. Backend — endpoint de desasignación

- [x] 1.1 En `src/server/routes/sprints.ts`, agregar `router.delete("/:id/stories/:storyId", authenticateToken, ...)` con `requireProjectRole(["SCRUM_MASTER", "PRODUCT_OWNER"], <resolver async copiado del add-story que busca el sprint por `req.params.id` y devuelve `projectId ?? null`>)` — comentario `// DELETE quitar historia de un sprint - SCRUM_MASTER, PRODUCT_OWNER`
- [x] 1.2 En el handler: validar que `storyId` exista y que `userStory.sprintId === sprintId`; si no existe → `404 { error: "Historia no encontrada" }`; si `sprintId` no coincide → `404 { error: "La historia no pertenece a este sprint" }`; si no es ese sprint → devolver la historia sin modificar
- [x] 1.3 En éxito: `prisma.userStory.update({ where: { id: storyId }, data: { sprintId: null } })` y responder `res.json({ data: updatedStory })`; envolver en try/catch → `500 { error: "Error al quitar historia del sprint" }`

## 2. Frontend — drag & drop inverso

- [x] 2.1 En `src/pages/ProjectDetail.tsx`, extender `onDragEnd`: nuevo branch `source.droppableId.startsWith("sprint-") && destination.droppableId === "backlog"`, reutilizando `draggableId`, `storyToMove` desde `sprints[].userStories` y `setSprints(...)`/`setBacklogStories(...)` para la actualización local
- [x] 2.2 Llamar `fetch(DELETE /api/sprints/${sprintId}/stories/${storyId})`; en `!response.ok` → `alert(data.error)` + `loadProject()`; en éxito → `loadProject()` (patrón idéntico al branch backlog→sprint existente)
- [x] 2.3 Verificar que ninguna otra condición del `onDragEnd` actual se solape (el branch existente sigue `source.droppableId === "backlog"` sin cambios)
- [x] 2.4 Descubierto en prueba manual: envolver las HU dentro del sprint en `<Draggable>` (ref + `draggableProps` + `dragHandleProps` + `cursor-grab`, patrón del backlog) — sin esto no se puede ni iniciar el drag desde el sprint

## 3. Tests automatizados (primer test de integración del proyecto)

- [x] 3.1 Crear `src/server/routes/sprints-remove-story.test.ts` con vitest: montar `sprintsRouter` real sobre una app express mínima (`express.json()`), `app.listen(0)` + `fetch` nativo (sin supertest, sin dependencias nuevas), `vi.mock("../db")` con el mock de `prisma` hoisteado y `JWT_SECRET` definido antes de importar el router (el middleware real lo exige)
- [x] 3.2 Token real con `jsonwebtoken` (payload `{ userId, email, role, v }`, issuer/audience del auth real) y casos de **autorización**: 401 sin token · 403 con membresía `TEAM_DEVELOPER` · 403 sin membresía · 200 con `PRODUCT_OWNER` · 200 con `SCRUM_MASTER` · 200 con `ADMIN` (bypass, sin membresía) · 400 "projectId required" si el sprint no existe
- [x] 3.3 Casos del **handler**: 404 historia inexistente (sin llamar a `update`) · 404 `sprintId` que no coincide · 200 verificando que `prisma.userStory.update` se llamó con `data: { sprintId: null }` y que la respuesta incluye la historia

## 4. Verificación

- [x] 4.1 `npx biome check` sobre los 2 archivos modificados + el test nuevo + `npx tsc --noEmit` sin errores nuevos
- [x] 4.2 `npm run test` — pasan los 35 existentes + los nuevos del grupo 3
- [x] 4.3 Prueba manual: como SM, arrastrar una HU del Sprint 1 de vuelta al Backlog → desaparece del sprint, vuelve al backlog, y recargar mantiene el estado
- [x] 4.4 Prueba manual: como PO, lo mismo funciona; y verificar en la DB que `user_stories.sprintId` quedó en `null` para esa HU
- [x] 4.5 Prueba manual en tiempo real: como dev (Ana) el `DELETE` directo responde 403; como admin funciona aunque no sea miembro del proyecto