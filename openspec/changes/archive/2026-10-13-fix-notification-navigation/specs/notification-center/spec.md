## MODIFIED Requirements

### Requirement: Clicking a notification navigates to its detail

The notification panel SHALL render a notification that carries a reference as activable, and
activating it SHALL mark it as read AND navigate to a valid route resolved from `entityType` and
`entityId`. The route resolution SHALL be:

- `PROJECT` → the project's task board (`/projects/<entityId>/tasks`).
- `TASK` → resolve the task's project via `GET /api/tasks/:id` and navigate to
  `/projects/<projectId>/tasks`.
- `SPRINT` → resolve the sprint's project via `GET /api/sprints/:id` and navigate to
  `/projects/<projectId>/sprints/<sprintId>`.
- `USER_STORY` → resolve the story's project via `GET /api/user-stories/:id` and navigate to
  `/projects/<projectId>/user-stories`.
- `MESSAGE`, `RETROSPECTIVE_ITEM`, an unknown `entityType`, a non-resolvable reference, a missing
  `projectId`, or a failed resolution request → navigate to the root dashboard (`/`).

Activating a notification without a reference SHALL only mark it as read and SHALL NOT navigate.
In no case SHALL activating a notification navigate to a route that does not exist in the router
(thereby leaving a blank screen).

#### Scenario: Clicking a task notification opens the task board

- **WHEN** a user activates a notification with `entityType` `TASK` and a task id
- **THEN** the notification is marked as read and the user is navigated to the task's project task
  board (`/projects/<projectId>/tasks`)

#### Scenario: Clicking a project notification opens the project board

- **WHEN** a user activates a notification with `entityType` `PROJECT` and a project id
- **THEN** the notification is marked as read and the user is navigated to
  `/projects/<entityId>/tasks`

#### Scenario: Clicking a sprint notification opens the sprint detail

- **WHEN** a user activates a notification with `entityType` `SPRINT` and a sprint id
- **THEN** the notification is marked as read and the user is navigated to
  `/projects/<projectId>/sprints/<sprintId>`

#### Scenario: Clicking a user-story notification opens the story list

- **WHEN** a user activates a notification with `entityType` `USER_STORY` and a story id
- **THEN** the notification is marked as read and the user is navigated to
  `/projects/<projectId>/user-stories`

#### Scenario: A reference without a dedicated route falls back to the dashboard

- **WHEN** a user activates a notification with `entityType` `MESSAGE` or `RETROSPECTIVE_ITEM`
- **THEN** the notification is marked as read and the user is navigated to the root dashboard (`/`)

#### Scenario: A non-resolvable reference falls back to the dashboard

- **WHEN** a user activates a notification whose reference cannot be resolved (resolution request
  fails or returns no `projectId`)
- **THEN** the notification is marked as read and the user is navigated to the root dashboard (`/`)
  instead of a non-existent route

#### Scenario: Notification without reference does not navigate

- **WHEN** a user activates a notification whose reference is null
- **THEN** the notification is marked as read and the user stays on the current page

## ADDED Requirements

### Requirement: Unknown client routes never render a blank screen

The client router SHALL resolve any unknown path that is not explicitly declared, redirecting the
user to the root dashboard (`/`) rather than rendering an empty page.

#### Scenario: Navigating to an undeclared path redirects to the dashboard

- **WHEN** the authenticated app is rendered at a path with no matching route (for example
  `/dashboard`)
- **THEN** the user is redirected to `/` and the dashboard is displayed
