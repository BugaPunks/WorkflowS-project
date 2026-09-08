## ADDED Requirements

### Requirement: Input Validation
The system SHALL validate all incoming request data against defined schemas.

#### Scenario: Valid data passes validation
- **WHEN** request body matches the expected schema
- **THEN** the request proceeds to the route handler

#### Scenario: Invalid data fails validation
- **WHEN** request body does not match the expected schema
- **THEN** the system returns a 400 Bad Request with validation errors

### Requirement: Rate Limiting
The system SHALL implement rate limiting on authentication endpoints.

#### Scenario: Login rate limiting
- **WHEN** more than 5 login attempts occur from the same IP within 15 minutes
- **THEN** subsequent attempts return 429 Too Many Requests

#### Scenario: API rate limiting
- **WHEN** more than 100 requests occur from the same IP within 15 minutes
- **THEN** subsequent requests return 429 Too Many Requests

### Requirement: Security Headers
The system SHALL include security headers in all responses.

#### Scenario: Helmet headers present
- **WHEN** the system responds to any request
- **THEN** response includes X-Content-Type-Options, X-Frame-Options, and Content-Security-Policy headers

#### Scenario: CORS restricted origins
- **WHEN** a request comes from an origin not in the configured `CORS_ORIGINS` list
- **THEN** the system rejects the request with a CORS error

#### Scenario: CORS allows configured origins
- **WHEN** a request comes from an origin in the `CORS_ORIGINS` list
- **THEN** the system allows the request with appropriate CORS headers

### Requirement: Secure File Uploads
The system SHALL validate file uploads for size and type.

#### Scenario: Valid file upload
- **WHEN** a file is uploaded within size limits and allowed types
- **THEN** the system processes and stores the file

#### Scenario: File too large
- **WHEN** a file exceeds the maximum size limit (10MB)
- **THEN** the system returns a 413 Payload Too Large response

#### Scenario: Invalid file type
- **WHEN** a file type is not in the allowed list
- **THEN** the system returns a 415 Unsupported Media Type response

### Requirement: Password Exclusion
The system SHALL exclude password hashes from all API responses.

#### Scenario: User data without password
- **WHEN** the system returns user data
- **THEN** the response does not include the password field

### Requirement: Secure Logging
The system SHALL not log sensitive information like passwords.

#### Scenario: Registration logging
- **WHEN** a user registers
- **THEN** the system logs registration event without password

### Requirement: Authenticated File Serving
The system SHALL serve uploaded files only to authenticated users with project access.

#### Scenario: Authorized user downloads file
- **WHEN** a project member or ADMIN requests a file via GET /api/files/:filename
- **THEN** the system serves the file from the uploads directory

#### Scenario: Unauthenticated file download rejected
- **WHEN** an unauthenticated user requests a file via GET /api/files/:filename
- **THEN** the system returns a 401 Unauthorized response

#### Scenario: Non-member file download rejected
- **WHEN** an authenticated user who is not a project member requests a file
- **THEN** the system returns a 403 Forbidden response

#### Scenario: Non-existent file download
- **WHEN** any user requests a file that does not exist
- **THEN** the system returns a 404 Not Found response

#### Scenario: Public static serving removed
- **WHEN** a user tries to access a file at /uploads/:filename directly
- **THEN** the request does not reach the application (no express.static bound to that path)

### Requirement: CSV Injection Prevention
The system SHALL sanitize CSV output to prevent formula injection.

#### Scenario: CSV cell with dangerous character
- **WHEN** a dynamic value in CSV output starts with `=`, `+`, `-`, or `@`
- **THEN** the system prepends a single quote to prevent formula execution

#### Scenario: CSV export safe values
- **WHEN** all dynamic values in CSV output are safe strings
- **THEN** the system exports them without modification