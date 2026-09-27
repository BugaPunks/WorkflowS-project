## ADDED Requirements

### Requirement: Registration always creates a basic role user
The `/api/auth/register` endpoint SHALL ignore any client-supplied `role` value and create users with role `TEAM_DEVELOPER`. The endpoint SHALL NOT allow callers to self-assign `ADMIN`, `PRODUCT_OWNER`, or `SCRUM_MASTER` roles.

#### Scenario: Register with a privileged role is ignored
- **WHEN** a POST `/api/auth/register` request includes `"role": "PRODUCT_OWNER"` in the body
- **THEN** the created user has role `TEAM_DEVELOPER`

#### Scenario: Register without a role
- **WHEN** a POST `/api/auth/register` request omits the `role` field
- **THEN** the created user has role `TEAM_DEVELOPER`

### Requirement: Registration does not issue a session
The `/api/auth/register` endpoint SHALL NOT return a JWT and SHALL NOT otherwise authenticate the new user. The response body SHALL contain the created user's profile data and a success message only.

#### Scenario: Register response contains no token
- **WHEN** a POST `/api/auth/register` request succeeds
- **THEN** the response body contains no `token` field and no auth cookie is set

### Requirement: Registration enforces password strength
The `/api/auth/register` endpoint SHALL reject passwords shorter than 8 characters or longer than 72 characters, passwords without at least one uppercase letter, one lowercase letter, and one digit, and passwords from a defined list of common insecure passwords. Rejection SHALL respond with `400` and a descriptive error message.

#### Scenario: Short password is rejected
- **WHEN** a registration request submits a 6-character password
- **THEN** the server responds `400` with an error explaining the minimum length

#### Scenario: Password without digits is rejected
- **WHEN** a registration request submits a password with no digits
- **THEN** the server responds `400` with an error explaining the requirement

#### Scenario: Common password is rejected
- **WHEN** a registration request submits a password from the common-password list (e.g. `password`)
- **THEN** the server responds `400` with an error explaining the password is too common

#### Scenario: Strong password is accepted
- **WHEN** a registration request submits a password meeting all strength rules
- **THEN** the user is created and the request succeeds

### Requirement: Registration timing is equalized for duplicate emails
When the submitted email already exists, the `/api/auth/register` endpoint SHALL perform a dummy bcrypt hashing operation before responding `400` with `{"error": "El email ya está registrado"}`, so that response timing does not disclose which emails are registered.

#### Scenario: Duplicate email still gets the same error
- **WHEN** a registration request uses an email that already exists
- **THEN** the server responds `400` with "El email ya está registrado"

#### Scenario: Duplicate email path performs bcrypt work
- **WHEN** a registration request uses an email that already exists
- **THEN** the server performs a bcrypt hashing operation before responding