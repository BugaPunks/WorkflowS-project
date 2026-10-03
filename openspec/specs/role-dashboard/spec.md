# Role dashboard Capability

## Purpose

Presents a dashboard scoped to the signed-in user and their role, and restricts evaluation and performance views to the teacher role.

## Requirements

### Requirement: The dashboard shows real data for the signed-in user
The dashboard SHALL render live figures scoped to the signed-in user rather than a static welcome panel. The data SHALL cover, for a user who is a member of projects: the projects currently active, the tasks assigned to them that are not completed, and the nearest upcoming due dates relevant to them. An ADMIN who is not a member of any project SHALL receive empty collections rather than an error.

#### Scenario: Developer sees own pending tasks
- **WHEN** a member with two assigned tasks that are not completed opens the dashboard
- **THEN** the dashboard reports exactly those two tasks as pending

#### Scenario: Completed tasks are excluded
- **WHEN** a member has one pending task and one completed task
- **THEN** only the pending task is reported

#### Scenario: User with no projects gets an empty summary
- **WHEN** a user who belongs to no project opens the dashboard
- **THEN** the summary response contains empty collections and the dashboard renders an empty state without erroring

#### Scenario: Members do not see other members' pending tasks
- **WHEN** two members belong to the same project and each has pending tasks
- **THEN** each member's summary contains only their own pending tasks

#### Scenario: Archived or finished projects are not counted as active
- **WHEN** a member's only project has an end date in the past
- **THEN** that project is not reported as active

### Requirement: The dashboard layout is selected by role
An ADMIN SHALL be shown the teacher panel and any other role the student panel appropriate to that role, and the panel rendered SHALL be determined by the role of the signed-in user.

#### Scenario: Administrator gets the teacher panel
- **WHEN** an ADMIN opens the dashboard
- **THEN** the teacher panel is rendered and the developer panel is not present

#### Scenario: Team developer gets the developer panel
- **WHEN** a member with role `TEAM_DEVELOPER` opens the dashboard
- **THEN** the developer panel is rendered and the teacher panel is not present

### Requirement: Users can configure which dashboard modules are visible
The system SHALL let the signed-in user choose which dashboard modules are displayed, SHALL persist that choice per user, and SHALL apply it on subsequent visits. All modules SHALL be visible until the user narrows the selection.

#### Scenario: Hiding a module persists across sessions
- **WHEN** a user hides the upcoming-due-dates module and later signs in again
- **THEN** the module is not rendered

#### Scenario: Default shows every module
- **WHEN** a user who has never configured the dashboard opens it
- **THEN** every available module is rendered

#### Scenario: Configuration is private
- **WHEN** a user saves a module selection
- **THEN** no other user's dashboard configuration is modified

#### Scenario: Empty selection renders a valid dashboard
- **WHEN** a user hides every module
- **THEN** the dashboard renders without error and shows an indication that no modules are selected

### Requirement: Evaluation and performance views are restricted to the teacher role
The evaluations route SHALL be reachable only by an ADMIN, and the individual-contribution metric SHALL be returned only to an ADMIN. Any other authenticated role requesting them SHALL be denied, in the interface and in the API, so that grading data and team performance are not exposed to students.

#### Scenario: Student is denied the evaluations route
- **WHEN** a member with role `TEAM_DEVELOPER` navigates to the evaluations route
- **THEN** the evaluations view is not rendered and the user is redirected away from it

#### Scenario: Student is denied the evaluations API
- **WHEN** a member requests the evaluations list for a project
- **THEN** the server responds `403`

#### Scenario: Student is denied individual contribution
- **WHEN** a member requests the individual-contribution metric of a project
- **THEN** the server responds `403` and no performance data is returned

#### Scenario: Teacher keeps access
- **WHEN** an ADMIN requests the evaluations list or the individual-contribution metric
- **THEN** the server responds `200` with the data

#### Scenario: Students retain their own grades
- **WHEN** a member requests their own evaluations
- **THEN** the server responds `200` with only that member's own records
