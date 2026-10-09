## ADDED Requirements

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
