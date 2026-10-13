## Why

Al activar una notificación cuyo `entityType` no es `PROJECT` ni `TASK` (por ejemplo `SPRINT`,
`USER_STORY`, `MESSAGE` o `RETROSPECTIVE_ITEM`), el panel de notificaciones navega a la ruta
`/dashboard`, que no existe en el router de la aplicación. Sin una ruta catch-all, React Router
no renderiza ninguna pantalla y el usuario ve una página en blanco: la notificación llega, pero
al hacer clic en lugar de abrir el detalle se pierde el contexto de la aplicación.

## What Changes

- Corregir `handleNotificationClick` en `src/components/NotificationBell.tsx` para resolver una
  ruta válida por cada `entityType`:
  - `PROJECT` → `/projects/:projectId/tasks` (se conserva).
  - `TASK` → resuelve el proyecto con `GET /api/tasks/:id` → `/projects/:projectId/tasks`.
  - `SPRINT` → resuelve el proyecto con `GET /api/sprints/:id` →
    `/projects/:projectId/sprints/:sprintId`.
  - `USER_STORY` → resuelve el proyecto con `GET /api/user-stories/:id` →
    `/projects/:projectId/user-stories`.
  - `MESSAGE`, `RETROSPECTIVE_ITEM`, referencia ausente, `projectId` no resoluble o error de red
    → `/` (dashboard raíz), nunca una pantalla en blanco.
- Añadir una ruta catch-all en `src/App.tsx` que redirija cualquier URL desconocida a `/`, de modo
  que ninguna navegación vuelva a dejar la aplicación vacía.
- Cubrir la navegación corregida con pruebas E2E de notificaciones (`SPRINT` y fallback).

## Capabilities

### New Capabilities

<!-- None: no se introduce ningún capability nuevo. -->

### Modified Capabilities

- `notification-center`: el requirement "Clicking a notification navigates to its detail" se amplía
  para especificar la ruta destino de cada `entityType` y garantizar una ruta válida (fallback a `/`)
  en lugar de navegar a rutas inexistentes.

## Impact

- **Frontend**: `src/components/NotificationBell.tsx` (resolución de rutas por tipo de entidad),
  `src/App.tsx` (ruta catch-all).
- **APIs consumidas (solo lectura, ya existentes)**: `GET /api/tasks/:id`, `GET /api/sprints/:id`,
  `GET /api/user-stories/:id`.
- **Tests**: `e2e/notifications.spec.ts`.
- **Sin cambios** en backend, esquema Prisma, ni contratos de API.
- **Fuera de alcance**: una página dedicada de notificaciones y el botón "Ver todas" (hoy sin
  handler); la apertura del widget de chat desde una notificación `MESSAGE`.
