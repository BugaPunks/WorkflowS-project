## ADDED Requirements

### Requirement: Dual-Level Role-Based Access Control
The system SHALL restrict access based on TWO independent role dimensions: system-level (`User.role`) for admin operations and project-level (`ProjectMember.role`) for project operations.

#### Scenario: Admin system-level access
- **WHEN** a user with system role "ADMIN" accesses an admin-only route (e.g., user management)
- **THEN** the system allows access

#### Scenario: Non-admin denied system-level access
- **WHEN** a user with system role "TEAM_DEVELOPER" accesses an admin-only route
- **THEN** the system returns a 403 Forbidden response

#### Scenario: Project-level access with correct project role
- **WHEN** a user with ProjectMember role "SCRUM_MASTER" in the project accesses a sprint management route
- **THEN** the system allows access

#### Scenario: Project-level access denied with incorrect project role
- **WHEN** a user with ProjectMember role "TEAM_DEVELOPER" in the project accesses a sprint management route
- **THEN** the system returns a 403 Forbidden response

#### Scenario: Same user, different project roles
- **WHEN** a user is "SCRUM_MASTER" in project A but "TEAM_DEVELOPER" in project B
- **AND** the user tries to manage sprints in project B
- **THEN** the system returns a 403 Forbidden response

### Requirement: System-Level RBAC Middleware
The system SHALL provide a `requireSystemRole` middleware that validates against `User.role` from the JWT token.

#### Scenario: Multiple system roles allowed
- **WHEN** middleware is configured with roles ["ADMIN"]
- **THEN** only users with system role "ADMIN" can access the route

#### Scenario: System role mismatch
- **WHEN** user's system role is not in the allowed roles list
- **THEN** the system returns a 403 Forbidden response

### Requirement: Project-Level RBAC Middleware
The system SHALL provide a `requireProjectRole` middleware that looks up `ProjectMember.role` for the specific project.

#### Scenario: Project membership lookup
- **WHEN** a request is made to a project-scoped route
- **THEN** the middleware queries ProjectMember by projectId and userId

#### Scenario: Project membership not found
- **WHEN** a user is not a member of the specified project
- **AND** the user's system role is not ADMIN
- **THEN** the system returns a 403 Forbidden response

#### Scenario: Admin bypass for project routes
- **WHEN** a user with system role "ADMIN" accesses a project-scoped route
- **THEN** the system allows access even if the user is not a ProjectMember (teachers can see all projects)

### Requirement: Unauthenticated User Handling
The system SHALL deny access to role-protected routes for unauthenticated users.

#### Scenario: No user context
- **WHEN** request reaches role middleware without user context (missing or invalid JWT)
- **THEN** the system returns a 401 Unauthorized response