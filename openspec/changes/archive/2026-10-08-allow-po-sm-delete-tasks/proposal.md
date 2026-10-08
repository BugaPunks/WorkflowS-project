# Allow PO/SM to Delete Tasks

## Why

El endpoint `DELETE /api/tasks/:id` está restringido con `requireSystemRole("ADMIN")`, igual que estaba el de historias de usuario. En la prueba del flujo Scrum quedó en evidencia: Sarah (SM) creó una tarea y al intentar eliminarla recibió `403 Forbidden` y el error genérico "Error al eliminar tarea". Los roles de gestión del sprint (PO/SM) deben poder borrar tareas de su proyecto.

## What Changes

- Agregar autorización al `DELETE /api/tasks/:id`: `requireProjectRole(["PRODUCT_OWNER", "SCRUM_MASTER"], <resolver que busca la tarea por `req.params.id` y devuelve `projectId ?? null`>)`, conservando el bypass de `ADMIN` que ya da el middleware
- En `src/pages/Tasks.tsx`, ocultar el botón "Eliminar" de cada tarjeta salvo para quien puede borrar (ADMIN, o PO/SM del proyecto de la tarea) — fail-closed si los proyectos aún no cargaron
- En `handleDeleteTask`, mostrar el error real de la API (distinguir `403` sin permiso y el mensaje del cuerpo de la respuesta) en lugar del mensaje genérico
- Agregar tests de integración para el endpoint (mismo patrón del `sprints-remove-story.test.ts`), cubriendo la matriz de permisos y los errores del handler

## Capabilities

### New Capabilities
- `task-management`: cubre la gestión de tareas en el proyecto — crear, mover de estado y eliminar, incluyendo autorización de borrado, visibilidad del botón en la UI y mensajes de error.

### Modified Capabilities
<!-- Ninguna: task-management es nueva; no cambia requisitos de capacidades existentes. -->

## Impact

- `src/server/routes/tasks.ts`: middleware del `DELETE /:id` (`requireSystemRole("ADMIN")` → `requireProjectRole` con resolver) + comentario actualizado; verificar si `requireSystemRole` queda sin uso en el archivo
- `src/pages/Tasks.tsx`: helper `canDeleteTask` + render condicional del botón + manejo de errores en `handleDeleteTask`
- `src/server/routes/tasks-remove.test.ts` (nuevo): primer test de integración del DELETE de tareas (vitest + `fetch` nativo + `vi.mock("../db")`), sin dependencias nuevas
- La API de `GET /api/tasks` ya devuelve `projectId` en cada tarea (include de project) — verificar su forma para el helper