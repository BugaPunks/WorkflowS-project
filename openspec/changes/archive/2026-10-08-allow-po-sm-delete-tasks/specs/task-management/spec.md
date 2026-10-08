## ADDED Requirements

### Requirement: Autorización para eliminar tareas
El endpoint `DELETE /api/tasks/:id` SHALL autorizar la eliminación a usuarios con rol de sistema `ADMIN` (bypass), y a miembros del proyecto de la tarea con rol `PRODUCT_OWNER` o `SCRUM_MASTER`. Usuarios sin esas condiciones SHALL recibir respuesta `403`. Si la tarea no existe, no SHALL eliminarse nada.

#### Scenario: Product Owner elimina una tarea de su proyecto
- **WHEN** un usuario con membresía `PRODUCT_OWNER` en el proyecto de la tarea envía `DELETE /api/tasks/:id`
- **THEN** la tarea se elimina y la API responde con éxito

#### Scenario: Scrum Master elimina una tarea de su proyecto
- **WHEN** un usuario con membresía `SCRUM_MASTER` en el proyecto de la tarea envía `DELETE /api/tasks/:id`
- **THEN** la tarea se elimina y la API responde con éxito

#### Scenario: Admin elimina cualquier tarea
- **WHEN** un usuario con rol de sistema `ADMIN` envía `DELETE /api/tasks/:id` sin ser miembro del proyecto
- **THEN** la tarea se elimina (bypass de ADMIN)

#### Scenario: Developer recibe 403
- **WHEN** un usuario cuya única membresía es `TEAM_DEVELOPER` envía `DELETE /api/tasks/:id`
- **THEN** la API responde `403` y la tarea no se elimina

#### Scenario: No miembro recibe 403
- **WHEN** un usuario autenticado que no es miembro del proyecto de la tarea envía `DELETE /api/tasks/:id`
- **THEN** la API responde `403` y la tarea no se elimina

#### Scenario: Tarea inexistente no se elimina
- **WHEN** se envía `DELETE /api/tasks/:id` con un id que no existe
- **THEN** la API responde un error sin eliminar nada

### Requirement: Visibilidad condicional del botón de eliminar tarea
La página de tareas SHALL renderizar el botón "×" solo para usuarios que pueden eliminar: `ADMIN` del sistema, o `PRODUCT_OWNER`/`SCRUM_MASTER` en el proyecto de esa tarea. SHALL ocultarlo cuando los datos de membresía aún no estén disponibles (fail-closed).

#### Scenario: PO/SM ven el botón
- **WHEN** un PO o SM de un proyecto visualiza una tarea de ese proyecto
- **THEN** la tarjeta muestra el botón "×" y funciona

#### Scenario: Developer no ve el botón
- **WHEN** un usuario con membresía `TEAM_DEVELOPER` (o sin membresía) visualiza una tarea
- **THEN** la tarjeta no muestra el botón "×"

#### Scenario: Admin ve el botón sin depender de membresía
- **WHEN** un `ADMIN` del sistema visualiza una tarea de un proyecto del que no es miembro
- **THEN** la tarjeta muestra el botón "×"

#### Scenario: Proyectos aún no cargados
- **WHEN** la lista de proyectos del usuario aún no terminó de cargar y se renderiza una tarea
- **THEN** el botón "×" no se muestra

### Requirement: Mensaje de error específico al eliminar tarea
`handleDeleteTask` SHALL mostrar el error devuelto por la API (distinguiendo `403` sin permiso y el mensaje del cuerpo de la respuesta) en lugar de un mensaje genérico.

#### Scenario: Error 403 con mensaje claro
- **WHEN** la eliminación falla con `403` a pesar de la UI (petición forzada o sesión desactualizada)
- **THEN** la interfaz muestra un mensaje que indica falta de permiso, no "Error al eliminar tarea"

#### Scenario: Error del cuerpo de la respuesta
- **WHEN** la API responde con otro código de error que incluye un mensaje en el cuerpo
- **THEN** la interfaz muestra ese mensaje en lugar de un texto genérico