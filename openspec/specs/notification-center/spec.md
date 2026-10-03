# Notification center Capability

## Purpose

Delivers notifications for the project events that matter to each user, and lets them reach the related detail.

## Requirements

### Requirement: Notification type is a validated taxonomy
The system SHALL restrict `Notification.type` to an enumerated set of event types: `TASK_ASSIGNED`, `USER_STORY_ASSIGNED`, `EVALUATION_COMPLETED`, `MESSAGE`, `PROJECT_ASSIGNED`, `RETROSPECTIVE_ITEM` and `SPRINT_COMPLETED`. Creating or updating a notification with a type outside that set SHALL fail with `400`. A user-story assignment SHALL use `USER_STORY_ASSIGNED` and SHALL NOT reuse `TASK_ASSIGNED`.

#### Scenario: Story assignment is not labelled as a task assignment
- **WHEN** a user story is assigned to a user
- **THEN** the created notification has type `USER_STORY_ASSIGNED`

#### Scenario: Unknown type is rejected
- **WHEN** a notification is created with type `SOMETHING_ELSE`
- **THEN** the server responds `400` and no notification is persisted

### Requirement: Every trigger event emits a notification to the right recipient
Assigning a task SHALL notify the assignee; grading a task SHALL notify its assignee; sending a direct message SHALL notify the recipient; adding a member to a project SHALL notify that member; adding a retrospective note SHALL notify the other project members; and moving a sprint to `COMPLETED` SHALL notify every member of the sprint's project. Each of these SHALL emit exactly one notification per recipient.

#### Scenario: Sprint completion notifies project members
- **WHEN** a sprint's status is updated to `COMPLETED`
- **THEN** one notification of type `SPRINT_COMPLETED` is created for each member of the sprint's project

#### Scenario: Sprint completion is not duplicated
- **WHEN** a sprint already in status `COMPLETED` is updated again
- **THEN** no `SPRINT_COMPLETED` notification is created

#### Scenario: Task grading notifies the assignee
- **WHEN** a task is graded with a score
- **THEN** one notification of type `EVALUATION_COMPLETED` is created for the task's assignee

### Requirement: Notifications carry a navigable reference
Every notification created by a trigger SHALL store the type of entity it refers to and its identifier, so the client can resolve a destination route. Notifications without a navigable entity SHALL store a null reference.

#### Scenario: Task assignment stores a task reference
- **WHEN** a notification of type `TASK_ASSIGNED` is created
- **THEN** it stores `entityType` `TASK` and the `entityId` of the assigned task

#### Scenario: Notification without an entity stores a null reference
- **WHEN** a notification is created with no navigable entity
- **THEN** its `entityType` and `entityId` are both null

### Requirement: Clicking a notification navigates to its detail
The notification panel SHALL render a notification that carries a reference as activable, and activating it SHALL mark it as read AND navigate to the route resolved from `entityType` and `entityId`. Activating a notification without a reference SHALL only mark it as read.

#### Scenario: Clicking a task notification opens the task
- **WHEN** a user activates a notification with `entityType` `TASK` and a task id
- **THEN** the notification is marked as read and the user is navigated to the task detail route

#### Scenario: Notification without reference does not navigate
- **WHEN** a user activates a notification whose reference is null
- **THEN** the notification is marked as read and the user stays on the current page

### Requirement: Unread count reflects every unread notification
The system SHALL expose the number of unread notifications for a user computed over all of that user's notifications, not over a truncated page. A user SHALL NOT receive an unread count derived from only the most recent page of notifications.

#### Scenario: Count exceeds the page size
- **WHEN** a user has 25 unread notifications and the list endpoint returns at most 20
- **THEN** the unread count reported to the client is 25

#### Scenario: Read notifications are not counted
- **WHEN** a user has 30 notifications of which 25 are read
- **THEN** the unread count is 5

### Requirement: The user can mark all notifications as read
The system SHALL provide an operation that marks every unread notification of the authenticated user as read in a single request.

#### Scenario: Mark all as read
- **WHEN** a user with 4 unread notifications triggers "mark all as read"
- **THEN** all 4 notifications are marked as read and the unread count becomes 0

#### Scenario: Mark all as read affects only the caller
- **WHEN** a user triggers "mark all as read"
- **THEN** no other user's notifications are modified
