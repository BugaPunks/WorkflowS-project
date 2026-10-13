# Proposal

## Why

El widget de mensajes directos no funcionaba para usuarios no-admin: la vista "Nuevo Mensaje" listaba usuarios con `GET /api/users`, endpoint restringido a `ADMIN` (`requireSystemRole("ADMIN")` en `src/server/routes/users.ts`). Cualquier otro rol recibía `403`, la lista quedaba vacía y no podía iniciar un DM; con ADMIN funcionaba. El chat grupal de proyecto (`/api/chat/:projectId/messages` con `requireProjectRole`) siempre funcionó.

La solución ya está implementada en el commit `b3b266e`; este change la rastrea en OpenSpec y cierra una tarea menor pendiente de robustez en el frontend.

## What Changes

- **Nuevo endpoint `GET /api/chat/users`** accesible para cualquier usuario autenticado: devuelve usuarios activos con `{ id, email, name, role }` ordenados por nombre. `GET /api/users` (gestión) sigue siendo admin-only.
- **`ChatWidget.tsx`**: `loadUsers()` usa `/api/chat/users`; se añaden guardas `res.ok` en `loadChats`, `loadMsgs` y `loadUsers` para fallar de forma visible sin promesas no capturadas (ya implementado).
- **`handleSend`**: verificar `res.ok` en el `POST` y en el refetch inmediato antes de actualizar el estado (pendiente).
- **E2E** `e2e/chat-widget-nonadmin.spec.ts`: un `TEAM_DEVELOPER` inicia un DM y envía un mensaje (ya implementado).

## Capabilities

### New Capabilities
- `chat-direct-messages`: comportamiento de la mensajería directa — directorio de usuarios para iniciar DMs, listado de "mis chats" y acceso a conversaciones por id.

### Modified Capabilities
<!-- Ninguna: aún no existe capability de chat en el inventario (verificado con `openspec list --specs`). -->

## Impact

- `src/server/routes/chat.ts`: nuevo endpoint GET `/users`.
- `src/components/ChatWidget.tsx`: directorio de usuarios y guardas `res.ok`; ajuste en `handleSend`.
- `e2e/chat-widget-nonadmin.spec.ts`: test nuevo.
- Sin cambios en `src/server/routes/users.ts` (gestión admin intacta).