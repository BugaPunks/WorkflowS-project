# Tasks — Allow PO/SM to Delete Tasks

## 1. Backend

- [x] 1.1 Reemplazar en `src/server/routes/tasks.ts` el middleware del `DELETE /:id`: `requireSystemRole("ADMIN")` → `requireProjectRole(["PRODUCT_OWNER", "SCRUM_MASTER"], async (req) => { const task = await prisma.task.findUnique({ where: { id: req.params.id } }); return task?.projectId ?? null; })` y actualizar el comentario del endpoint
- [x] 1.2 Verificar imports: mantener `requireSystemRole` (lo sigue usando `POST /:id/evaluate`)

## 2. Frontend

- [x] 2.1 En `src/pages/Tasks.tsx`, extender `interface Project` con `members: { userId: string; role: string }[]`
- [x] 2.2 Agregar helper puro `canDeleteTask(task, session, projects)` a nivel de módulo (fail-closed: `false` si no hay sesión o si el proyecto no aparece en `projects`; `true` para ADMIN; `true` si la membresía del usuario en el proyecto de la tarea es `PRODUCT_OWNER` o `SCRUM_MASTER`)
- [x] 2.3 Envolver el botón "×" de la tarjeta con `{canDeleteTask(task, user, projects) && (...)}`
- [x] 2.4 En `handleDeleteTask`, distinguir `403` ("No tienes permiso para eliminar esta tarea") y leer `body.error` del JSON en otros errores, con fallback al mensaje genérico

## 3. Tests de integración

- [x] 3.1 Crear `src/server/routes/tasks-remove.test.ts` (vitest + `fetch` nativo + `vi.mock("../db")` + `JWT_SECRET` en hoisted; router real `tasksRouter` con `express.json()` montado en un app con `listen(0)`) con mocks de `user`, `projectMember` y `task` (`findUnique`, `delete`)
- [x] 3.2 Casos positivos y de permisos: 200 PO, 200 SM, 200 ADMIN (bypass sin membresía), 403 dev, 403 no miembro, 401 sin token
- [x] 3.3 Casos del handler: tarea inexistente → error sin eliminar; éxito → `task.delete` llamado con `{ where: { id } }`

## 4. Verificación

- [x] 4.1 `npm run lint` (biome) y `tsc` limpios (solo los ~46 errores preexistentes)
- [x] 4.2 Suite `npm run test` verde (45 existentes + nuevos)
- [x] 4.3 Prueba manual: como Sarah (SM) y Pedro (PO) eliminar una tarea creada en la sesión de prueba → desaparece y recargar mantiene el estado
- [x] 4.4 Prueba manual: como Ana (dev1) el botón "×" ya no aparece en las tarjetas, y un `DELETE` directo responde 403

**Verificado en vivo (2026-10-08):** `DELETE /api/tasks/:id` como dev1 → **403 Forbidden** (cookie de sesión real); la tarea de Ana permanece intacta en `tasks`
- [x] 4.5 Verificar en la DB que la fila de la tarea eliminada ya no existe en `tasks`
