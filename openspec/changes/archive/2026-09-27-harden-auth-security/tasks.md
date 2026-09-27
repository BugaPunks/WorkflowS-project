## 1. Database and dependencies

- [x] 1.1 Add `tokenVersion Int @default(0)` to the `User` model in `prisma/schema.prisma`
- [x] 1.2 Run `prisma migrate dev --name add_token_version` and verify the generated migration
- [x] 1.3 Install `cookie-parser` and `@types/cookie-parser`, add to `package.json`

## 2. JWT issuance and session cookie (backend)

- [x] 2.1 Update `jwt.sign` in `src/server/routes/auth.ts` (login) to include `v`, `iss`, `aud`, `jti`, `expiresIn`, explicit `HS256`
- [x] 2.2 Set the `token` cookie on login with `httpOnly`, `SameSite=Lax`, `secure` in production, 24h `maxAge`; stop returning `token` in the login response body
- [x] 2.3 Do not issue a JWT or set a cookie in `/api/auth/register`; remove the token from its response
- [x] 2.4 Add `issuer`/`audience` verification to `jwt.verify` in `src/server/middleware/auth.ts`
- [x] 2.5 Load the user in `authenticateToken`, reject with `401` + `WWW-Authenticate` when user is missing, inactive, or `v` mismatch; read cookie first with header fallback

## 3. Anti-enumeration and timing (backend)

- [x] 3.1 In login, run `bcrypt.compare` against a dummy hash when the user is not found
- [x] 3.2 Return uniform `401` "Email o contraseña incorrectos" for unknown email, wrong password, and inactive user (remove the 403 deactivated branch)
- [x] 3.3 In register, run a dummy `bcrypt.hash` on the duplicate-email path before responding 400

## 4. Password policy

- [x] 4.1 Extract a reusable Zod password refinement (8-72 chars, upper+lower+digit, reject common passwords) into a shared module
- [x] 4.2 Apply the refinement to `registerSchema` in `src/server/routes/auth.ts`
- [x] 4.3 Apply the refinement to the admin user-creation body in `src/server/routes/users.ts`
- [x] 4.4 Remove the client-suppliable `role` from `registerSchema`; public registration always creates `TEAM_DEVELOPER` (fills gap in proposal "Eliminate role escalation" / specs user-registration)

## 5. CSRF and CORS

- [x] 5.1 Enable `credentials: true` in the CORS config in `src/server/index.ts`
- [x] 5.2 Mount `cookie-parser` in `src/server/index.ts`
- [x] 5.3 Add a CSRF middleware rejecting POST/PUT/PATCH/DELETE whose `Origin`/`Referer` is present but not in `CORS_ORIGINS` (403), applied before routes

## 6. Logout and deactivation revocation

- [x] 6.1 Increment `tokenVersion` and clear the `token` cookie in `/api/auth/logout`
- [x] 6.2 Increment `tokenVersion` when an admin deactivates a user in `src/server/routes/users.ts`

## 7. Frontend session handling

- [x] 7.1 Stop persisting/reading/clearing `token` in `src/hooks/useSession.tsx` (keep only `user`)
- [x] 7.2 Remove `Authorization` header injection and `localStorage` token reads in `src/api/client.ts` and `src/index.tsx`
- [x] 7.3 Ensure fetch calls use credentials (same-origin) so the cookie is sent

## 8. Error logging

- [x] 8.1 Replace `console.error("Error en login:", error)` with generic logging that omits request internals

## 9. Tests and verification

- [x] 9.1 Audit `e2e/` and `verification/` for assertions on `localStorage.token` or login/register response `token`; update to cookie-based flow
- [x] 9.2 Add/update tests covering: role ignored on register, uniform login 401, logout revocation, 401 on expired token, CSRF origin rejection
- [x] 9.3 Run `npx tsc --noEmit` and `npx biome check` and fix any issues
- [x] 9.4 Manually verify login, logout, and protected navigation via `npm run dev:all`