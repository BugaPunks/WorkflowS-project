# Proposal

## Why

La mensajería directa tiene dos huecos de autorización en `src/server/routes/chat.ts`:

1. `GET`/`POST /api/chat/conversation/:chatId/messages` solo exigen estar autenticado: no verifican que el usuario sea participante de la conversación. Cualquier usuario logueado que conozca un `chatId` puede leer DMs ajenos y escribir en ellos (disparando notificaciones a los participantes).
2. `GET /api/chat/user/:userId/all` compara la identidad del JWT contra un `userId` enviado por el cliente: si el `localStorage` guarda un id obsoleto, el usuario normal recibe `403` silencioso (y el ADMIN lo enmascara). El mismo patrón "Self or ADMIN con id del cliente" aparece en `users.ts` (`dashboard-summary`, `dashboard`).

Las rutas del chat grupal de proyecto ya usan `requireProjectRole`; las de DM por `chatId` se añadieron sin el check equivalente.

## What Changes

- **Middleware `requireChatParticipant`** (nuevo) aplicado a `GET` y `POST /api/chat/conversation/:chatId/messages`:
  - Chat inexistente → `404`.
  - `ADMIN` → bypass (consistente con el resto de la app).
  - `DIRECT` → solo participantes del chat.
  - `PROJECT` → solo miembros del proyecto (roles `TEAM_DEVELOPER`, `SCRUM_MASTER`, `PRODUCT_OWNER`).
  - Sin acceso → `403` (fail-closed). En el POST, la autorización precede a la creación del mensaje y a las notificaciones.
- **Identidad del JWT en "mis chats"**: `GET /api/chat/user/:userId/all` usa `req.user.userId` para no-admin (el parámetro se ignora); el parámetro solo es efectivo para `ADMIN`.
- **Mismo principio en `users.ts`**: `GET /api/users/:id/dashboard-summary` y `PUT /api/users/:id/dashboard` derivan la identidad "yo" del token para no-admin.
- **Tests**: `src/server/routes/chat.test.ts` (vitest) y `e2e/chat-authz.spec.ts`.

## Capabilities

### New Capabilities
<!-- Ninguna: la capability `chat-direct-messages` ya existe (archivada con fix-chat-widget-nonadmin). -->

### Modified Capabilities
- `chat-direct-messages`: se añade autorización por participación en los endpoints de conversación por id e identidad del token en "mis chats".
- `role-dashboard`: se añade la identidad del token en los endpoints de resumen de dashboard (`dashboard-summary` / `dashboard` en `users.ts`).

## Impact

- `src/server/middleware/chat-rbac.ts` (nuevo): middleware `requireChatParticipant`.
- `src/server/routes/chat.ts`: aplicar el middleware y derivar identidad del JWT.
- `src/server/routes/users.ts`: identidad del JWT en `dashboard-summary` y `dashboard`.
- `src/server/routes/chat.test.ts` (nuevo) y `e2e/chat-authz.spec.ts` (nuevo).