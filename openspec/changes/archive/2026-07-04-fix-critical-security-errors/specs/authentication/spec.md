## ADDED Requirements

### Requirement: Secure Authentication Logging
The system SHALL log authentication events without sensitive information.

#### Scenario: Successful login
- **WHEN** a user successfully logs in
- **THEN** the system logs the login event with user ID and timestamp (NOT password or token)

#### Scenario: Failed login
- **WHEN** a login attempt fails
- **THEN** the system logs the failure with IP address and timestamp (NOT the attempted password)

### Requirement: Authentication Endpoint Protection
The system SHALL protect authentication endpoints with rate limiting to prevent brute force attacks.

#### Scenario: Login rate limiting
- **GIVEN** a login endpoint
- **WHEN** more than 5 login attempts occur from the same IP within 15 minutes
- **THEN** subsequent attempts return 429 Too Many Requests

#### Scenario: Registration rate limiting
- **GIVEN** a registration endpoint
- **WHEN** more than 10 registration attempts occur from the same IP within 1 hour
- **THEN** subsequent attempts return 429 Too Many Requests

### Requirement: Registration Role Restriction
The system SHALL reject registration attempts with invalid or privileged roles.

#### Scenario: ADMIN role rejected
- **WHEN** a user attempts to register with role "ADMIN"
- **THEN** the system rejects the registration with a 400 Bad Request

#### Scenario: Default role assignment
- **WHEN** a user registers without specifying a role
- **THEN** the system assigns "TEAM_DEVELOPER" as the default role