# Spec Delta

## ADDED Requirements

### Requirement: Las vistas de sprints, tareas e historias viven dentro de un proyecto
El sistema SHALL ofrecer las vistas de listado de Sprints (`/projects/:projectId/sprints`), Tareas (`/projects/:projectId/tasks`) e Historias (`/projects/:projectId/user-stories`) como rutas anidadas bajo un proyecto. No SHALL existir rutas globales de listado (`/sprints`, `/tasks`, `/user-stories`); esos accesos SHALL redirigir a `/projects`. El detalle de un sprint SHALL residir en `/projects/:projectId/sprints/:sprintId`.

#### Scenario: El listado de sprints se abre dentro de un proyecto
- **WHEN** un usuario autenticado navega a `/projects/:projectId/sprints`
- **THEN** se muestra el listado de sprints con el encabezado del proyecto correspondiente, sin registros de otros proyectos

#### Scenario: El listado de tareas se abre dentro de un proyecto
- **WHEN** un usuario autenticado navega a `/projects/:projectId/tasks`
- **THEN** se muestra el listado de tareas propio de ese proyecto, sin tareas de otros proyectos

#### Scenario: El listado de historias se abre dentro de un proyecto
- **WHEN** un usuario autenticado navega a `/projects/:projectId/user-stories`
- **THEN** se muestra el listado de historias propio de ese proyecto, sin historias de otros proyectos

#### Scenario: La ruta global de sprints redirige
- **WHEN** un usuario navega a `/sprints` (ruta global eliminada)
- **THEN** el sistema redirige a `/projects`

#### Scenario: La ruta global de tareas redirige
- **WHEN** un usuario navega a `/tasks` (ruta global eliminada)
- **THEN** el sistema redirige a `/projects`

#### Scenario: La ruta global de historias redirige
- **WHEN** un usuario navega a `/user-stories` (ruta global eliminada)
- **THEN** el sistema redirige a `/projects`

#### Scenario: El detalle de sprint reside bajo el proyecto
- **WHEN** un usuario autenticado navega a `/projects/:projectId/sprints/:sprintId`
- **THEN** se muestra el detalle del sprint con su botón "volver" apuntando a la lista de sprints de ese proyecto

### Requirement: Cada vista de proyecto lista solo sus propios registros
Las páginas de Sprints, Tareas e Historias de ámbito de proyecto SHALL leer el `projectId` de la ruta y SHALL renderizar únicamente los sprints, tareas o historias cuyo `projectId` coincida. Mientras el `projectId` no esté resuelto o los datos de ese proyecto no estén cargados, la página SHALL mostrarse vacía o en carga, sin mostrar registros de otros proyectos (fail-closed).

#### Scenario: Sprint fuera del proyecto no se muestra
- **WHEN** un usuario abre `/projects/:projectId/sprints` y existen sprints de otro proyecto
- **THEN** los sprints de otros proyectos no se renderizan en esa vista

#### Scenario: Tarea fuera del proyecto no se muestra
- **WHEN** un usuario abre `/projects/:projectId/tasks` y existen tareas de otro proyecto
- **THEN** las tareas de otros proyectos no se renderizan en esa vista

#### Scenario: Historia fuera del proyecto no se muestra
- **WHEN** un usuario abre `/projects/:projectId/user-stories` y existen historias de otro proyecto
- **THEN** las historias de otros proyectos no se renderizan en esa vista

#### Scenario: Datos del proyecto aún no cargados
- **WHEN** un usuario abre una vista de proyecto y los datos de ese proyecto aún no terminan de cargar
- **THEN** la vista no muestra registros de otros proyectos mientras carga

### Requirement: La navegación no ofrece accesos globales a sprints, tareas e historias
La navegación lateral y los panels de bienvenida para todos los roles (incluido `ADMIN`) SHALL dejar de ofrecer entradas globales a Sprints, Tareas e Historias. El camino a esas vistas SHALL ser desde un proyecto. Los accesos rápidos de los panels de bienvenida que apuntaban a rutas globales eliminadas SHALL enlazar al contexto de proyectos en lugar de a rutas inexistentes.

#### Scenario: El menú lateral no muestra accesos globales a sprints
- **WHEN** un usuario (estudiante o ADMIN) visualiza la navegación lateral
- **THEN** no existe una entrada global "Sprints" que enlace fuera de un proyecto

#### Scenario: El menú lateral no muestra accesos globales a tareas e historias
- **WHEN** un usuario visualiza la navegación lateral
- **THEN** no existen entradas globales "Tareas" ni "Historias" que enlacen fuera de un proyecto

#### Scenario: El panel de bienvenida del PO/SM no enlaza a rutas globales
- **WHEN** un `PRODUCT_OWNER` o `SCRUM_MASTER` visualiza su panel de bienvenida
- **THEN** ningún acceso rápido enlaza a `/sprints`, `/tasks` ni `/user-stories`

#### Scenario: El panel de bienvenida del Developer no enlaza a la ruta global de tareas
- **WHEN** un `TEAM_DEVELOPER` visualiza su panel de bienvenida
- **THEN** ningún acceso rápido enlaza a `/tasks` (ruta global eliminada)

### Requirement: Los botones "volver" de los detalles regresan al proyecto
Los detalles de sprint y de tarea SHALL ofrecer un botón "volver" que regrese al contexto del proyecto: la lista de sprints del proyecto (`/projects/:projectId/sprints`) o la lista de tareas del proyecto (`/projects/:projectId/tasks`) según corresponda, no a un listado global.

#### Scenario: Volver desde el detalle de sprint
- **WHEN** un usuario visualiza `/projects/:projectId/sprints/:sprintId` y pulsa "volver"
- **THEN** el sistema navega a `/projects/:projectId/sprints`

#### Scenario: Volver desde el detalle de tarea
- **WHEN** un usuario visualiza `/projects/:projectId/tasks/:taskId` y pulsa "volver"
- **THEN** el sistema navega a `/projects/:projectId/tasks`