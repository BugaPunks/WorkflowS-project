## ADDED Requirements

### Requirement: JWT Token Validation
The system SHALL validate JWT tokens on all protected routes using a middleware.

#### Scenario: Valid token provides access
- **WHEN** a request includes a valid JWT token in the Authorization header
- **THEN** the system allows access to the protected resource

#### Scenario: Missing token denies access
- **WHEN** a request does not include an Authorization header
- **THEN** the system returns a 401 Unauthorized response

#### Scenario: Invalid token denies access
- **WHEN** a request includes an invalid or expired JWT token
- **THEN** the system returns a 403 Forbidden response

### Requirement: Token Extraction
The system SHALL extract JWT tokens from the Authorization header using the Bearer scheme.

#### Scenario: Bearer token extraction
- **WHEN** a request includes Authorization header with format "Bearer <token>"
- **THEN** the system extracts the token for validation

#### Scenario: Malformed Authorization header
- **WHEN** a request includes an Authorization header without "Bearer " prefix
- **THEN** the system returns a 401 Unauthorized response

### Requirement: User Context Attachment
The system SHALL attach decoded user information to the request object after successful token validation.

#### Scenario: User context available
- **WHEN** a JWT token is successfully validated
- **THEN** the request object contains user information (id, email, role)

### Requirement: JWT Secret Configuration
The system SHALL require JWT_SECRET environment variable without fallback to hardcoded values.

#### Scenario: JWT_SECRET not set
- **WHEN** the JWT_SECRET environment variable is not configured
- **THEN** the system fails to start with an error message

#### Scenario: JWT_SECRET configured
- **WHEN** the JWT_SECRET environment variable is set
- **THEN** the system uses it for token validation