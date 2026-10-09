# Tasks — User Story Status Toggle

## 1. Frontend (UserStories.tsx)

- [x] 1.1 Extraer/agregar el helper `canManageStory(story, session, projects)` (ADMIN, o PO/SM en el proyecto de la historia; fail-closed sin datos) y reutilizarlo en `canDeleteStory`
- [x] 1.2 Agregar el handler `handleToggleStatus(story, status)`: `PUT` vía el patrón `fetch` del archivo, `loadStories()` al éxito, `setError(...)` con mensaje específico de `403` y `body.error` al fallo
- [x] 1.3 Renderizar en cada tarjeta de historia el `<select>` de estado (`BACKLOG`/`COMPLETED`) gated por `canManageStory`, normalizando estados no-`COMPLETED` a `BACKLOG`

## 2. Test de integración del contrato de API

- [x] 2.1 Crear `src/server/routes/user-stories-status.test.ts` (vitest + `fetch` nativo + `vi.mock("../db")` y `vi.mock("../lib/notify")` + `JWT_SECRET` en hoisted; router real montado en `app.listen(0)`) con mocks de `user`, `projectMember` y `userStory` (`findUnique`, `update`)
- [x] 2.2 Casos de autorización: 401 sin token, 403 dev, 403 no-miembro, 200 PO, 200 SM, 200 ADMIN (bypass), 400 si la historia no existe
- [x] 2.3 Casos de efecto: `COMPLETED` setea `completedAt` (Date) y `BACKLOG` lo limpia (`null`); 500 si `update` falla

## 3. Verificación

- [x] 3.1 `npm run lint` (biome) y `tsc` limpios (solo los errores preexistentes)
- [x] 3.2 Suite `npm run test` verde (existentes + nuevos)
- [x] 3.3 Prueba manual: como PO/SM, cambiar una HU a "Completada" → badge/selector reflejan `COMPLETED` y en DB `user_stories.status = 'COMPLETED'` con `completedAt` no nulo
- [x] 3.4 Prueba manual: volver la HU a "Backlog" → estado `BACKLOG` y `completedAt` en `null`
- [x] 3.5 Prueba manual: como Ana (dev1) no se ve el selector de estado
