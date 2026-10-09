# User story management Capability

## Purpose

Governs how user stories are created, updated, prioritized and deleted across roles, including who may delete a story, how the UI surfaces that permission, and how errors are reported to the user.

## Requirements

### Requirement: Autorización para eliminar historias de usuario
El endpoint `DELETE /api/user-stories/:id` SHALL autorizar la eliminación a usuarios con rol de sistema `ADMIN` (bypass), y a miembros del proyecto de la historia con rol `PRODUCT_OWNER` o `SCRUM_MASTER`. Usuarios sin esas condiciones SHALL recibir respuesta `403`.

#### Scenario: Product Owner elimina una historia de su proyecto
- **WHEN** un usuario con membresía `PRODUCT_OWNER` en el proyecto de la historia envía `DELETE /api/user-stories/:id`
- **THEN** la historia se elimina y la API responde con éxito

#### Scenario: Scrum Master elimina una historia de su proyecto
- **WHEN** un usuario con membresía `SCRUM_MASTER` en el proyecto de la historia envía `DELETE /api/user-stories/:id`
- **THEN** la historia se elimina y la API responde con éxito

#### Scenario: Admin docente elimina cualquier historia
- **WHEN** un usuario con rol de sistema `ADMIN` envía `DELETE /api/user-stories/:id` sin ser miembro del proyecto
- **THEN** la historia se elimina (bypass de ADMIN)

#### Scenario: Developer sin rol de gestión recibe 403
- **WHEN** un usuario cuya única membresía en el proyecto es `TEAM_DEVELOPER` envía `DELETE /api/user-stories/:id`
- **THEN** la API responde `403` y la historia no se elimina

#### Scenario: No miembro recibe 403
- **WHEN** un usuario autenticado que no es miembro del proyecto de la historia envía `DELETE /api/user-stories/:id`
- **THEN** la API responde `403` y la historia no se elimina

### Requirement: Visibilidad condicional del botón de eliminación
La página de historias de usuario SHALL renderizar el botón "Eliminar" solo para usuarios que pueden eliminar: `ADMIN` del sistema, o `PRODUCT_OWNER`/`SCRUM_MASTER` en el proyecto de esa historia. SHALL ocultarlo cuando los datos de membresía aún no estén disponibles (fail-closed).

#### Scenario: Product Owner ve el botón
- **WHEN** un PO de un proyecto visualiza una historia de ese proyecto
- **THEN** la tarjeta muestra el botón "Eliminar" y funciona

#### Scenario: Developer no ve el botón
- **WHEN** un usuario con membresía `TEAM_DEVELOPER` (o sin membresía) visualiza una historia
- **THEN** la tarjeta no muestra el botón "Eliminar"

#### Scenario: Admin ve el botón sin depender de membresía
- **WHEN** un `ADMIN` del sistema visualiza una historia de un proyecto del que no es miembro
- **THEN** la tarjeta muestra el botón "Eliminar"

#### Scenario: Membresías aún no cargadas
- **WHEN** la lista de proyectos del usuario aún no terminó de cargar y se renderiza una historia
- **THEN** el botón "Eliminar" no se muestra (no se permite una acción que fallaría)

### Requirement: Mensaje de error específico al eliminar
`handleDeleteStory` SHALL mostrar el error devuelto por la API (distinguiendo `403` sin permiso y el mensaje del cuerpo de la respuesta) en lugar de un mensaje genérico.

#### Scenario: Error 403 con mensaje claro
- **WHEN** la eliminación falla con `403` a pesar de la UI (petición forzada o sesión desactualizada)
- **THEN** la interfaz muestra un mensaje que indica falta de permiso, no "Error al eliminar historia"

#### Scenario: Error del cuerpo de la respuesta
- **WHEN** la API responde con otro código de error que incluye un mensaje en el cuerpo
- **THEN** la interfaz muestra ese mensaje en lugar de un texto genérico

### Requirement: Actualización del estado de la historia vía API
El endpoint `PUT /api/user-stories/:id` SHALL permitir cambiar el `status` de una historia de usuario a miembros del proyecto con rol `PRODUCT_OWNER` o `SCRUM_MASTER`, y a `ADMIN` del sistema (bypass). Al pasar el estado a `COMPLETED` o `DONE`, la API SHALL establecer `completedAt`; al pasar a `BACKLOG` o `TODO`, la API SHALL limpiar `completedAt`. Usuarios sin esos roles SHALL recibir `403`, y si la historia no existe no SHALL modificarse nada.

#### Scenario: Product Owner completa una historia
- **WHEN** un `PRODUCT_OWNER` del proyecto envía `PUT /api/user-stories/:id` con `status: "COMPLETED"`
- **THEN** la historia queda `COMPLETED` con `completedAt` establecido y la API responde con éxito

#### Scenario: Scrum Master reabre una historia
- **WHEN** un `SCRUM_MASTER` del proyecto envía `PUT /api/user-stories/:id` con `status: "BACKLOG"`
- **THEN** la historia queda `BACKLOG` con `completedAt` en `null` y la API responde con éxito

#### Scenario: Admin actualiza sin ser miembro
- **WHEN** un `ADMIN` del sistema envía `PUT /api/user-stories/:id` sin ser miembro del proyecto
- **THEN** el estado se actualiza (bypass de ADMIN)

#### Scenario: Developer recibe 403
- **WHEN** un usuario cuya única membresía es `TEAM_DEVELOPER` envía `PUT /api/user-stories/:id`
- **THEN** la API responde `403` y la historia no se modifica

#### Scenario: No miembro recibe 403
- **WHEN** un usuario autenticado que no es miembro del proyecto de la historia envía `PUT /api/user-stories/:id`
- **THEN** la API responde `403` y la historia no se modifica

#### Scenario: Historia inexistente no se modifica
- **WHEN** se envía `PUT /api/user-stories/:id` con un id que no existe
- **THEN** la API responde un error sin modificar nada

### Requirement: Control de cambio de estado en la página de historias
La página de historias de usuario SHALL mostrar en cada tarjeta un control para alternar el estado de la historia entre `BACKLOG` y `COMPLETED`. El control SHALL mostrarse solo a usuarios que pueden usarlo: `ADMIN` del sistema, o `PRODUCT_OWNER`/`SCRUM_MASTER` en el proyecto de esa historia; SHALL ocultarse mientras los datos de membresía aún no estén disponibles (fail-closed). Al cambiar el estado, la página SHALL enviar `PUT /api/user-stories/:id` con el nuevo `status` y recargar la lista ante éxito; ante error SHALL mostrar el mensaje devuelto por la API, distinguiendo `403` sin permiso.

#### Scenario: PO/SM cambian el estado de una historia
- **WHEN** un PO o SM de un proyecto selecciona "Completada" (o "Backlog") en una historia de ese proyecto
- **THEN** se envía `PUT` con el `status` correspondiente, la historia refleja el nuevo estado y la lista se recarga

#### Scenario: Developer no ve el control
- **WHEN** un usuario con membresía `TEAM_DEVELOPER` (o sin membresía) visualiza una historia
- **THEN** la tarjeta no muestra el control de estado

#### Scenario: Admin ve el control sin depender de membresía
- **WHEN** un `ADMIN` del sistema visualiza una historia de un proyecto del que no es miembro
- **THEN** la tarjeta muestra el control de estado

#### Scenario: Membresías aún no cargadas
- **WHEN** la lista de proyectos del usuario aún no terminó de cargar y se renderiza una historia
- **THEN** el control de estado no se muestra (no se permite una acción que fallaría)

#### Scenario: Error 403 con mensaje claro
- **WHEN** el cambio de estado falla con `403` a pesar de la UI (petición forzada o sesión desactualizada)
- **THEN** la interfaz muestra un mensaje que indica falta de permiso, no un error genérico

#### Scenario: Error del cuerpo de la respuesta
- **WHEN** la API responde con otro código de error que incluye un mensaje en el cuerpo
- **THEN** la interfaz muestra ese mensaje en lugar de un texto genérico

### Requirement: Visibilidad del badge de estado en la página de historias
La página de historias de usuario SHALL ocultar el badge de estado de una historia cuando el usuario puede gestionarla —es decir, cuando ve el selector de estado (`ADMIN` del sistema, o `PRODUCT_OWNER`/`SCRUM_MASTER` en el proyecto de la historia)—. El badge de estado SHALL mostrarse únicamente a los usuarios que no pueden gestionar la historia. Cuando los datos de membresía aún no estén disponibles (fail-closed) el selector no se muestra, por lo que el badge SHALL mostrarse.

#### Scenario: Manager ve el selector y no el badge
- **WHEN** un PO/SM del proyecto (o un `ADMIN`) visualiza una historia
- **THEN** la tarjeta muestra el selector de estado y **no** muestra el badge de estado

#### Scenario: Developer ve el badge y no el selector
- **WHEN** un usuario con membresía `TEAM_DEVELOPER` (o sin membresía) visualiza una historia
- **THEN** la tarjeta muestra el badge de estado y **no** muestra el selector de estado

#### Scenario: Membresías aún no cargadas
- **WHEN** la lista de proyectos del usuario aún no terminó de cargar y se renderiza una historia
- **THEN** el badge de estado se muestra y el selector no (fail-closed)

### Requirement: Color del selector de estado
El selector de estado de la página de historias SHALL reflejar visualmente el estado de la historia mediante color: verde cuando la historia está `COMPLETED` y gris para cualquier otro estado. El color SHALL derivarse del mismo valor normalizado que el selector muestra, de modo que coincida con la opción seleccionada.

#### Scenario: Selector verde para historia completada
- **WHEN** una historia está `COMPLETED` y el usuario ve el selector de estado
- **THEN** el selector se muestra en verde (distinto del estado no completado)

#### Scenario: Selector gris para historia en backlog
- **WHEN** una historia está `BACKLOG` (o cualquier estado no `COMPLETED`) y el usuario ve el selector
- **THEN** el selector se muestra en gris
