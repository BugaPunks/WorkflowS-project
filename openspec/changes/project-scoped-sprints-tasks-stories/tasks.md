## 1. API: filtrado por proyecto en los listados

- [ ] 1.1 `src/server/routes/sprints.ts`: `GET /` acepta `?projectId=` y añade `where: { projectId }` al `findMany` cuando el parámetro está presente.
- [ ] 1.2 `src/server/routes/user-stories.ts`: `GET /` acepta `?projectId=` y añade `where: { projectId }` al `findMany` cuando el parámetro está presente.
- [ ] 1.3 `src/api/client.ts`: `sprintAPI.getAll` y `userStoryAPI.getAll` aceptan `queryParams?: { projectId?: string }` y los serializan (patrón de `taskAPI.getAll`).
- [ ] 1.4 Confirmar que `GET /api/tasks` ya filtra por `projectId` (no requiere cambios).

## 2. Tests de integración de la API

- [ ] 2.1 Crear `src/server/routes/sprints-project-filter.test.ts` (patrón de `sprints-delete.test.ts` con `vi.hoisted` + mock de prisma): con sprints en dos proyectos, `GET /api/sprints?projectId=A` devuelve solo los de A; sin parámetro devuelve todos; con proyecto inexistente devuelve lista vacía; no-miembro autenticado recibe los sprints de A (el filtro no depende de membresía).
- [ ] 2.2 Crear `src/server/routes/user-stories-project-filter.test.ts`: mismo patrón para historias (dos proyectos, con y sin filtro, proyecto inexistente, no-miembro).
- [ ] 2.3 Ejecutar `npm run test` y dejar la suite completa en verde (incluye los 2 tests nuevos).

## 3. Rutas (App.tsx)

- [ ] 3.1 Añadir rutas anidadas en `src/App.tsx`: `/projects/:projectId/sprints`, `/projects/:projectId/user-stories`, `/projects/:projectId/tasks` y `/projects/:projectId/sprints/:sprintId`.
- [ ] 3.2 Eliminar las rutas globales `/sprints`, `/sprints/:id`, `/tasks` y `/user-stories`.
- [ ] 3.3 Añadir redirecciones `<Navigate to="/projects" replace />` para las rutas globales eliminadas.

## 4. Páginas de proyecto (Sprints, Tasks, UserStories)

- [ ] 4.1 `src/pages/Sprints.tsx`: leer `projectId` de la ruta (`useParams`), consultar `sprintAPI.getAll({ projectId })`, aplicar filtro de respaldo `r.projectId === projectId` antes de `setState` y mostrar encabezado con el nombre del proyecto.
- [ ] 4.2 `src/pages/Tasks.tsx`: leer `projectId` de la ruta, consultar `taskAPI.getAll({ projectId })`, aplicar filtro de respaldo y mostrar encabezado con el nombre del proyecto.
- [ ] 4.3 `src/pages/UserStories.tsx`: leer `projectId` de la ruta, consultar `userStoryAPI.getAll({ projectId })`, aplicar filtro de respaldo y mostrar encabezado con el nombre del proyecto.
- [ ] 4.4 En las tres vistas, mostrar estado "proyecto no encontrado" cuando el `projectId` de la URL no existe (sin listar registros de otros proyectos).
- [ ] 4.5 `src/pages/Sprints.tsx`: navegar al detalle con `/projects/${sprint.projectId}/sprints/${sprint.id}` en lugar de `/sprints/${id}`.

## 5. Detalles y navegación "volver"

- [ ] 5.1 `src/pages/SprintDetail.tsx`: leer `projectId` y `sprintId` de la ruta (ruta `/projects/:projectId/sprints/:sprintId`) y cambiar el botón "volver" para navegar a `/projects/${projectId}/sprints`.
- [ ] 5.2 `src/pages/TaskDetail.tsx`: cambiar el botón "volver" para navegar a `/projects/${projectId}/tasks` en lugar de `/tasks`.

## 6. Navegación lateral y panels de bienvenida

- [ ] 6.1 `src/components/NavigationSidebar.tsx`: quitar las entradas globales Sprints/Tareas/Historias de `ADMIN_MENU` y `STUDENT_MENU`.
- [ ] 6.2 `src/islands/ProductOwnerWelcomeOptions.tsx` y `src/islands/ScrumMasterWelcomeOptions.tsx`: reemplazar enlaces a `/user-stories` y `/sprints` por `/projects` (o eliminar si quedan huérfanos).
- [ ] 6.3 `src/islands/TeamDeveloperWelcomeOptions.tsx` y `src/components/dashboards/StudentDashboard.tsx`: reemplazar enlaces a `/tasks` por `/projects` (o eliminar según UX).
- [ ] 6.4 `src/pages/ProjectDetail.tsx`: añadir enlaces simples en el encabezado/board a las vistas anidadas (sprints/tareas/historias del proyecto) si aplica según el diseño final.

## 7. Adaptar tests E2E (Playwright)

- [ ] 7.1 `e2e/backlog.spec.ts`: reemplazar `page.goto("/user-stories")` por la navegación al proyecto y a `/projects/:projectId/user-stories` (el proyecto se crea en el mismo test); ajustar `toHaveURL`.
- [ ] 7.2 `e2e/sprint-board.spec.ts`: reemplazar `page.goto("/sprints")` por `/projects/:projectId/sprints` (el test ya crea el proyecto); mantener la verificación del botón "Eliminar".
- [ ] 7.3 `e2e/task-assignment.spec.ts`: reemplazar `page.goto("/tasks")` por `/projects/:projectId/tasks`; ajustar el selector de proyecto del modal (ya no hace falta elegir proyecto).
- [ ] 7.4 `e2e/dashboards.spec.ts`: reemplazar la aserción `a[href='/tasks']` visible por la nueva realidad (sin enlace global a tareas): verificar que `a[href='/tasks']` tiene count 0 y que el acceso a tareas pasa por el proyecto.
- [ ] 7.5 `e2e/full-lifecycle.spec.ts`: reemplazar `page.goto("/user-stories")` por la navegación al proyecto y a `/projects/:projectId/user-stories`; ajustar el flujo de creación de historia (selector de proyecto implícito).
- [ ] 7.6 Ejecutar `npm run e2e` y dejar la suite en verde.

## 8. Calidad y verificación

- [ ] 8.1 Ejecutar `npm run check` y corregir errores de lint/biome.
- [ ] 8.2 Ejecutar `npx tsc --noEmit` y corregir errores de tipos.
