## ADDED Requirements

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
