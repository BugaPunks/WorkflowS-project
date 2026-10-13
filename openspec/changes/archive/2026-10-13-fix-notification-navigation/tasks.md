## 1. Resolución de rutas en el panel de notificaciones

- [x] 1.1 En `src/components/NotificationBell.tsx`, reescribir `handleNotificationClick` para resolver la ruta por `entityType`: `PROJECT` → `/projects/:entityId/tasks`; `TASK` → `GET /api/tasks/:id` y navegar a `/projects/:projectId/tasks`
- [x] 1.2 Añadir los casos `SPRINT` (`GET /api/sprints/:id` → `/projects/:projectId/sprints/:entityId`) y `USER_STORY` (`GET /api/user-stories/:id` → `/projects/:projectId/user-stories`)
- [x] 1.3 Sustituir todo `navigate("/dashboard")` por `navigate("/")` y cubrir `MESSAGE`, `RETROSPECTIVE_ITEM`, `entityType` desconocido, `projectId` ausente y errores de fetch con el fallback a `/`
- [x] 1.4 Verificar que una notificación sin referencia (`entityType`/`entityId` nulos) solo se marca como leída y no navega

## 2. Defensa del router

- [x] 2.1 En `src/App.tsx`, añadir la ruta catch-all `<Route path="*" element={<Navigate to="/" replace />} />` dentro de `DashboardLayout`

## 3. Pruebas

- [x] 3.1 En `e2e/notifications.spec.ts`, añadir un caso que cree un sprint, lo complete y verifique que al activar la notificación `SPRINT_COMPLETED` se navega a `/projects/:projectId/sprints/:sprintId`
- [x] 3.2 Añadir un caso que verifique que una notificación sin ruta dedicada (o un path desconocido como `/dashboard`) termina en el dashboard `/` sin pantalla en blanco
- [x] 3.3 Confirmar que el caso existente `NTF-01` (TASK → `/projects/:projectId/tasks`) sigue verde

## 4. Calidad

- [x] 4.1 Ejecutar `npm run check` y `npx tsc --noEmit` sin errores
- [x] 4.2 Ejecutar `npm run test` en verde
- [x] 4.3 Ejecutar `openspec validate --all`
