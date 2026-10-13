# Spec Delta

## ADDED Requirements

### Requirement: Acceso a mensajes de una conversación por id

`GET /api/chat/conversation/:chatId/messages` SHALL devolver los mensajes solo si el usuario autenticado es participante de la conversación (tipo `DIRECT`), miembro del proyecto (tipo `PROJECT`, con rol `TEAM_DEVELOPER`, `SCRUM_MASTER` o `PRODUCT_OWNER`) o `ADMIN` del sistema. En cualquier otro caso SHALL responder `403` sin revelar si el chat existe; si el chat no existe SHALL responder `404`.

#### Scenario: Participante lee su conversación
- **WHEN** un participante solicita `GET /api/chat/conversation/:id/messages`
- **THEN** la API responde `200` con los mensajes de la conversación

#### Scenario: No participante recibe 403
- **WHEN** un usuario que no es participante, ni miembro del proyecto ni `ADMIN` solicita los mensajes de un DM ajeno
- **THEN** la API responde `403` sin devolver ningún mensaje

#### Scenario: Miembro del proyecto accede al chat del proyecto
- **WHEN** un miembro del proyecto (rol `TEAM_DEVELOPER`, `SCRUM_MASTER` o `PRODUCT_OWNER`) solicita los mensajes de la conversación `PROJECT` de ese proyecto
- **THEN** la API responde `200` con los mensajes

#### Scenario: ADMIN accede a cualquier conversación
- **WHEN** un usuario con rol `ADMIN` solicita los mensajes de cualquier conversación
- **THEN** la API responde `200` con los mensajes

#### Scenario: Conversación inexistente
- **WHEN** se solicita una conversación cuyo `chatId` no existe
- **THEN** la API responde `404`

### Requirement: Envío de mensaje a una conversación por id

`POST /api/chat/conversation/:chatId/messages` SHALL crear el mensaje (y emitir notificaciones a los demás participantes) solo si el usuario autenticado es participante de la conversación, miembro del proyecto o `ADMIN`; en caso contrario SHALL responder `403` sin crear mensaje ni emitir notificaciones (fail-closed).

#### Scenario: Participante envía y notifica
- **WHEN** un participante envía un mensaje a su conversación
- **THEN** la API responde `201`, el mensaje se crea y los demás participantes reciben una notificación

#### Scenario: No participante no puede enviar
- **WHEN** un usuario no autorizado intenta `POST` a una conversación ajena
- **THEN** la API responde `403`, no se crea mensaje y no se emiten notificaciones

### Requirement: Listado de "mis chats" con identidad del token

`GET /api/chat/user/:userId/all` SHALL devolver para un usuario no-admin SIEMPRE los chats del usuario autenticado (identidad derivada del JWT, ignorando el parámetro de ruta); para `ADMIN`, el parámetro SHALL seleccionar el usuario consultado. Un no-admin con un parámetro de otro usuario SHALL recibir `200` con sus propios chats y nunca `403` por desajuste de id.

#### Scenario: No-admin con su propio id
- **WHEN** un usuario no-admin solicita `/api/chat/user/<su id>/all`
- **THEN** la API responde `200` con sus conversaciones

#### Scenario: No-admin con id de otro usuario
- **WHEN** un usuario no-admin solicita `/api/chat/user/<id de otro>/all`
- **THEN** la API responde `200` con sus propias conversaciones (el parámetro se ignora)

#### Scenario: ADMIN consulta los chats de otro
- **WHEN** un `ADMIN` solicita `/api/chat/user/<id de otro>/all`
- **THEN** la API responde `200` con las conversaciones de ese usuario