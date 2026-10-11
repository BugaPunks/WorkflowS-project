## Context

Hoy las páginas `Sprints`, `Tasks` y `UserStories` son rutas globales (`/sprints`, `/tasks`, `/user-stories`) montadas en `src/App.tsx` dentro de `DashboardLayout`. Los GET de la API (`/api/sprints`, `/api/tasks`, `/api/user-stories`) devuelven todos los registros a cualquier usuario autenticado. Las páginas globales renderizan todo tal cual; en cambio `ProjectDetail` ya filtra por su `projectId` en el cliente y ya existe el patrón de rutas anidadas bajo `/projects/:projectId/...` (`tasks/:taskId`, `sprints/:sprintId/grade`).

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
- Cambiar el contrato de la API GET (devuelve todo a autenticados) ni añadir filtrado por membresía en el servidor.
- Cambiar el modelo de datos / esquema Prisma.
- Rediseñar el contenido interno de `ProjectDetail` (tabs board/miembros/chat/docs/retro) salvo enlazar a las vistas anidadas.
- Mover `Reports`, `Rubrics`, `Calendar` ni `Evaluations` (consumen `fetch("/api/sprints")` como datos, no las rutas de página).

## Decisions

### D1. Vistas anidadas reutilizan las páginas existentes con `projectId` de la URL
`Sprints.tsx`, `Tasks.tsx` y `UserStories.tsx` reciben `projectId` desde `useParams()`, filtran su fuente de datos por ese `projectId` (mismo patrón que `ProjectDetail`, que ya filtra `fetch("/api/sprints")` y `fetch("/api/user-stories")` por proyecto) y muestran el nombre del proyecto en el encabezado.
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
- **`projectId` inválido o inexistente** en la URL → la vista carga vacía o muestra estado de error; no se filtran datos de otros proyectos (fail-closed). Se recomienda pantalla "proyecto no encontrado" si el fetch de detalle falla con 404.
- **Regresión de permisos**: si el filtrado por proyecto se hace mal, un usuario vería registros ajenos ya renderizados del fetch global. Mitigación: el filtrado `filter((r) => r.projectId === projectId)` se aplica antes de `setState`, y el encabezado deja claro el proyecto; tests de unidad cubren el filtro.
- **`SprintDetail` requiere `projectId`** que antes no tenía → se propaga por la URL (requisito D3) y, si no llega, "volver" apunta a `/projects`.
- **Dev server vs build**: en dev, rsbuild sirve las rutas SPA; en producción no hay server-side routing de estas páginas (el servidor Express expone solo la API), por lo que la redirección cliente es suficiente. No hay cambio de infraestructura.

## Migration Plan

1. Rutas en `App.tsx`: añadir anidadas y redirecciones; eliminar globales (todo en el mismo commit).
2. Adaptar páginas (`Sprints`, `Tasks`, `UserStories`) al ámbito de proyecto.
3. Cambiar enlaces de `Sprints.tsx` → detalle, y botones "volver" de `SprintDetail`/`TaskDetail`.
4. Actualizar `NavigationSidebar` y welcome islands / `StudentDashboard`.
5. Verificación manual por rol (ADMIN, PO, SM, Dev) y unit tests del filtrado.
6. Rollback: revertir el commit; las rutas globales eliminadas reaparecen y las redirecciones desaparecen (las páginas vuelven a su estado previo).

## Open Questions

- ¿Los accesos rápidos de los welcome islands que se quedaban "huérfanos" (p. ej. "Mis tareas pendientes" de `TeamDeveloperWelcomeOptions`) se eliminan, o enlazan a `/projects` para que el usuario elija el proyecto? Se asume enlazar a `/projects` (decisión D4), verificable en el detalle de los island al implementar.
- ¿`ProjectDetail` gana pestañas/enlaces directos a las vistas anidadas (sprints/tareas/historias) o basta con el "Ir al proyecto" + breadcrumb? Se asume añadir enlaces simples en el encabezado del board; pendiente de confirmar el look final.