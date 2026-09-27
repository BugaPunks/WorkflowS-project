# Harden Auth Security

## Why

The authentication flow has several security weaknesses: public registration lets users self-assign privileged roles (`PRODUCT_OWNER`, `SCRUM_MASTER`, even `ADMIN` under certain env flags), JWT tokens live in `localStorage` (exposed to any XSS) and remain valid for 24h with no way to revoke them, expired tokens are misreported as 403 instead of 401 so sessions never expire cleanly on the client, and login/register responses leak user existence through timing and error messages. This change hardens the auth surface without changing the user-facing login experience.

## What Changes

- **Eliminate role escalation**: public `/api/auth/register` ignores the client-supplied `role` field and always creates `TEAM_DEVELOPER` users. Privileged roles are only assignable by an ADMIN through the protected `/api/users` endpoints.
- **Uniform login responses (anti-enumeration)**: `/api/auth/login` returns the same `401 "Email o contraseña incorrectos"` for unknown email, wrong password, and deactivated user, and always runs `bcrypt.compare` against a dummy hash to equalize timing.
- **Equalize registration timing**: `/api/auth/register` performs a dummy `bcrypt.hash` on the duplicate-email path (message "El email ya está registrado" is preserved).
- **Session revocation**: add `tokenVersion` to the `User` model; JWTs carry a version claim and the auth middleware re-validates against the DB (version + `active`) on every protected request. `/api/auth/logout` increments `tokenVersion` and clears the auth cookie, invalidating all of that user's sessions.
- **Cookie-based auth (HttpOnly)**: the JWT is delivered in an `httpOnly`, `SameSite=Lax`, `secure`-in-prod cookie instead of `localStorage`. Frontend stops reading/sending the token from storage. The `Authorization` header is kept as a fallback for transition and tests.
- **CSRF protection**: a middleware validates the `Origin`/`Referer` header against `CORS_ORIGINS` on state-changing requests (complementing `SameSite=Lax`).
- **Expired/invalid token handling**: the auth middleware returns `401` with `WWW-Authenticate` (not `403`) for missing/invalid/expired tokens; the client already redirects to `/login` on 401.
- **Password policy**: strong validation (min 8, max 72, uppercase + lowercase + digit, rejection of common passwords) on register and admin user creation.
- **JWT hardening**: explicit `HS256`, `issuer`, `audience`, `jti` claims; `/register` no longer issues a token (no implicit login); generic error logging without internals.
- **BREAKING**: JWTs are no longer returned in login/register response bodies and are no longer stored client-side. Any caller relying on the raw token or `localStorage.token` must migrate to cookie-based auth.

## Capabilities

### New Capabilities
- `user-auth`: Authentication flow — login, logout, session revocation via `tokenVersion`, cookie-based JWT delivery, CSRF protection, and uniform anti-enumeration responses.
- `user-registration`: Public self-registration — always creates `TEAM_DEVELOPER`, never trusts client-supplied roles, enforces the password policy, and equalizes timing on duplicates.

### Modified Capabilities

## Impact

- **Backend**: `src/server/routes/auth.ts` (login/register/logout), `src/server/middleware/auth.ts` (token verification + version/active checks), `src/server/index.ts` (CORS credentials, CSRF middleware, cookie-parser).
- **Frontend**: `src/hooks/useSession.tsx` (stop persisting token), `src/api/client.ts` and `src/index.tsx` (remove `Authorization` header injection), `src/auth/LoginForm.tsx` / `LoginSuccess.tsx` (no token storage expectations).
- **Database**: `User.tokenVersion` column — requires a Prisma migration.
- **Dependencies**: add `cookie-parser` (+ `@types/cookie-parser`); remove reliance on `localStorage` token.
- **Tests**: audit `e2e/` and `verification/` for assumptions about `localStorage.token` or the `Authorization` header.