## Context

Hoy las páginas `Sprints`, `Tasks` y `UserStories` son rutas globales (`/sprints`, `/tasks`, `/user-stories`) montadas en `src/App.tsx` dentro de `DashboardLayout`. En la API, `GET /api/tasks` **ya filtra** por `?projectId=`; `GET /api/sprints` y `GET /api/user-stories` devuelven todos los registros sin soportar ese parámetro. Las páginas globales renderizan todo tal cual; en cambio `ProjectDetail` ya filtra por su `projectId` en el cliente y ya existe el patrón de rutas anidadas bajo `/projects/:projectId/...` (`tasks/:taskId`, `sprints/:sprintId/grade`).

Los puntos de acceso globales actuales:
- `NavigationSidebar`: menús `ADMIN_MENU` (Sprints, Historias) y `STUDENT_MENU` (Sprints, Tareas, Historias) para todos los roles.
- Welcome islands: `ProductOwnerWelcomeOptions` (`/user-stories`, `/sprints`), `ScrumMasterWelcomeOptions` (`/sprints`), `TeamDeveloperWelcomeOptions` (`/tasks`), `StudentDashboard` (`/tasks`).
- `SprintDetail` y `TaskDetail`: botones "volver" a `/sprints` y `/tasks` respectivamente.
- `Sprints.tsx` navega al detalle con `/sprints/${sprint.id}`.

Las rutas usan `react-router-dom` v7; el servidor es Express y NO sirve el frontend en producción de estas rutas visibles (solo el dev server de rsbuild lo hace), por lo que las redirecciones se implementan en el router del cliente.

## Goals / Non-Goals

**Goals:**
- Que Sprints, Tareas e Historias se consulten siempre dentro de un proyecto, vía rutas anidadas `/projects/:projectId/...`.
- Que esas vistas listen solo los registros de ese proyecto (fail-closed ante `projectId` no resuelto).
- Que la navegación y los panels de bienvenida no ofrezcan accesos globales a esas vistas, para todos los roles.
- Que "volver" desde los detalles regrese al contexto del proyecto.

**Non-Goals:**
- No añadir filtrado por membresía ni por rol en los GET de listados (la visibilidad por membresía a nivel de API queda para un cambio futuro). El parámetro `projectId` solo limita el alcance, no la autorización.
- No cambiar los endpoints de escritura (`POST`/`PUT`/`DELETE`) ni su autorización.
- Cambiar el modelo de datos / esquema Prisma.
- Rediseñar el contenido interno de `ProjectDetail` (tabs board/miembros/chat/docs/retro) salvo enlazar a las vistas anidadas.
- Mover `Reports`, `Rubrics`, `Calendar` ni `Evaluations` (consumen `fetch("/api/sprints")` como datos, no las rutas de página).

## Decisions

### D1. Vistas anidadas reutilizan las páginas existentes con `projectId` de la URL y la API filtra por proyecto
`Sprints.tsx`, `Tasks.tsx` y `UserStories.tsx` reciben `projectId` desde `useParams()` y consultan la API con `?projectId=` (respaldado por un filtro en el cliente `filter((r) => r.projectId === projectId)` antes de `setState` por si algún registro llegara sin el parámetro). En el encabezado se muestra el nombre del proyecto.
- **API**: `GET /api/sprints` y `GET /api/user-stories` pasan a aceptar `?projectId=` (mismo patrón que `GET /api/tasks` en `tasks.ts`: `const { projectId } = req.query;` + `where` condicional). Se actualizan `sprintAPI.getAll()` y `userStoryAPI.getAll()` en `src/api/client.ts` para pasar el parámetro.
- **Alternativa considerada**: solo filtrar en el cliente (sin tocar la API) — descartado: obligaría a transferir todos los registros a cada vista (crece con el número de proyectos), es inconsistente con `tasks` que ya filtra en el servidor, y no permite tests de integración del filtrado.
- **Alternativa considerada**: reescribir páginas nuevas por proyecto — descartado, duplicaría ~450 líneas por página y perdería los permisos/controles ya implementados (botón eliminar, drag & drop, selector de estado).

### D2. Rutas y redirecciones en el router del cliente
En `src/App.tsx`:
- Añadir: `projects/:projectId/sprints`, `projects/:projectId/tasks`, `projects/:projectId/user-stories`, `projects/:projectId/sprints/:sprintId`.
- Eliminar: `/sprints`, `/sprints/:id`, `/tasks`, `/user-stories`.
- Redirigir las rutas globales eliminadas con `<Navigate to="/projects" replace />` para no romper enlaces existentes (marcadores, paneles viejos).

### D3. El detalle de sprint pasa a `Sprints.tsx`'s enlace y a `SprintDetail.tsx` bajo el proyecto
`Sprints.tsx` navega al detalle con `/projects/${sprint.projectId}/sprints/${sprint.id}`. `SprintDetail.tsx` lee `sprintId` (y `projectId`) de la ruta, y su botón "volver" navega a `/projects/${projectId}/sprints`. `TaskDetail.tsx` (ya en ruta anidada) cambia su "volver" de `/tasks` a `/projects/${projectId}/tasks`.
- **Nota**: `SprintDetail` y `TaskDetail` necesitan el `projectId`; `TaskDetail` ya lo tiene en la ruta; `SprintDetail` debe recibirlo o derivarlo del sprint cargado y usar la ruta parametrizada.

### D4. Navegación sin accesos globales
En `NavigationSidebar`, quitar de `ADMIN_MENU` y `STUDENT_MENU` las entradas Sprints/Tareas/Historias globales; el acceso a esas vistas ocurre desde el proyecto. En los welcome islands (`ProductOwnerWelcomeOptions`, `ScrumMasterWelcomeOptions`, `TeamDeveloperWelcomeOptions`) y `StudentDashboard`, los accesos rápidos que apuntaban a rutas eliminadas apuntan a `/projects` (la vista de proyectos) o se eliminan si no aportan contexto.
- **Alternativa considerada**: mantener entradas del menú que navegaran a "el último proyecto visitado" — descartado por complejidad y por el objetivo del cambio (nada global).

### D5. Encabezado de contexto en las vistas de proyecto
Cada vista anidada muestra el nombre del proyecto (obtenido de `projectAPI.getAll()` o del fetch de detalle) junto al título, y un vínculo "Ir al proyecto" (`/projects/:projectId`) para anclar el contexto.

## Risks / Trade-offs

- **Enlaces viejos a rutas globales** (marcadores, accesos directos) → las redirecciones `<Navigate to="/projects">` en el router cubren el acceso directo; los enlaces internos se actualizan en el mismo cambio.
- **Tests E2E existentes rotos**: `backlog`, `sprint-board`, `task-assignment`, `dashboards` y `full-lifecycle` navegan a rutas globales o esperan `a[href='/tasks']` → se adaptan en el mismo cambio (tareas de migración) antes de dar por cerrada la implementación; `npm run e2e` debe quedar verde.
- **`projectId` inválido o inexistente** en la URL → la vista muestra estado "proyecto no encontrado" (el fetch de detalle devuelve 404); no se filtran datos de otros proyectos (fail-closed).
- **Regresión de permisos**: si el filtrado por proyecto se hace mal, un usuario vería registros ajenos ya renderizados del fetch global. Mitigación: el filtrado `filter((r) => r.projectId === projectId)` se aplica antes de `setState` incluso con el filtro de la API, y el encabezado deja claro el proyecto; tests de integración de la API y E2E con dos proyectos cubren el filtrado.
- **`SprintDetail` requiere `projectId`** que antes no tenía → se propaga por la URL (requisito D3) y, si no llega, "volver" apunta a `/projects`.
- **Dev server vs build**: en dev, rsbuild sirve las rutas SPA; en producción no hay server-side routing de estas páginas (el servidor Express expone solo la API), por lo que la redirección cliente es suficiente. No hay cambio de infraestructura.

## Migration Plan

1. API: añadir soporte de `?projectId=` a `GET /api/sprints` y `GET /api/user-stories`, y a `sprintAPI.getAll()` / `userStoryAPI.getAll()` en `client.ts`.
2. Tests de integración: `sprints-project-filter.test.ts` y `user-stories-project-filter.test.ts` (patrón de `sprints-delete.test.ts`).
3. Rutas en `App.tsx`: añadir anidadas y redirecciones; eliminar globales (todo en el mismo commit).
4. Adaptar páginas (`Sprints`, `Tasks`, `UserStories`) al ámbito de proyecto (leer `projectId`, consultar con filtro, encabezado, estado "proyecto no encontrado").
5. Cambiar enlaces de `Sprints.tsx` → detalle, y botones "volver" de `SprintDetail`/`TaskDetail`.
6. Actualizar `NavigationSidebar` y welcome islands / `StudentDashboard`.
7. Adaptar los 5 specs E2E afectados a las rutas anidadas; `npm run e2e` en verde.
8. Verificación manual por rol (ADMIN, PO, SM, Dev).
9. Rollback: revertir el commit; las rutas globales eliminadas reaparecen, las redirecciones y el filtro de la API desaparecen (las páginas vuelven a su estado previo).

## Open Questions

- ¿Los accesos rápidos de los welcome islands que se quedaban "huérfanos" (p. ej. "Mis tareas pendientes" de `TeamDeveloperWelcomeOptions`) se eliminan, o enlazan a `/projects` para que el usuario elija el proyecto? Se asume enlazar a `/projects` (decisión D4), verificable en el detalle de los island al implementar.
- ¿`ProjectDetail` gana pestañas/enlaces directos a las vistas anidadas (sprints/tareas/historias) o basta con el "Ir al proyecto" + breadcrumb? Se asume añadir enlaces simples en el encabezado del board; pendiente de confirmar el look final.