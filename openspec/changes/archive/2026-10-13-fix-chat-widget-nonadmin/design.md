# Design

## Context

Ver `proposal.md` — por qué. El widget listaba usuarios con `GET /api/users` (admin-only), lo que dejaba vacía la vista "Nuevo Mensaje" para roles no-admin. La solución base ya está implementada (`b3b266e`); aquí se documenta el diseño y queda una tarea frontend pendiente (`handleSend`).

Restricción relevante: `GET /api/users` y toda la gestión de usuarios deben seguir siendo de solo ADMIN (specs `user-management`). `src/server/routes/chat.ts` ya registra rutas por `chatId` y por `projectId`.

## Goals / Non-Goals

**Goals:**
- Que cualquier usuario autenticado pueda listar usuarios (proyección mínima) para iniciar un DM.
- Que el widget falle de forma visible y sin promesas no capturadas ante cualquier error HTTP.
- Verificación e2e del flujo no-admin completo.

**Non-Goals:**
- Modificar la gestión de usuarios (`/api/users` admin-only) ni el RBAC de proyecto.
- Autorización por participante en conversaciones (se aborda en el change `harden-chat-direct-messages`).
- Cambiar el contrato ni la base de datos.

## Decisions

### D1 — Directorio de usuarios acotado, no el de gestión

`GET /api/chat/users` como endpoint del router de chat (cualquier usuario autenticado), en lugar de abrir `GET /api/users` a todos. Devuelve `{ id, email, name, role }` de usuarios `active: true` ordenados por nombre.

- Alternativa descartada: relajar `GET /api/users` → expone la gestión admin (crear/editar/borrar) y datos innecesarios (active, createdAt) a cualquier rol.
- No hay conflicto de rutas: `/users` (un segmento) no choca con `/:projectId/messages` (dos segmentos) ni con las rutas de DM existentes.

### D2 — Guardas `res.ok` en el widget

`loadChats`, `loadMsgs` y `loadUsers` comprueban `res.ok` antes de `res.json()`; ante error loguean y dejan el estado vacío. Hoy un `403`/`429`/`500` con cuerpo no JSON hace que `res.json()` lance fuera de manejo.

### D3 — `handleSend` robusto (pendiente)

Verificar `res.ok` del `POST` antes de `setInput("")` y del refetch antes de `setMessages`. Mismo criterio que D2; sin cambios de contrato.

## Risks / Trade-offs

- [Exposición del directorio a cualquier autenticado] → Proyección mínima (`id/email/name/role`) y solo usuarios activos; sin datos sensibles (sin hash de password, active, createdAt).
- [E2E local necesita base SQLite] → `playwright.config.ts` fuerza Postgres por defecto; correr con `DATABASE_URL="file:./dev.db"` (preexistente, no de este change).
- [Riesgo bajo de regresión en chat] → Verificación: biome, tsc, vitest y e2e de chat completo (`e2e/chat-*`).