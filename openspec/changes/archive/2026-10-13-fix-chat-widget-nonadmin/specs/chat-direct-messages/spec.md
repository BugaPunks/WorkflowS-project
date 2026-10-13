# Spec Delta

## Purpose
Comportamiento de la mensajería directa entre usuarios: directorio para iniciar DMs, listado de "mis chats" y acceso a conversaciones por id.

## ADDED Requirements

### Requirement: Directorio de usuarios para iniciar un mensaje directo

`GET /api/chat/users` SHALL estar disponible para cualquier usuario autenticado y devolver los usuarios activos con `{ id, email, name, role }`, ordenados por nombre. La gestión de usuarios (`GET /api/users` y el resto de rutas admin de `/api/users`) SHALL seguir restringida a `ADMIN`.

#### Scenario: Cualquier usuario autenticado obtiene el directorio
- **WHEN** un usuario autenticado (no-admin) solicita `GET /api/chat/users`
- **THEN** la API responde `200` con la lista de usuarios activos y sus campos básicos

#### Scenario: Usuario anónimo no obtiene el directorio
- **WHEN** una petición sin token solicita `GET /api/chat/users`
- **THEN** la API responde `401`

### Requirement: Inicio de un mensaje directo desde el widget

El widget de mensajes SHALL listar los usuarios del directorio en su vista "Nuevo Mensaje" para cualquier usuario autenticado y permitir iniciar una conversación directa con cualquiera de ellos.

#### Scenario: Usuario no-admin inicia un DM
- **WHEN** un usuario `TEAM_DEVELOPER` abre el widget, pulsa "Nuevo Chat" y elige un usuario
- **THEN** la conversación directa se crea, se abre y puede enviar mensajes

### Requirement: Robustez de las llamadas del widget

Todas las llamadas del widget (`/api/chat/user/:userId/all`, `/api/chat/conversation/:chatId/messages` y `/api/chat/users`) SHALL comprobar `res.ok` antes de parsear el cuerpo; ante error SHALL dejar el estado correspondiente vacío y registrar el problema en consola, sin lanzar promesas no capturadas.

#### Scenario: Respuesta de error sin cuerpo JSON
- **WHEN** una llamada del widget responde `403`, `429` o `500` (cuerpo no JSON)
- **THEN** el widget no intenta parsear el cuerpo, registra el error y deja la lista o los mensajes vacíos