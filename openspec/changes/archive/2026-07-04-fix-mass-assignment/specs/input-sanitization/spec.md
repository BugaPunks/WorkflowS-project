## ADDED Requirements

### Requirement: PUT /api/sprints/:id — field whitelist

The system SHALL only accept the following fields on PUT /api/sprints/:id: `name`, `description`, `startDate`, `endDate`, `status`. All other fields SHALL be silently dropped.

#### Scenario: Update sprint with valid fields
- **WHEN** a PUT request to /api/sprints/:id contains only allowed fields (name, description, startDate, endDate, status)
- **THEN** the sprint is updated with the provided values

#### Scenario: Update sprint with extra fields
- **WHEN** a PUT request to /api/sprints/:id contains extra fields (e.g., projectId, id)
- **THEN** the extra fields are silently ignored and the sprint is updated with only the allowed fields

#### Scenario: Update sprint with empty body
- **WHEN** a PUT request to /api/sprints/:id has an empty body or no allowed fields
- **THEN** the system returns a 400 Bad Request

### Requirement: PUT /api/projects/:id — field whitelist

The system SHALL only accept the following fields on PUT /api/projects/:id: `name`, `description`, `startDate`, `endDate`. All other fields SHALL be silently dropped.

#### Scenario: Update project with valid fields
- **WHEN** a PUT request to /api/projects/:id contains only allowed fields
- **THEN** the project is updated with the provided values

#### Scenario: Update project with extra fields
- **WHEN** a PUT request to /api/projects/:id contains extra fields (e.g., ownerId, id)
- **THEN** the extra fields are silently ignored

#### Scenario: Update project with empty body
- **WHEN** a PUT request to /api/projects/:id has an empty body
- **THEN** the system returns a 400 Bad Request

### Requirement: PUT /api/user-stories/:id — field whitelist

The system SHALL only accept the following fields on PUT /api/user-stories/:id: `title`, `description`, `acceptance`, `assigneeId`, `priority`, `storyPoints`, `status`. All other fields SHALL be silently dropped.

#### Scenario: Update user story with valid fields
- **WHEN** a PUT request to /api/user-stories/:id contains only allowed fields
- **THEN** the user story is updated with the provided values

#### Scenario: Update user story with extra fields
- **WHEN** a PUT request to /api/user-stories/:id contains extra fields (e.g., projectId, id)
- **THEN** the extra fields are silently ignored

#### Scenario: Update user story with empty body
- **WHEN** a PUT request to /api/user-stories/:id has an empty body
- **THEN** the system returns a 400 Bad Request

### Requirement: Update user story status tracks completion

The system SHALL automatically set `completedAt` when status changes to COMPLETED or DONE, and clear it when status changes to BACKLOG or TODO.

#### Scenario: Mark user story as completed
- **WHEN** a PUT request sets status to "COMPLETED" or "DONE"
- **THEN** the system sets completedAt to the current timestamp

#### Scenario: Reopen user story
- **WHEN** a PUT request sets status to "BACKLOG" or "TODO"
- **THEN** the system clears completedAt (sets to null)
