# Tasks

## 1. Backend — directorio de usuarios para DMs

- [x] 1.1 Crear `GET /api/chat/users` en `src/server/routes/chat.ts`: cualquier usuario autenticado, `where { active: true }`, `select { id, email, name, role }`, `orderBy { name: "asc" }`. Verificar manualmente con un token no-admin: `200` con el directorio.
- [x] 1.2 Confirmar que `GET /api/users` sigue admin-only (`requireSystemRole("ADMIN")` en `src/server/routes/users.ts`) sin cambios.

## 2. Frontend — widget

- [x] 2.1 En `src/components/ChatWidget.tsx`, `loadUsers()` consume `/api/chat/users`.
- [x] 2.2 Añadir guardas `res.ok` en `loadChats`, `loadMsgs` y `loadUsers` (loguear y dejar estado vacío en error; sin `res.json()` sobre cuerpos no JSON).
- [x] 2.3 En `handleSend`, comprobar `res.ok` del `POST` antes de `setInput("")`, y del refetch inmediato antes de `setMessages`; en error loguear sin actualizar el estado.

## 3. Tests

- [x] 3.1 Crear `e2e/chat-widget-nonadmin.spec.ts`: un `TEAM_DEVELOPER` abre el widget, pulsa "Nuevo Chat", ve el directorio, inicia un DM y envía un mensaje (`Hello from non-admin` visible).
- [x] 3.2 Verificación final: `npm run check`, `npx tsc --noEmit`, `npm run test` y `DATABASE_URL="file:./dev.db" npx playwright test e2e/chat-widget-nonadmin.spec.ts` en verde.

## Workflow follow-up

- Archivar el change con `openspec archive fix-chat-widget-nonadmin` (sincroniza la capability `chat-direct-messages` a `openspec/specs/`).
- Después proponer el change `harden-chat-direct-messages` (autorización de conversaciones), que usará `## MODIFIED Requirements` sobre la misma capability.