## ADDED Requirements

### Requirement: Burn-down metrics are computed by isolated, verifiable functions
The burn-down, velocity and individual-contribution calculations SHALL live in pure functions that take plain data and return plain data, with no database or HTTP dependency, so that they can be verified by unit tests without a running server.

#### Scenario: Calculation is reachable without a server
- **WHEN** a unit test computes a burn-down series from a plain sprint object
- **THEN** the result is produced without any database connection or HTTP request

### Requirement: The burn-down day index is elapsed days from the sprint start
The series SHALL contain one point per elapsed day of the sprint: the day count SHALL be the whole number of days between the start and the end date, and the series SHALL contain that count plus one point, indexed from 0. The ideal line SHALL decrease linearly and SHALL reach exactly 0 at the final index.

#### Scenario: Series length for an elapsed-day span
- **WHEN** a sprint starts and ends 9 days apart
- **THEN** the series contains 10 points indexed 0 through 9

#### Scenario: Ideal line reaches zero on the last day
- **WHEN** a burn-down series is computed for any sprint
- **THEN** the ideal value at the final index is 0

#### Scenario: Ideal value at a given day
- **WHEN** a sprint spans 10 elapsed days with 100 total story points
- **THEN** the ideal value at day index 5 is exactly 50

### Requirement: The actual line reflects completed points up to each day
The actual value on a given day SHALL be the total story points minus the points of the stories whose completion timestamp is on or before that day. Days in the future relative to the current time SHALL report a null actual value, and no day SHALL report a negative remaining value.

#### Scenario: Completed story reduces the remaining points
- **WHEN** a sprint has 100 total points and a 40-point story completed on day 3
- **THEN** the actual value from day 3 onward is 60

#### Scenario: Future days have no actual value
- **WHEN** a burn-down series is computed for a sprint that is still in progress
- **THEN** every index whose date is after the current time reports a null actual value

#### Scenario: Story completed before the sprint start
- **WHEN** a 40-point story has a completion timestamp before the sprint start date
- **THEN** the actual value at day index 0 already excludes those 40 points

#### Scenario: Remaining points never go negative
- **WHEN** a burn-down series is computed for any sprint
- **THEN** no actual value in the series is negative

### Requirement: Degenerate sprints produce a usable series instead of invalid numbers
When the sprint end date is not after the start date, the computation SHALL NOT produce `NaN`, `Infinity` or `null` in the ideal series. When the end date is not after the start date the series SHALL be empty; when the start and end fall on the same calendar day the series SHALL contain a single point whose ideal value equals the total points.

#### Scenario: Single-day sprint
- **WHEN** a sprint starts and ends on the same day with 100 total story points
- **THEN** the series contains a single point whose ideal value is 100 and is a finite number

#### Scenario: End date before start date
- **WHEN** a sprint's end date precedes its start date
- **THEN** the series is empty and no value is `NaN` or `Infinity`

#### Scenario: No dates configured
- **WHEN** a sprint has no start or end date
- **THEN** the result reports the total points and an empty series

#### Scenario: Sprint without stories
- **WHEN** a sprint has no stories
- **THEN** the total points is 0 and every ideal value in the series is 0

### Requirement: Stories carrying zero points are counted as estimated
A story whose story points are 0 SHALL be treated as an estimated story: the total SHALL include the value 0 and the user interface SHALL display the value 0 rather than omitting it.

#### Scenario: Zero-point story displays its value
- **WHEN** a story has 0 story points and is rendered in the backlog
- **THEN** the interface displays the value 0 for that story

#### Scenario: Zero-point story does not change totals
- **WHEN** a sprint contains a 0-point story alongside a 10-point story
- **THEN** the sprint total is 10

### Requirement: Velocity reports committed and completed points per sprint
The velocity computation SHALL produce one entry per sprint, ordered by start date ascending, each containing the points committed (all stories in the sprint) and the points completed (only stories with a completion timestamp). Sprints without dates SHALL be ordered after dated sprints and SHALL NOT be dropped.

#### Scenario: Committed and completed differ
- **WHEN** a sprint has 30 committed points of which 20 are completed
- **THEN** its velocity entry reports committed 30 and completed 20

#### Scenario: Ordering by start date
- **WHEN** a project has sprints starting on three different dates
- **THEN** the velocity entries are returned in ascending start-date order

#### Scenario: Project without sprints
- **WHEN** a project has no sprints
- **THEN** the velocity result is an empty list

### Requirement: Individual contribution reports completed work per member
The contribution computation SHALL produce, for each member of the project who has completed tasks, the count of completed tasks and their summed story points. Members with no completed tasks SHALL NOT appear, and the result SHALL cover only tasks belonging to the requested project.

#### Scenario: Member with completed tasks
- **WHEN** a member completed 3 tasks carrying a total of 8 story points
- **THEN** their entry reports 3 completed tasks and 8 story points

#### Scenario: Member without completed tasks is absent
- **WHEN** a member completed no tasks
- **THEN** no entry is produced for that member

#### Scenario: Only the requested project is counted
- **WHEN** a member completed tasks in two different projects
- **THEN** the contribution result for one project counts only that project's tasks

#### Scenario: Unassigned completed tasks are reported separately
- **WHEN** a project has a completed task with no assignee
- **THEN** the result reports those tasks without attributing them to any member