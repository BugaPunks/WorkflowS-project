## ADDED Requirements

### Requirement: Password Exclusion from User Queries
The system SHALL exclude the password field from all user query responses.

#### Scenario: User profile without password
- **WHEN** a user requests their own profile
- **THEN** the response contains user data without the password field

#### Scenario: User list without passwords
- **WHEN** an admin requests a list of users
- **THEN** the response contains user data without password fields

### Requirement: Registration Role Restriction
The system SHALL only allow specific roles during user registration.

#### Scenario: Default role assignment
- **WHEN** a user registers without specifying a role
- **THEN** the system assigns "TEAM_DEVELOPER" role

#### Scenario: Invalid role rejection
- **WHEN** a user attempts to register with role "ADMIN"
- **THEN** the system rejects the registration with a 400 Bad Request

### Requirement: User Data Sanitization
The system SHALL sanitize user input to prevent injection attacks.

#### Scenario: Valid user data
- **WHEN** user provides valid name and email
- **THEN** the system processes and stores the data

#### Scenario: Malicious input
- **WHEN** user provides input with script tags
- **THEN** the system rejects the input with a 400 Bad Request (input validation schema rejects HTML tags)