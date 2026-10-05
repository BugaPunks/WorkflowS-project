## ADDED Requirements

### Requirement: Project data is exportable as a CSV report with a fixed column structure
The system SHALL allow an authorized teacher to export the data of a project as a downloadable CSV file. The file SHALL contain a header row with exactly the columns `Sprint`, `Tarea`, `Asignado`, `Estado`, `Prioridad` and `Puntos`, in that order, and one row per task of the project, iterating the project's sprints and, within each sprint, its tasks. A task with no assignee SHALL report `Sin asignar` in the `Asignado` column, and the `Puntos` column SHALL report `N/A`, since tasks do not carry story points. A project with no sprints or no tasks SHALL produce a file containing only the header row.

#### Scenario: Header and columns of a populated export
- **WHEN** an authorized teacher exports a project with two sprints and three tasks
- **THEN** the file's first line is the header `Sprint,Tarea,Asignado,Estado,Prioridad,Puntos` and the file contains exactly three further lines, one per task

#### Scenario: Task without assignee
- **WHEN** a task in the exported project has no assignee
- **THEN** its row reports the literal text `Sin asignar` in the `Asignado` column

#### Scenario: Points column is not applicable to tasks
- **WHEN** any task is exported
- **THEN** its row reports the literal text `N/A` in the `Puntos` column

#### Scenario: Project without sprints
- **WHEN** an authorized teacher exports a project that has no sprints
- **THEN** the downloaded file contains only the header row and no data rows

#### Scenario: Sprints are traversed in order, tasks within each sprint
- **WHEN** a project has two sprints, each with its own tasks
- **THEN** every row of a sprint's tasks carries that sprint's name in the `Sprint` column, and the rows of each sprint appear grouped together

### Requirement: Every CSV field is escaped so that any content yields six columns
Every value written to the file SHALL be escaped according to RFC 4180: a field SHALL be enclosed in double quotes, and any double quote inside the value SHALL be doubled. A field SHALL be quoted regardless of its content, so that no value can split a row into extra columns. The generated file SHALL parse into exactly six columns per data row for any combination of accented characters, commas, double quotes, semicolons or line breaks in the sprint name, task title or assignee name. Escaping SHALL NOT alter the value a spreadsheet displays: after parsing, the title `Diseño "login", con ácentos` SHALL read exactly as it was stored.

#### Scenario: Title containing quotes and commas
- **WHEN** a task is titled `Diseño "login", con ácentos`
- **THEN** its row parses into exactly six columns and the parsed title is identical to the stored title

#### Scenario: Sprint name containing a comma
- **WHEN** the sprint name contains a comma
- **THEN** the exported row still parses into exactly six columns and the parsed sprint name is identical to the stored name

#### Scenario: Assignee name containing a comma
- **WHEN** a task's assignee name contains a comma
- **THEN** the exported row still parses into exactly six columns and the parsed assignee name is identical to the stored name

#### Scenario: Title containing a line break
- **WHEN** a task title contains a line break
- **THEN** the title is preserved inside its quoted field and the following tasks are not merged into its row

#### Scenario: Value that would be interpreted as a spreadsheet formula
- **WHEN** a task title begins with a character that a spreadsheet would evaluate as a formula
- **THEN** the value is neutralized so that opening the file does not execute or evaluate it, and this neutralization is applied before the RFC 4180 escaping

### Requirement: The exported file is UTF-8 with a byte order mark so accented text survives
The generated file SHALL be encoded as UTF-8 and SHALL begin with a byte order mark, so that spreadsheet software opens accented characters correctly without manual re-encoding. The byte order mark SHALL be the only difference between the first header field as stored in the file and the header text itself; a consumer that strips the mark SHALL read the header exactly as `Sprint,Tarea,Asignado,Estado,Prioridad,Puntos`.

#### Scenario: Accented characters survive a round trip
- **WHEN** a task title contains `ñ`, `á` and `é` and the file is opened in a spreadsheet application
- **THEN** the characters are displayed as they were stored, without replacement characters

#### Scenario: Header is readable once the mark is stripped
- **WHEN** the first bytes of the file are inspected
- **THEN** they are the UTF-8 byte order mark followed by the header `Sprint,Tarea,Asignado,Estado,Prioridad,Puntos`

### Requirement: The CSV response is delivered as a downloadable attachment
The export SHALL be served as a downloadable file with the media type `text/csv` and a `Content-Disposition` header of type `attachment` whose file name is `project-{projectId}-report.csv`, where `{projectId}` is the identifier of the exported project. The response SHALL NOT require the client to interpret the body as JSON.

#### Scenario: Response headers of a successful export
- **WHEN** an authorized teacher requests the export of a project
- **THEN** the response carries `Content-Type: text/csv`, a `Content-Disposition` of type `attachment`, and a file name equal to `project-{id}-report.csv` for that project

#### Scenario: Browser downloads with the expected name
- **WHEN** the teacher triggers the download from the reports interface
- **THEN** the browser starts a download whose file name is `project-{id}-report.csv`

### Requirement: The export can be narrowed to a single sprint
The export SHALL accept an optional `sprintId` parameter that restricts the file to the tasks of that sprint, satisfying the teacher-facing criterion that specific data can be selected. When the parameter is absent, the file SHALL contain every sprint of the project, which is the same content the export produced before the parameter existed. When the parameter names a sprint that does not exist or does not belong to the requested project, the system SHALL reject the request with a client error status and SHALL NOT return a file that could be mistaken for a complete export.

#### Scenario: Export of a single sprint
- **WHEN** an authorized teacher requests the export of a project with a valid `sprintId`
- **THEN** the file contains only the header and the rows of the tasks of that sprint

#### Scenario: Export without the parameter is unchanged
- **WHEN** an authorized teacher requests the export of a project without a `sprintId`
- **THEN** the file contains the header and one row per task of every sprint of the project

#### Scenario: Sprint from another project is rejected
- **WHEN** an authorized teacher requests the export of a project passing a `sprintId` that belongs to a different project
- **THEN** the server responds with a client error status and no CSV file is returned

#### Scenario: Non-existent sprint is rejected
- **WHEN** an authorized teacher requests the export of a project passing a `sprintId` that does not exist
- **THEN** the server responds with a client error status and no CSV file is returned

### Requirement: The reports interface lets the teacher choose the scope and download the file
The reports interface SHALL offer the teacher a control to choose which sprint to export, with an option to export all sprints, and SHALL disable the export control while no project is selected. Triggering the export SHALL download the file with the name announced by the server, and SHALL report an error in the interface when the server does not return a CSV file, so that a failed export is never presented as a silent success.

#### Scenario: Export control is disabled without a project
- **WHEN** no project is selected in the reports interface
- **THEN** the export control cannot be triggered

#### Scenario: Choosing a sprint narrows the download
- **WHEN** the teacher selects a specific sprint and triggers the export
- **THEN** the downloaded file contains only the rows of that sprint

#### Scenario: Choosing all sprints keeps the full download
- **WHEN** the teacher selects the all-sprints option and triggers the export
- **THEN** the downloaded file contains the rows of every sprint of the project

#### Scenario: A failed export is reported
- **WHEN** the export request does not return a CSV file
- **THEN** the interface displays an error and does not present an empty or blank download as a result

### Requirement: The export reads only the fields it needs
Building the export SHALL request from the database only the fields the file contains: the sprint name, the task title, status and priority, and the assignee name. The query SHALL NOT retrieve columns outside that set, and in particular SHALL NOT retrieve credential material such as password hashes.

#### Scenario: No credential material is loaded for an export
- **WHEN** the export of a project with assigned tasks is served
- **THEN** the data loaded for the file consists only of the sprint name, the task title, status, priority and the assignee name

### Requirement: Only the teacher role can export project data
The export SHALL be available only to the teacher role (ADMIN), both through the reports interface and through the API. Any other authenticated role requesting the export SHALL be denied with a client error status and SHALL NOT receive project data. No role other than the teacher role SHALL be offered the export control.

#### Scenario: Non-teacher is denied the export API
- **WHEN** an authenticated member with a role other than ADMIN requests the export of a project
- **THEN** the server responds `403` and no CSV file is returned

#### Scenario: Teacher keeps access to the export
- **WHEN** an ADMIN requests the export of a project
- **THEN** the server responds `200` with the CSV file

#### Scenario: Non-teacher is not offered the export control
- **WHEN** a member with a role other than ADMIN opens the reports interface
- **THEN** the export control is not present
