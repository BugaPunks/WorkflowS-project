## ADDED Requirements

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
