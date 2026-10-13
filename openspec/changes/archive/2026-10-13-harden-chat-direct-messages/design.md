# Design

## Context

Ver `proposal.md` — por qué. La mensajería directa por `chatId` no verifica participación (a diferencia del chat de proyecto, que usa `requireProjectRole`), y "mis chats" confía en un id enviado por el cliente. El mismo patrón "Self or ADMIN" con id del cliente existe en `users.ts` para el dashboard.

Restricciones: el bypass de `ADMIN` es la convención de la app (`requireProjectRole`, `dashboard-summary`, `user/:userId/all`); los flujos legítimos del widget solo abren conversaciones propias (lista `/user/:id/all` o `startDM`); los chats `PROJECT` pueden tener 0 participantes sembrados (así está en la BD actual), por lo que autorizar solo por participantes rompería el acceso legítimo.

## Goals / Non-Goals

**Goals:**
- Acceso fail-closed a mensajes por `chatId`: participante (`DIRECT`), miembro del proyecto (`PROJECT`) o `ADMIN`.
- Identidad "yo" derivada del JWT en `/user/:userId/all` y en los endpoints de dashboard de `users.ts`.
- Cobertura de tests (vitest con middleware real y prisma mockeado + e2e).

**Non-Goals:**
- Cambiar el contrato de las respuestas exitosas ni el esquema de datos.
- Tocar el RBAC de proyecto ni el chat grupal (ya cubierto por `requireProjectRole`).
- Cambiar el frontend (el widget sigue enviando `user.id` del `localStorage`; el servidor ya no depende de él).

## Decisions

### D1 — Middleware `requireChatParticipant` (fail-closed)

Nuevo `src/server/middleware/chat-rbac.ts`, usado por `GET`/`POST /api/chat/conversation/:chatId/messages`:

1. `prisma.chat.findUnique({ where: { id: chatId }, include: { participants: true } })` (cargar también `projectId`).
2. `!chat` → `404` (no revela existencia).
3. `req.user?.role === "ADMIN"` → `next()` (bypass explícito y consistente).
4. Según `chat.type`:
   - `DIRECT` → algún `participant.userId === req.user.userId`.
   - `PROJECT` → `prisma.projectMember.findUnique({ projectId: chat.projectId, userId })` con rol en `TEAM_DEVELOPER`/`SCRUM_MASTER`/`PRODUCT_OWNER`.
   - otro → `403`.
5. Sin acceso → `403`.

En el POST se aplica antes de crear el mensaje y de `notify()`: un no-autorizado no produce efectos secundarios.

Alternativa descartada: autorizar solo por `participants` incluso para `PROJECT` — rompe el acceso a chats de proyecto sin participantes sembrados.

### D3 — Identidad del JWT en "mis chats"

En `GET /api/chat/user/:userId/all`:

```ts
const isAdmin = req.user?.role === "ADMIN";
const effectiveUserId = isAdmin ? req.params.userId : req.user!.userId;
```

No-admin ignora el parámetro (sesiones `localStorage` obsoletas dejan de producir `403`); el parámetro solo es efectivo para `ADMIN`. Sin cambio de frontend.

### D4 — Mismo principio en `users.ts`

`GET /api/users/:id/dashboard-summary` y `PUT /api/users/:id/dashboard` sustituyen el check por identidad del token para no-admin: `const ownId = req.user!.role === "ADMIN" ? req.params.id : req.user!.userId;`. El frontend (`Dashboard.tsx`) manda `session.id` → continúa funcionando.

## Risks / Trade-offs

- [Romper algún flujo legítimo] → Los flujos del widget siempre son participante/miembro; cubierto por tests (unit + e2e).
- [Chat `PROJECT` con participantes pero sin membresía, o viceversa] → El check de `PROJECT` usa membresía del proyecto (fuente de verdad del RBAC), no participantes.
- [Coste de una query extra por request] → Una lectura indexada por `chatId`; aceptable frente al hueco de seguridad.
- [El requisito de dashboard vive en `role-dashboard`] → Cohabita con el resto de behavior del dashboard; el delta modifica solo lo necesario.