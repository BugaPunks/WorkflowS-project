## MODIFIED Requirements

### Requirement: Evaluation and performance views are restricted to the teacher role
The evaluations route, the reports route and the individual-contribution metric SHALL be reachable only by an ADMIN, and the project data export SHALL be returned only to an ADMIN. Any other authenticated role requesting them SHALL be denied, in the interface and in the API, so that grading data, project reports and team performance are not exposed to students. No navigation entry, welcome panel or control offered to a role other than the teacher SHALL link to a restricted view, since such a link leads to a redirect instead of the view it advertises.

#### Scenario: Student is denied the evaluations route
- **WHEN** a member with role `TEAM_DEVELOPER` navigates to the evaluations route
- **THEN** the evaluations view is not rendered and the user is redirected away from it

#### Scenario: Student is denied the evaluations API
- **WHEN** a member requests the evaluations list for a project
- **THEN** the server responds `403`

#### Scenario: Student is denied individual contribution
- **WHEN** a member requests the individual-contribution metric of a project
- **THEN** the server responds `403` and no performance data is returned

#### Scenario: Student is denied the reports route
- **WHEN** a member with role `TEAM_DEVELOPER` navigates to the reports route
- **THEN** the reports view is not rendered and the user is redirected away from it

#### Scenario: Student is denied the export API
- **WHEN** a member requests the project data export
- **THEN** the server responds `403` and no file is returned

#### Scenario: Teacher keeps access
- **WHEN** an ADMIN requests the evaluations list, the individual-contribution metric or the project data export
- **THEN** the server responds `200` with the data

#### Scenario: Students retain their own grades
- **WHEN** a member requests their own evaluations
- **THEN** the server responds `200` with only that member's own records

#### Scenario: Restricted views are not advertised to other roles
- **WHEN** a member with a role other than ADMIN views the navigation sidebar and their welcome panel
- **THEN** no entry links to the evaluations route or to the reports route
