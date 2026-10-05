# Quality gates Capability

## Purpose

Keeps the project's verification suite runnable through documented commands, free of development leftovers, and backed by automated tests that match what the test report claims.

## Requirements

### Requirement: The full verification suite is runnable with documented commands
The project SHALL expose, in `package.json`, one documented command per verification activity: unit tests, end-to-end tests and linting/format checking. The end-to-end command SHALL invoke the project's Playwright configuration and the unit-test command SHALL exclude the end-to-end directory, so that running either command runs exactly the tests it claims to run. A contributor SHALL be able to verify the whole project without knowing internal tool invocation details.

#### Scenario: Unit tests run with a documented command
- **WHEN** the unit test command is executed
- **THEN** the unit test suite runs and the end-to-end specs are not collected

#### Scenario: End-to-end tests run with a documented command
- **WHEN** the end-to-end command is executed
- **THEN** the Playwright suite defined by the project's Playwright configuration runs

#### Scenario: Linting runs with a documented command
- **WHEN** the lint command is executed
- **THEN** the project's configured linter and formatter check the source tree

#### Scenario: Existing unit test command keeps working
- **WHEN** the pre-existing unit test command is executed
- **THEN** it still runs the unit test suite

### Requirement: The source tree carries no development debug logging
The application source SHALL NOT contain `console.log` calls left over from development. Statements that log a runtime failure SHALL remain permitted, so that error reporting is not degraded by this requirement.

#### Scenario: No debug logging remains in the source tree
- **WHEN** the source tree is searched for `console.log`
- **THEN** no occurrence is found

#### Scenario: Error logging is preserved
- **WHEN** a server route reports a caught error
- **THEN** it reports it through an error-level logging call rather than a debug log

#### Scenario: Controls with no implemented action are not shipped as enabled buttons
- **WHEN** an interface control has no implemented behaviour
- **THEN** it is not rendered as an actionable control

### Requirement: Database queries for read endpoints request only the fields they return
Read endpoints SHALL declare the fields they need when querying the database, rather than loading whole records, so that columns holding credential material or large binary content are not retrieved for endpoints that never use them. Adding a column to a model SHALL NOT, by itself, cause that column to be loaded by existing read endpoints.

#### Scenario: Export endpoint declares its fields
- **WHEN** the project export endpoint builds its query
- **THEN** the query selects the sprint name, the task title, status and priority, and the assignee name, and nothing else

#### Scenario: Listing endpoints do not load credential material
- **WHEN** any read endpoint lists users or members
- **THEN** the password hash is not part of the loaded fields

### Requirement: The exported report is covered by automated acceptance tests
The export functionality SHALL be covered by automated tests that exercise the acceptance scenarios defined for the iteration: exporting a project with no data, exporting content with accented characters, embedded quotes and commas, and the browser starting a download with the expected file name. Each of these scenarios SHALL have a test that fails against a defective implementation.

#### Scenario: Empty project export is verified
- **WHEN** the export tests run against a project with no sprints
- **THEN** a test asserts that the response body contains only the header row

#### Scenario: Special character escaping is verified
- **WHEN** the export tests run against a project whose task titles contain accented characters, embedded double quotes and commas
- **THEN** a test parses the response and asserts that every data row has exactly six columns and that the special characters round-trip unchanged

#### Scenario: Download file name is verified
- **WHEN** the export tests trigger the download from the interface
- **THEN** a test asserts that the browser starts a download with the name `project-{id}-report.csv`

#### Scenario: The escaping test fails against the defective implementation
- **WHEN** the special character test is evaluated against an implementation that quotes only the task title and does not double embedded quotes
- **THEN** the test fails, because the parsed row has more than six columns

### Requirement: The end-to-end lifecycle test reaches the export
The end-to-end suite SHALL contain a test that runs the complete project lifecycle from project creation to the final export, asserting that the export can be performed and that the downloaded file has the expected content, so that a regression between the creation flows and the export is detected.

#### Scenario: Lifecycle test covers creation through export
- **WHEN** the end-to-end suite runs
- **THEN** a test creates a project, drives it through its planning, execution and evaluation steps, downloads the export and asserts on the downloaded file's content

### Requirement: The test report of record reflects the real state of the suite
The project's test report SHALL list, for every iteration, the functionality covered and the automated test that covers it, and SHALL NOT report a capability as pending or approved when no such test exists.

#### Scenario: Export functionality is listed with its test
- **WHEN** the test report is read
- **THEN** the export functionality of the final iteration names the test file that covers it and is not marked as pending

#### Scenario: Pending entries correspond to real gaps
- **WHEN** any entry in the test report is marked as pending
- **THEN** that entry corresponds to functionality with no automated test