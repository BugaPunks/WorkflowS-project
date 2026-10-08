## ADDED Requirements

### Requirement: Desasignar historia de un sprint vía API
El endpoint `DELETE /api/sprints/:id/stories/:storyId` SHALL quitar la historia `:storyId` del sprint `:id` (poner su `sprintId` en `null`), y SHALL autorizarse a `SCRUM_MASTER` o `PRODUCT_OWNER` del proyecto del sprint (con bypass para `ADMIN`). Si la historia no existe o su `sprintId` no coincide con `:id`, la API SHALL responder `404` sin modificar nada.

#### Scenario: Product Owner quita una historia de su sprint
- **WHEN** un PO del proyecto del sprint envía `DELETE /api/sprints/:id/stories/:storyId` para una historia asignada a ese sprint
- **THEN** la historia queda con `sprintId = null`, vuelve al backlog y la API responde con éxito

#### Scenario: Scrum Master quita una historia de su sprint
- **WHEN** un SM del proyecto del sprint envía el mismo `DELETE`
- **THEN** la historia se desasigna y la API responde con éxito

#### Scenario: Administrador desasigna sin ser miembro
- **WHEN** un `ADMIN` (no miembro del proyecto) envía `DELETE /api/sprints/:id/stories/:storyId`
- **THEN** la historia se desasigna (bypass de ADMIN)

#### Scenario: Developer recibe 403
- **WHEN** un usuario cuya única membresía es `TEAM_DEVELOPER` envía el `DELETE`
- **THEN** la API responde `403` y la historia no se modifica

#### Scenario: Historia que no pertenece al sprint recibe 404
- **WHEN** se envía `DELETE` con un `storyId` que existe pero cuyo `sprintId` es distinto (o `null`)
- **THEN** la API responde `404` con mensaje de error y no modifica la historia

### Requirement: Drag & drop inverso en el detalle del proyecto
La página de detalle del proyecto SHALL permitir arrastrar una historia desde la lista de un sprint hacia la zona de Backlog para desasignarla, aplicando el mismo patrón optimista del movimiento inverso: actualización visual inmediata, llamado a `DELETE /api/sprints/:id/stories/:storyId`, y recarga de la página en caso de error.

#### Scenario: Arrastrar una historia del sprint al backlog
- **WHEN** el usuario arrastra una HU desde la tarjeta de un sprint y la suelta sobre la zona Backlog
- **THEN** la HU desaparece del sprint, aparece en el Backlog y queda persistido (`sprintId = null`)

#### Scenario: Error en la API revierte la vista
- **WHEN** el `DELETE` responde error
- **THEN** se muestra `alert(data.error)` y la página se recarga restaurando el estado anterior

#### Scenario: Movimientos sin destino válido no cambian nada
- **WHEN** el usuario arrastra una HU de un sprint pero la suelta fuera de la zona Backlog
- **THEN** no se modifica el estado ni se llama a la API