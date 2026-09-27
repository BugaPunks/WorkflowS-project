## ADDED Requirements

### Requirement: Login response is uniform across failure modes
The `/api/auth/login` endpoint SHALL return the same `401` response with body `{"error": "Email o contraseña incorrectos"}` when the email is unknown, the password is incorrect, or the user is deactivated. The server SHALL execute `bcrypt.compare` against a dummy hash when the user is not found so that response timing does not reveal whether an email is registered.

#### Scenario: Login with unknown email
- **WHEN** a POST `/api/auth/login` request contains an email with no matching user
- **THEN** the server responds `401` with `{"error": "Email o contraseña incorrectos"}`

#### Scenario: Login with wrong password
- **WHEN** a POST `/api/auth/login` request contains a valid email but an incorrect password
- **THEN** the server responds `401` with `{"error": "Email o contraseña incorrectos"}`

#### Scenario: Login as a deactivated user
- **WHEN** a POST `/api/auth/login` request contains credentials of a user whose `active` flag is `false`
- **THEN** the server responds `401` with `{"error": "Email o contraseña incorrectos"}`

#### Scenario: Response timing is uniform for unknown email
- **WHEN** the email in a login request does not exist
- **THEN** the server still performs a bcrypt comparison (against a dummy hash) before responding

### Requirement: JWT delivered in an HttpOnly cookie
On successful login, the server SHALL issue a JWT signed with `HS256` and the `JWT_SECRET`, with claims for `userId`, `email`, `role`, `v` (the user's current `tokenVersion`), `iss`, `aud`, and `jti`, expiring in 24 hours. The token SHALL be delivered in an `httpOnly`, `SameSite=Lax` cookie named `token` (`secure: true` when `NODE_ENV` is `production`). The token SHALL NOT be included in the response body.

#### Scenario: Successful login sets session cookie
- **WHEN** a valid POST `/api/auth/login` request is processed
- **THEN** the response sets a `token` cookie with `httpOnly` and `SameSite=Lax` attributes and the response body contains no `token` field

#### Scenario: Cookie is Secure in production
- **WHEN** the server runs with `NODE_ENV=production` and a user logs in
- **THEN** the `token` cookie is set with the `Secure` attribute

### Requirement: Token verification revalidates version and status
The `authenticateToken` middleware SHALL verify the JWT signature, then load the user from the database and require that the user exists, is `active`, and that the token's `v` claim equals the user's current `tokenVersion`. A missing, invalid, expired, or version-mismatched token SHALL produce a `401` response with a `WWW-Authenticate: Bearer` header. The middleware SHALL read the token from the `token` cookie first and fall back to the `Authorization: Bearer` header.

#### Scenario: Valid token produced by login
- **WHEN** a protected request includes a freshly-issued valid `token` cookie
- **THEN** the request is authorized and the handler runs

#### Scenario: Expired token is rejected as 401
- **WHEN** a protected request includes an expired JWT
- **THEN** the server responds `401` with a `WWW-Authenticate` header

#### Scenario: Token with outdated version is rejected
- **WHEN** a protected request includes a JWT whose `v` claim does not match the user's current `tokenVersion`
- **THEN** the server responds `401`

#### Scenario: Header fallback works
- **WHEN** a protected request carries no cookie but a valid `Authorization: Bearer <token>` header
- **THEN** the request is authorized

#### Scenario: Deactivated user token is rejected
- **WHEN** a protected request includes a valid token for a user whose `active` flag is `false`
- **THEN** the server responds `401`

### Requirement: Logout revokes all sessions
The `/api/auth/logout` endpoint SHALL require authentication, increment the authenticated user's `tokenVersion`, and clear the `token` cookie. After logout, previously issued tokens for that user SHALL be rejected.

#### Scenario: Logout invalidates existing tokens
- **WHEN** an authenticated user calls POST `/api/auth/logout`
- **THEN** the user's `tokenVersion` is incremented, the `token` cookie is cleared, and any previously issued token is rejected

### Requirement: CSRF protection on state-changing requests
The server SHALL reject state-changing requests (POST, PUT, PATCH, DELETE) whose `Origin` or `Referer` header is present but does not match an entry in `CORS_ORIGINS`, responding `403`.

#### Scenario: Request from an unexpected origin
- **WHEN** a POST request with a mutation carries an `Origin` header not listed in `CORS_ORIGINS`
- **THEN** the server responds `403` without executing the mutation

#### Scenario: Request without an origin header
- **WHEN** a state-changing request carries neither an `Origin` nor a `Referer` header
- **THEN** the request is allowed through the CSRF middleware

### Requirement: CORS allows credentials
The server SHALL configure CORS with `credentials: true` and the explicit origins from `CORS_ORIGINS` so cookie-based authentication works across the configured origins.

#### Scenario: Preflight from a configured origin
- **WHEN** a preflight request arrives from an origin listed in `CORS_ORIGINS` with credentials
- **THEN** the response includes `Access-Control-Allow-Credentials: true` and `Access-Control-Allow-Origin` for that origin