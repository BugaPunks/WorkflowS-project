# Sprint lifecycle Capability

## Purpose

Governs the lifecycle of a sprint —starting and completing it— both in its API contract (authorization, state transitions, notifications) and in the UI controls that trigger those transitions.

## Requirements

### Requirement: Actualización del estado del sprint vía API
El endpoint `PUT /api/sprints/:id` SHALL permitir cambiar el `status` del sprint a miembros del proyecto con rol `PRODUCT_OWNER` o `SCRUM_MASTER`, y a `ADMIN` del sistema (bypass). Al pasar un sprint a `COMPLETED` desde un estado distinto, la API SHALL notificar a todos los miembros del proyecto con tipo `SPRINT_COMPLETED`; si ya estaba `COMPLETED`, no SHALL volver a notificar. Si el sprint no existe, no SHALL modificarse nada.

#### Scenario: Scrum Master inicia el sprint
- **WHEN** un `SCRUM_MASTER` del proyecto envía `PUT /api/sprints/:id` con `status: "ACTIVE"`
- **THEN** el sprint queda `ACTIVE` y la API responde con éxito

#### Scenario: Product Owner completa el sprint
- **WHEN** un `PRODUCT_OWNER` del proyecto envía `PUT /api/sprints/:id` con `status: "COMPLETED"`
- **THEN** el sprint queda `COMPLETED` y la API responde con éxito

#### Scenario: Completar un sprint notifica a los miembros
- **WHEN** un sprint pasa a `COMPLETED` desde un estado distinto
- **THEN** se envía una notificación `SPRINT_COMPLETED` por cada miembro del proyecto

#### Scenario: Completar un sprint ya completado no re-notifica
- **WHEN** se envía `status: "COMPLETED"` a un sprint que ya estaba `COMPLETED`
- **THEN** el sprint permanece `COMPLETED` y no se envían nuevas notificaciones

#### Scenario: Developer recibe 403
- **WHEN** un usuario cuya única membresía es `TEAM_DEVELOPER` envía `PUT /api/sprints/:id`
- **THEN** la API responde `403` y el sprint no se modifica

#### Scenario: Admin actualiza sin ser miembro
- **WHEN** un `ADMIN` del sistema envía `PUT /api/sprints/:id` sin ser miembro del proyecto
- **THEN** el estado se actualiza (bypass de ADMIN)

#### Scenario: Sprint inexistente no se modifica
- **WHEN** se envía `PUT /api/sprints/:id` con un id que no existe
- **THEN** la API responde un error sin modificar nada

### Requirement: Controles de inicio y finalización en el detalle del proyecto
La página de detalle del proyecto SHALL mostrar un control para iniciar el sprint cuando su estado sea `PLANNING` o `PLANNED`, y un control para completarlo cuando su estado sea `ACTIVE`. Ambos controles SHALL mostrarse solo a usuarios que gestionan el proyecto (`OWNER`/`LEAD`/`SCRUM_MASTER`/`PRODUCT_OWNER`, o `ADMIN` del sistema). Un sprint `COMPLETED` no SHALL mostrar ninguno de los dos controles.

#### Scenario: SM/PO inician un sprint en planificación
- **WHEN** un `SCRUM_MASTER` o `PRODUCT_OWNER` visualiza un sprint en `PLANNING` y pulsa "Iniciar Sprint"
- **THEN** se envía `PUT` con `status: "ACTIVE"`, el sprint pasa a `ACTIVE` y la UI refleja el nuevo estado

#### Scenario: SM/PO completan un sprint activo
- **WHEN** un usuario que gestiona el proyecto visualiza un sprint `ACTIVE` y pulsa "Completar Sprint" y confirma
- **THEN** se envía `PUT` con `status: "COMPLETED"` y el sprint queda `COMPLETED`

#### Scenario: No se muestran controles a un developer
- **WHEN** un usuario con membresía `TEAM_DEVELOPER` visualiza un sprint
- **THEN** no se muestran ni "Iniciar Sprint" ni "Completar Sprint"

#### Scenario: Un sprint completado no ofrece acciones
- **WHEN** un sprint está `COMPLETED`
- **THEN** no se muestran "Iniciar Sprint" ni "Completar Sprint"

### Requirement: Confirmación y feedback al completar un sprint
Al accionar "Completar Sprint" la UI SHALL pedir confirmación (advirtiendo si quedan tareas sin completar en el sprint) antes de enviar la actualización. Ante éxito SHALL recargar los datos; ante error SHALL mostrar el mensaje devuelto por la API sin dejar la vista en un estado inconsistente.

#### Scenario: Confirmación previa al completar
- **WHEN** el usuario pulsa "Completar Sprint"
- **THEN** se muestra un `confirm()` antes de enviar la petición; si cancela, no se envía nada

#### Scenario: Aviso por tareas pendientes
- **WHEN** el sprint tiene tareas con estado distinto de `COMPLETED`
- **THEN** el mensaje de confirmación indica cuántas tareas quedan sin completar

#### Scenario: Error de la API
- **WHEN** la actualización falla
- **THEN** se muestra el mensaje de error de la API y el estado visible no cambia

### Requirement: Autorización para eliminar sprints
El endpoint `DELETE /api/sprints/:id` SHALL autorizar la eliminación a miembros del proyecto del sprint con rol `PRODUCT_OWNER` o `SCRUM_MASTER`, y a usuarios con rol de sistema `ADMIN` (bypass). Usuarios sin esas condiciones SHALL recibir respuesta `403`. Si el sprint no existe, no SHALL eliminarse nada.

#### Scenario: Product Owner elimina un sprint de su proyecto
- **WHEN** un usuario con membresía `PRODUCT_OWNER` en el proyecto del sprint envía `DELETE /api/sprints/:id`
- **THEN** el sprint se elimina y la API responde con éxito

#### Scenario: Scrum Master elimina un sprint de su proyecto
- **WHEN** un usuario con membresía `SCRUM_MASTER` en el proyecto del sprint envía `DELETE /api/sprints/:id`
- **THEN** el sprint se elimina y la API responde con éxito

#### Scenario: Admin elimina cualquier sprint
- **WHEN** un usuario con rol de sistema `ADMIN` envía `DELETE /api/sprints/:id` sin ser miembro del proyecto
- **THEN** el sprint se elimina (bypass de ADMIN)

#### Scenario: Developer recibe 403
- **WHEN** un usuario cuya única membresía es `TEAM_DEVELOPER` envía `DELETE /api/sprints/:id`
- **THEN** la API responde `403` y el sprint no se elimina

#### Scenario: No miembro recibe 403
- **WHEN** un usuario autenticado que no es miembro del proyecto del sprint envía `DELETE /api/sprints/:id`
- **THEN** la API responde `403` y el sprint no se elimina

#### Scenario: Sprint inexistente no se elimina
- **WHEN** se envía `DELETE /api/sprints/:id` con un id que no existe
- **THEN** la API responde un error sin eliminar nada

### Requirement: Visibilidad condicional del botón de eliminar sprint
La página de Sprints SHALL renderizar el botón "Eliminar" solo para usuarios que pueden eliminar el sprint: `ADMIN` del sistema, o `PRODUCT_OWNER`/`SCRUM_MASTER` en el proyecto de ese sprint. SHALL ocultarlo cuando los datos de membresía aún no estén disponibles (fail-closed).

#### Scenario: PO/SM ven el botón
- **WHEN** un PO o SM del proyecto de un sprint visualiza ese sprint
- **THEN** la tarjeta muestra el botón "Eliminar" y funciona

#### Scenario: Developer no ve el botón
- **WHEN** un usuario con membresía `TEAM_DEVELOPER` (o sin membresía) visualiza un sprint
- **THEN** la tarjeta no muestra el botón "Eliminar"

#### Scenario: Admin ve el botón sin depender de membresía
- **WHEN** un `ADMIN` del sistema visualiza un sprint de un proyecto del que no es miembro
- **THEN** la tarjeta muestra el botón "Eliminar"

#### Scenario: Membresías aún no cargadas
- **WHEN** la lista de proyectos del usuario aún no terminó de cargar y se renderiza un sprint
- **THEN** el botón "Eliminar" no se muestra (no se permite una acción que fallaría)

### Requirement: Mensaje de error específico al eliminar sprint
`handleDeleteSprint` SHALL mostrar el error devuelto por la API, distinguiendo el `403` con un mensaje que indique falta de permiso, en lugar del texto crudo de la respuesta o de un mensaje genérico.

#### Scenario: Error 403 con mensaje claro
- **WHEN** la eliminación falla con `403` a pesar de la UI (petición forzada o sesión desactualizada)
- **THEN** la interfaz muestra un mensaje que indica falta de permiso, no "Forbidden"

#### Scenario: Error del cuerpo de la respuesta
- **WHEN** la API responde con otro código de error que incluye un mensaje en el cuerpo
- **THEN** la interfaz muestra ese mensaje en lugar de un texto genérico
