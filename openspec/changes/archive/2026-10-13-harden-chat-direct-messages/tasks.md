# Tasks

## 1. Backend — autorización de conversaciones

- [x] 1.1 Crear `src/server/middleware/chat-rbac.ts` con `requireChatParticipant`: carga el chat con `participants` y `projectId`; `404` si no existe; bypass `ADMIN`; `DIRECT` → participante; `PROJECT` → miembro del proyecto (roles `TEAM_DEVELOPER`, `SCRUM_MASTER`, `PRODUCT_OWNER`); sin acceso → `403`.
- [x] 1.2 Aplicar `requireChatParticipant` a `GET /api/chat/conversation/:chatId/messages`.
- [x] 1.3 Aplicar `requireChatParticipant` a `POST /api/chat/conversation/:chatId/messages` (la autorización precede a la creación del mensaje y a `notify()`).

## 2. Backend — identidad del JWT

- [x] 2.1 En `GET /api/chat/user/:userId/all`, derivar `effectiveUserId` del JWT para no-admin (el parámetro solo es efectivo para `ADMIN`).
- [x] 2.2 En `src/server/routes/users.ts`, `GET /api/users/:id/dashboard-summary` y `PUT /api/users/:id/dashboard`: usar `req.user.userId` para no-admin (parámetro solo efectivo para `ADMIN`).

## 3. Tests

- [x] 3.1 Crear `src/server/routes/chat.test.ts` (vitest, prisma mockeado, middlewares auth/chat-rbac reales, patrón `sprints-lifecycle.test.ts`): participante `200`; no-participante `403` en GET y POST (sin crear mensaje ni notificar); `ADMIN` bypass; chat inexistente `404`; `PROJECT` miembro `200` / no-miembro `403`; `/user/:id/all` con parámetro ajeno → no-admin `200` con sus chats; `ADMIN` con parámetro de otro → chats de ese usuario.
- [x] 3.2 Crear `src/server/routes/users-dashboard.test.ts` (`dashboard-summary` y `dashboard`): no-admin con id propio `200`; no-admin con id ajeno `200` con sus datos; `ADMIN` con id ajeno `200` con los datos del otro.
- [x] 3.3 Crear `e2e/chat-authz.spec.ts` (vía `request` de Playwright y la API): un no-participante recibe `403` en GET y POST de una conversación ajena; participante/`ADMIN` recibe `200`; chat inexistente `404`; un no-admin lista sus chats aunque el path lleve el id de otro usuario.

## 4. Verificación

- [x] 4.1 `npm run check`, `npx tsc --noEmit` y `npm run test` en verde.
- [x] 4.2 `DATABASE_URL="file:./dev.db" npx playwright test e2e/chat-* e2e/chat-authz.spec.ts` en verde (sin regresiones en DMs ni en el widget).

## Workflow follow-up

- Archivar el change con `openspec archive harden-chat-direct-messages --yes` (sincroniza deltas a `openspec/specs/`).