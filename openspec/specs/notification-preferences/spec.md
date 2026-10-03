# Notification preferences Capability

## Purpose

Lets each user choose which notification types they receive, and honours that choice on delivery.

## Requirements

### Requirement: Notification preferences default to enabled
For every notification type in the taxonomy, a user SHALL receive that notification unless the user has explicitly disabled it. No stored preference SHALL be required for a type to be delivered.

#### Scenario: New user receives every type
- **WHEN** a user with no stored preferences is assigned a task
- **THEN** the `TASK_ASSIGNED` notification is delivered

#### Scenario: Disabling a type takes effect without a stored default row
- **WHEN** a user disables `TASK_ASSIGNED` and is then assigned a task
- **THEN** no `TASK_ASSIGNED` notification is stored for that user

### Requirement: Users can read their notification preferences
The system SHALL expose an authenticated endpoint returning, for every notification type, whether the caller has it enabled. When the caller has no stored preference for a type, the endpoint SHALL report it as enabled.

#### Scenario: Reading preferences with no stored rows
- **WHEN** a user with no stored preferences reads their preferences
- **THEN** every type in the taxonomy is reported as enabled

#### Scenario: Reading preferences after a change
- **WHEN** a user has disabled `MESSAGE` and reads their preferences
- **THEN** `MESSAGE` is reported as disabled and the remaining types are enabled

### Requirement: Users can update their notification preferences
The system SHALL expose an authenticated endpoint that enables or disables a single notification type for the caller. Updating a type that is already in the requested state SHALL succeed without creating a duplicate preference row.

#### Scenario: Disabling a type
- **WHEN** a user disables `EVALUATION_COMPLETED`
- **THEN** the stored preference for that type is `false`

#### Scenario: Re-enabling a type
- **WHEN** a user re-enables `EVALUATION_COMPLETED` after disabling it
- **THEN** the stored preference for that type is `true`

#### Scenario: Repeated identical update is idempotent
- **WHEN** a user disables `MESSAGE` twice
- **THEN** exactly one preference row exists for that user and type

#### Scenario: Unknown type is rejected
- **WHEN** a user attempts to update a preference for a type outside the taxonomy
- **THEN** the server responds `400`

#### Scenario: Preferences are private
- **WHEN** a user reads or updates preferences
- **THEN** only that user's preferences are read or modified

### Requirement: Notification delivery honours the user's preference
Every notification emission SHALL consult the recipient's preference for that notification type and SHALL skip persistence when the type is disabled. This SHALL apply uniformly to every trigger, including the default types, so that no trigger bypasses the preference check.

#### Scenario: Trigger is suppressed by preference
- **WHEN** a user has disabled `TASK_ASSIGNED` and a task is assigned to them
- **THEN** no notification row is created for that user

#### Scenario: Trigger proceeds when enabled
- **WHEN** a user has `TASK_ASSIGNED` enabled and a task is assigned to them
- **THEN** the notification row is created

#### Scenario: Preference does not affect other recipients
- **WHEN** a user has disabled `TASK_ASSIGNED` and another user without preferences is assigned a different task
- **THEN** that other user receives the notification

#### Scenario: Every existing trigger consults preferences
- **WHEN** a user has disabled all notification types and each trigger event is executed against that user
- **THEN** no notification is created for that user by any trigger

### Requirement: Users can configure preferences from the interface
The system SHALL provide a settings surface in the notification centre where the user can see the enabled state of every notification type and toggle it, and the displayed state SHALL reflect the stored preferences.

#### Scenario: Toggling from the interface persists
- **WHEN** a user toggles `PROJECT_ASSIGNED` off in the settings surface
- **THEN** the stored preference is updated and the toggle renders as disabled after a reload

#### Scenario: Interface reflects stored state
- **WHEN** a user opens the settings surface after disabling `MESSAGE`
- **THEN** the `MESSAGE` toggle renders as disabled
