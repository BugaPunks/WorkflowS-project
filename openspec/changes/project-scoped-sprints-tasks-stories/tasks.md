## 1. Rutas (App.tsx)

- [ ] 1.1 Añadir rutas anidadas en `src/App.tsx`: `/projects/:projectId/sprints`, `/projects/:projectId/user-stories`, `/projects/:projectId/tasks` y `/projects/:projectId/sprints/:sprintId`.
- [ ] 1.2 Eliminar las rutas globales `/sprints`, `/sprints/:id`, `/tasks` y `/user-stories`.
- [ ] 1.3 Añadir redirecciones `<Navigate to="/projects" replace />` para las rutas globales eliminadas.

## 2. Páginas de proyecto (Sprints, Tasks, UserStories)

- [ ] 2.1 `src/pages/Sprints.tsx`: leer `projectId` de la ruta (`useParams`), filtrar los sprints por ese `projectId` antes de `setState` y mostrar encabezado con el nombre del proyecto.
- [ ] 2.2 `src/pages/Tasks.tsx`: leer `projectId` de la ruta, filtrar las tareas por ese `projectId` y mostrar encabezado con el nombre del proyecto.
- [ ] 2.3 `src/pages/UserStories.tsx`: leer `projectId` de la ruta, filtrar las historias por ese `projectId` y mostrar encabezado con el nombre del proyecto.
- [ ] 2.4 En cada vista, verificar con pruebas de unidad que el filtrado excluye registros de otros proyectos (fail-closed) y que con `projectId` aún no cargado no se muestran registros ajenos.
- [ ] 2.5 `src/pages/Sprints.tsx`: navegar al detalle con `/projects/${sprint.projectId}/sprints/${sprint.id}` en lugar de `/sprints/${id}`.

## 3. Detalles y navegación "volver"

- [ ] 3.1 `src/pages/SprintDetail.tsx`: leer `projectId` y `sprintId` de la ruta (ruta `/projects/:projectId/sprints/:sprintId`) y cambiar el botón "volver" para navegar a `/projects/${projectId}/sprints`.
- [ ] 3.2 `src/pages/TaskDetail.tsx`: cambiar el botón "volver" para navegar a `/projects/${projectId}/tasks` en lugar de `/tasks`.

## 4. Navegación lateral y panels de bienvenida

- [ ] 4.1 `src/components/NavigationSidebar.tsx`: quitar las entradas globales Sprints/Tareas/Historias de `ADMIN_MENU` y `STUDENT_MENU`.
- [ ] 4.2 `src/islands/ProductOwnerWelcomeOptions.tsx` y `src/islands/ScrumMasterWelcomeOptions.tsx`: reemplazar enlaces a `/user-stories` y `/sprints` por `/projects` (o eliminar si quedan huérfanos).
- [ ] 4.3 `src/islands/TeamDeveloperWelcomeOptions.tsx` y `src/components/dashboards/StudentDashboard.tsx`: reemplazar enlaces a `/tasks` por `/projects` (o eliminar según UX).
- [ ] 4.4 `src/pages/ProjectDetail.tsx`: añadir enlaces simples en el encabezado/board a las vistas anidadas (sprints/tareas/historias del proyecto) si aplica según el diseño final.

## 5. Calidad y verificación

- [ ] 5.1 Ejecutar `npm run check` y corregir errores de lint/biome.
- [ ] 5.2 Ejecutar `npm run test` (vitest) y añadir/ajustar pruebas de unidad del filtrado por `projectId` en las tres vistas.
- [ ] 5.3 Ejecutar `npx tsc --noEmit` y corregir errores de tipos.
- [ ] 5.4 Verificación manual por rol (ADMIN, PO, SM, Dev): navegar a `/projects/:id/{sprints,tasks,user-stories}` y confirmar que cada vista lista solo registros del proyecto y que las redirecciones de rutas globales funcionan.