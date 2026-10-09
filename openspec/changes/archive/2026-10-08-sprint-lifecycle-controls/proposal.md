# Sprint Lifecycle Controls

## Why

En el detalle del proyecto se pueden crear sprints y asignar/quitar historias, pero **no hay forma de iniciar ni completar un sprint desde la UI**. El endpoint `PUT /api/sprints/:id` ya existe y admite el cambio de `status` (`SCRUM_MASTER`/`PRODUCT_OWNER`, con bypass `ADMIN`), e incluso dispara las notificaciones `SPRINT_COMPLETED` a todos los miembros del proyecto al pasar a `COMPLETED`; sin embargo **ninguna página del frontend lo llama**. Esto bloquea el cierre del flujo Scrum (completar el sprint, habilitar retrospectivas/métricas y la notificación masiva).

## What Changes

- Agregar en cada tarjeta de sprint del detalle del proyecto los botones **"Iniciar Sprint"** (`PLANNING`/`PLANNED` → `ACTIVE`) y **"Completar Sprint"** (`ACTIVE` → `COMPLETED`), visibles solo para quien gestiona el proyecto (`isProjectAdmin`: OWNER/LEAD/SM/PO, o `ADMIN` del sistema)
- Handler que llama a `sprintAPI.update(id, { status })`, muestra `confirm()` al completar (porque dispara notificación masiva y advierte si quedan tareas pendientes), recarga los datos ante éxito y muestra `alert(error)` ante fallo
- Agregar un **test de integración** para `PUT /api/sprints/:id` (el contrato que la UI ahora consume): transiciones de estado y notificaciones `SPRINT_COMPLETED` a todos los miembros, matriz de permisos

## Capabilities

### New Capabilities
- `sprint-lifecycle`: cubre el ciclo de vida de un sprint —iniciar y completar— tanto en su contrato de API (autorización, transiciones, notificaciones) como en los controles de la UI que lo accionan.

### Modified Capabilities
<!-- Ninguna: sprint-lifecycle es nueva; no cambia requisitos de capacidades existentes. -->

## Impact

- `src/pages/ProjectDetail.tsx`: botones en el encabezado de la tarjeta de sprint (junto al badge de estado) + handler `handleSprintStatus`
- `src/server/routes/sprints-lifecycle.test.ts` (nuevo): integración del `PUT /api/sprints/:id` (vitest + `fetch` nativo + `vi.mock("../db")`), reutilizando el patrón de `sprints-remove-story.test.ts`
- **Sin cambios de backend ni de schema**: el endpoint ya existe; solo se agrega cobertura de test y UI
- `src/api/client.ts`: `sprintAPI.update` ya existe — no se modifica