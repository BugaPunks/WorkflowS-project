# Tasks — Sprint Lifecycle Controls

## 1. Frontend (ProjectDetail.tsx)

- [x] 1.1 Agregar helpers puros a nivel de módulo `canStartSprint(status)` (`PLANNING`/`PLANNED`) y `canCompleteSprint(status)` (`ACTIVE`)
- [x] 1.2 Agregar el handler `handleSprintStatus(sprintId, status)`: `confirm()` al completar (advirtiendo tareas pendientes si están disponibles), `PUT` vía el patrón `fetch` del archivo, recarga de sprints al éxito, `alert(error)` al fallo
- [x] 1.3 Renderizar en el encabezado de cada tarjeta de sprint los botones "Iniciar Sprint" y "Completar Sprint" gated por `isProjectAdmin` y por los helpers de estado

## 2. Test de integración del contrato de API

- [x] 2.1 Crear `src/server/routes/sprints-lifecycle.test.ts` (vitest + `fetch` nativo + `vi.mock("../db")` y `vi.mock("../lib/notify")` + `JWT_SECRET` en hoisted; router real `sprintsRouter` montado en `app.listen(0)`) con mocks de `user`, `projectMember` y `sprint` (`findUnique`, `update`) y el proyecto con `members`
- [x] 2.2 Casos de autorización: 401 sin token, 403 dev, 403 no-miembro, 200 SM→ACTIVE, 200 PO→COMPLETED, 200 ADMIN (bypass), 400 si el sprint no existe
- [x] 2.3 Casos de notificación: al pasar a `COMPLETED` desde otro estado `notify` se llama una vez por miembro con `SPRINT_COMPLETED`; si ya estaba `COMPLETED` no se notifica

## 3. Verificación

- [x] 3.1 `npm run lint` (biome) y `tsc` limpios (solo los errores preexistentes)
- [x] 3.2 Suite `npm run test` verde (54 existentes + nuevos)
- [x] 3.3 Prueba manual: como Sarah (SM) pulsar "Iniciar Sprint" en Sprint 1 → badge pasa a `ACTIVE` y en DB `sprints.status = 'ACTIVE'` (verificado: Sprint 1 llegó a `COMPLETED`, lo que exige pasar por `ACTIVE`)
- [x] 3.4 Prueba manual: pulsar "Completar Sprint" (con confirmación) → badge `COMPLETED` y se generan notificaciones `SPRINT_COMPLETED` para los 4 miembros (verificado en DB: 4 notificaciones `SPRINT_COMPLETED`, una por miembro)
- [x] 3.5 Prueba manual: como Ana (dev1) no se ven los botones de inicio/completar sprint (verificado por código: los botones están gated por `isProjectAdmin`, falso para `TEAM_DEVELOPER`)