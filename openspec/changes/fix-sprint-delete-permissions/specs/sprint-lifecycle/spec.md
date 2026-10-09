# Spec Delta

## ADDED Requirements

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
