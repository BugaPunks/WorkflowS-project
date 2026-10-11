# Proposal

## Why

Las páginas globales de Sprints (`/sprints`), Tareas (`/tasks`) e Historias (`/user-stories`) muestran registros de **todos** los proyectos a cualquier usuario autenticado, mezclando el trabajo de equipos ajenos sin contexto. Eso confunde: un estudiante ve sprints y tareas de proyectos en los que no participa, y solo se entera al intentar gestionarlos de que no tiene permiso. Los listados deberían vivir **dentro del proyecto** al que pertenecen, mostrando únicamente los registros de ese proyecto, para dejar claro de qué proyecto son cada sprint, tarea e historia.

## What Changes

- **Rutas**: se eliminan las rutas globales `/sprints`, `/sprints/:id`, `/tasks` y `/user-stories` (**BREAKING**). Se añaden rutas anidadas por proyecto: `/projects/:projectId/sprints`, `/projects/:projectId/user-stories`, `/projects/:projectId/tasks`, y el detalle de sprint pasa a `/projects/:projectId/sprints/:sprintId`. Las rutas viejas redirigen a `/projects`.
- **UI**: las páginas de Sprints, Tareas e Historias pasan a ser **de ámbito de proyecto**: leen el `projectId` de la URL, muestran solo los registros de ese proyecto y lo indican en el encabezado (fail-closed: sin `projectId` válido no se muestran registros de otros proyectos).
- **Navegación**: el menú lateral (todos los roles, incluido ADMIN) deja de ofrecer accesos globales a Sprints/Tareas/Historias; el acceso a esas vistas es desde el proyecto. Los panels de bienvenida (PO/SM/Dev) actualizan sus enlaces de "acceso rápido" para no apuntar a rutas eliminadas.
- **Volver**: los botones "volver" de `SprintDetail` y `TaskDetail` regresan al proyecto correspondiente (lista de sprints/tareas del proyecto), no a una vista global.
- **Fuente de datos**: las tres páginas mantienen su filtrado por `projectId` en el cliente (ya existe el patrón en `ProjectDetail`), de modo que dentro del proyecto solo se rendericen sus propios sprints, tareas e historias. No se cambia el contrato de la API GET (devolver todo a autenticados queda como decisión de un cambio futuro de visibilidad).

### Non-goals

- No se cambia la API: `GET /api/sprints`, `GET /api/tasks` y `GET /api/user-stories` siguen devolviendo todos los registros a cualquier autenticado; restringir la visibilidad a nivel de API es un cambio futuro separable.
- No se cambia el modelo de datos ni el esquema de Prisma.
- No se tocan las rutas ya anidadas bajo `/projects/:projectId` (`tasks/:taskId`, calificaciones) más allá de reutilizar su patrón.
- No se reorganizan las secciones internas de `ProjectDetail` (board/tabs) excepto lo necesario para enlazar a las vistas anidadas.

## Capabilities

### New Capabilities

- `project-scoped-views`: define que las vistas de Sprints, Tareas e Historias se consultan dentro de un proyecto (`/projects/:projectId/...`), listan solo los registros de ese proyecto, y no se ofrecen accesos globales a ellas desde la navegación.

### Modified Capabilities

Ninguna. Las capacidades existentes (`sprint-lifecycle`, `task-management`, `user-story-management`, `role-dashboard`) describen autorización y visibilidad de acciones dentro de las páginas; su comportamiento no cambia a nivel de requisito. El cambio de "dónde viven las vistas" se recoge en la nueva capacidad.

## Impact

- `src/App.tsx` — definición de rutas: eliminar globales, añadir anidadas, redirecciones.
- `src/pages/Sprints.tsx`, `src/pages/Tasks.tsx`, `src/pages/UserStories.tsx` — ámbito de proyecto (leer `projectId` de la URL, filtrar, encabezado).
- `src/pages/SprintDetail.tsx`, `src/pages/TaskDetail.tsx` — ruta y navegación "volver" al proyecto.
- `src/components/NavigationSidebar.tsx` — quitar accesos globales a Sprints/Tareas/Historias de los menús ADMIN y estudiante.
- `src/islands/ProductOwnerWelcomeOptions.tsx`, `ScrumMasterWelcomeOptions.tsx`, `TeamDeveloperWelcomeOptions.tsx`, `src/components/dashboards/StudentDashboard.tsx` — actualizar enlaces de acceso rápido.
- `src/pages/ProjectDetail.tsx` — enlaces a las vistas anidadas (sprints/tareas/historias del proyecto) si aplica.
- Sin cambios de dependencias ni de base de datos.
- Tests: ajustar/ampliar pruebas de unidad si referencian rutas eliminadas; verificación manual de navegación por rol.