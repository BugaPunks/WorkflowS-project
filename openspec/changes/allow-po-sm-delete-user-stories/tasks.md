## 1. Backend — autorización del DELETE

- [x] 1.1 En `src/server/routes/user-stories.ts`, reemplazar el middleware del `DELETE /:id`: `requireSystemRole("ADMIN")` → `requireProjectRole(["PRODUCT_OWNER", "SCRUM_MASTER"], <resolver async que busca la historia por `req.params.id` y devuelve `projectId ?? null`>)`, copiando el resolver del `PUT`, y actualizar el comentario `// DELETE user story - ADMIN only` a PO/SM/ADMIN

## 2. Frontend — visibilidad del botón y errores

- [x] 2.1 En `src/pages/UserStories.tsx`, extender `interface Project` con `members: { userId: string; role: string }[]` (verificar que `GET /api/projects` ya lo envía)
- [x] 2.2 Agregar helper `canDeleteStory(story, session, projects)`: true si `session.role === "ADMIN"` o la membresía de `session.id` en el proyecto de la historia es `PRODUCT_OWNER`/`SCRUM_MASTER`; false si `projects` no está cargado (fail-closed)
- [x] 2.3 Renderizar el botón "Eliminar" de la tarjeta solo cuando `canDeleteStory(...)` sea true
- [x] 2.4 En `handleDeleteStory`, mostrar el error real de la API (distinguir 403 "sin permiso" y mensaje del cuerpo de la respuesta) en lugar del genérico "Error al eliminar historia"

## 3. Verificación

- [x] 3.1 `npx biome check` sobre los 2 archivos modificados + `npx tsc --noEmit` sin errores nuevos
- [x] 3.2 `npm run test` — todos los tests pasan
- [ ] 3.3 Prueba manual: como PO eliminar una HU → funciona (antes 403); como SM también
- [ ] 3.4 Prueba manual: como developer (dev1/dev2) la tarjeta NO muestra "Eliminar"; como admin sí aparece y funciona
- [ ] 3.5 Verificar en la DB que la HU borrada desapareció de `user_stories`
