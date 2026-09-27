# Design — Harden Auth Security

## Context

WorkflowS authenticates via JWT tokens issued by an Express API (`src/server/index.ts`, `src/server/routes/auth.ts`). Today the JWT is returned in the response body and stored in `localStorage` on the client, then replayed via `Authorization: Bearer` headers on every request. Sessions last 24h and cannot be revoked: `/api/auth/logout` only clears client-side storage, expired tokens surface as `403` (so the client never auto-redirects), and public `/api/auth/register` accepts a client-chosen `role`. There is also no CSRF concern today (header auth) but it becomes one the moment we move to cookies.

The change hardens login, registration, session storage, and revocation without altering the visible login UX. The user has already approved the security report and the key trade-offs below.

## Goals / Non-Goals

**Goals:**
- Eliminate self-assigned role escalation through public registration.
- Stop storing session tokens in `localStorage` (mitigate XSS exfiltration).
- Support real session revocation on logout (and on user deactivation).
- Correct HTTP semantics so expired sessions redirect the client to login.
- Reduce email enumeration and response-timing side channels.
- Enforce a stronger password policy on all public/self-service creation paths.
- Harden JWT issuance (algorithm, issuer/audience/jti claims, no token on register).

**Non-Goals:**
- Multi-factor authentication, password reset flows, or account recovery.
- Per-account lockout or persistent (Redis/DB-backed) rate limiting — IP rate limiting already exists; per-account throttling is noted as a follow-up.
- Full zero-trust / token introspection service.
- Migrating existing sessions from `localStorage` to cookies one-by-one; the header fallback covers transition, then the fallback is removed.

## Decisions

### 1. Role escalation: registration always creates `TEAM_DEVELOPER`
`registerSchema` drops the `role` field entirely (ignores any client-supplied value). The conditional ADMIN block in `auth.ts:41` is deleted. Privileged roles remain assignable only via the ADMIN-protected `POST /api/users` (already gated by `requireSystemRole("ADMIN")`).
**Alternative considered:** keeping the field but whitelisting only `TEAM_DEVELOPER` — equivalent outcome; dropping the field removes the misleading API surface entirely and makes the intent explicit.

### 2. Session revocation via `tokenVersion` claim
Add `tokenVersion Int @default(0)` to the `User` model (Prisma migration). Each JWT embeds `v: user.tokenVersion` at issue time. `authenticateToken` verifies the signature and then loads the user by `userId`, requiring: user exists, `active == true`, and `decoded.v == user.tokenVersion`. Logout increments `tokenVersion` and clears the cookie, invalidating all of that user's existing tokens. Deactivation by an admin reuses the same mechanism (increment `tokenVersion` when deactivating).
**Alternative considered:** in-memory `jti` blacklist — rejected because it is lost on server restart and grows unboundedly; a DB-backed session store — rejected as overkill for this app's scale. The single-column `tokenVersion` is durable, simple, and also covers "deactivate user" with one update.

**Cost:** one indexed `User` lookup per protected request. Acceptable for this application; note in Risks.

### 3. HttpOnly cookie instead of `localStorage` token
Login sets `res.cookie("token", jwt, { httpOnly: true, sameSite: "lax", secure: NODE_ENV === "production", maxAge: 24h })` and no longer returns `token` in the body. The middleware reads `req.cookies.token` first and falls back to the `Authorization: Bearer` header (kept for transition and existing tests). `cookie-parser` is added. CORS flips to `credentials: true` with the existing explicit `CORS_ORIGINS` list (no wildcard).
**Alternative considered:** continue header auth but store in in-memory JS variable — loses persistence across refreshes; encrypted `localStorage` — still XSS-readable. HttpOnly cookie is the standard, non-JavaScript-readable option.
**Trade-off:** cookies require CSRF defense (see Decision 4) and change how the client attaches credentials. Login/register are backward incompatible (no token in body — marked BREAKING in the proposal).

### 4. CSRF: SameSite=Lax + Origin header verification
`SameSite=Lax` blocks cross-site POSTs from browsers while preserving top-level navigation (e.g., opening the app from a bookmark/link). As defense-in-depth, a small middleware rejects state-changing requests (POST/PUT/PATCH/DELETE) whose `Origin` or `Referer` is present but not in `CORS_ORIGINS`, responding `403`. Requests with neither header pass (curl/CLI/tests).
**Alternative considered:** `SameSite=Strict` alone — rejected because it can break legitimate top-level navigations; anti-CSRF tokens per session — more machinery than needed given SameSite + Origin validation cover the realistic attack surface.

### 5. Anti-enumeration and timing equalization
- Login always runs `bcrypt.compare`; when the user is missing it compares against a module-level dummy hash. Inactive users get the same `401` message as bad credentials.
- Registration runs a dummy `bcrypt.hash` on the duplicate-email path, keeping the existing "El email ya está registrado" message (approved trade-off: UX clarity over hiding existence).
This removes the main timing side channel (DB lookup + skip vs bcrypt) for both endpoints.

### 6. Password policy (server enforced)
Reusable Zod refinements applied to `registerSchema` and the `POST /api/users` body: length 8–72, at least one uppercase, one lowercase, one digit, and rejection of a small curated list of common passwords (`password`, `12345678`, etc.). Error messages in Spanish. No client-side duplication required, though the existing forms already surface server errors.
**Note:** `users.ts` PUT currently cannot change passwords — leaving that unchanged (non-goal), so the policy applies to the two creation paths.

### 7. JWT hardening and corrected 401 semantics
- `jwt.sign` moves to `{ algorithm: "HS256", expiresIn: "24h", issuer: "workflows-api", audience: "workflows-web", jwtid: randomUUID() }`; `authenticateToken` adds `issuer`/`audience` to `jwt.verify`.
- Invalid/missing/expired/version-mismatched tokens respond `401` with `WWW-Authenticate: Bearer` (was `403`/`401` mixed). The existing client handler in `api/client.ts` already redirects to `/login` on `401`.
- `/register` no longer issues a token (no implicit login), matching the frontend that already navigates to `/login` on success.
- Error logging on auth failures becomes generic (no `console.error("Error en login:", error)` internals).

## Risks / Trade-offs

- [Protected-request DB lookup adds latency] → Index exists on `User.id`; the lookup is a single record read; re-evaluate if profiling shows impact.
- [Cookie auth breaks clients/tests that read `localStorage.token` or send the `Authorization` header] → Header fallback is retained during transition; audit `e2e/` and `verification/` before removing it.
- [SameSite=Lax + Origin check could 403 legitimate tooling (curl without Origin is fine; some `fetch` from another origin would be) ] → `CORS_ORIGINS` is the single source of truth; document that any new frontend origin must be added there.
- [Secure cookie over plain HTTP in production would silently drop login] → Cookie `secure` is gated on `NODE_ENV=production`; deployment must serve HTTPS (already a documented requirement).
- [Deactivation now requires incrementing `tokenVersion`, not just flipping `active`] → Do both in the admin PUT handler (`users.ts`) so existing tokens die immediately.
- [Logout invalidates all of a user's sessions, not just the current one] → Accepted for this scope (revocation is "kill all sessions"); per-session `jti` blacklisting can refine later.

## Migration Plan

1. Add `tokenVersion` via `prisma migrate dev --name add_token_version`.
2. Install `cookie-parser` / `@types/cookie-parser`.
3. Backend changes first (auth route, middleware, CORS, CSRF) — old clients still work via header fallback.
4. Frontend changes (remove header injection, remove `localStorage.token` persistence).
5. Swap `registerSchema`/`users.ts` to the new password policy and drop `role` from registration.
6. Audit `e2e/` and `verification/`; update anything asserting on `localStorage.token` or login response `token`.
7. Remove the header fallback in a follow-up once all clients and tests are on cookies.

**Rollback:** revert the cookie/`tokenVersion` changes; restore token-in-body responses. The DB column is additive and harmless.