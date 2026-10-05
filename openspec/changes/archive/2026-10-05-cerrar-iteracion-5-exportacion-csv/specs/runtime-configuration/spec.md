## ADDED Requirements

### Requirement: Server startup distinguishes development from production
The server SHALL derive an explicit environment flag from `NODE_ENV` at startup and SHALL identify that environment in the startup log, so that an operator can tell from the logs whether the process is running a development or a production configuration without inspecting the process environment. The environment SHALL NOT be inferred implicitly in scattered places: the flag SHALL be computed once at startup and reused wherever the behaviour depends on it.

#### Scenario: Startup log announces the environment
- **WHEN** the server starts with `NODE_ENV=production`
- **THEN** the startup log states that the process is running in production

#### Scenario: Startup log announces development
- **WHEN** the server starts without `NODE_ENV` set, or with any other value
- **THEN** the startup log states that the process is running in development

### Requirement: Production startup refuses an insecure configuration
When running in production, the server SHALL validate its configuration before accepting traffic and SHALL refuse to start, with an error naming the offending variable, when the configuration would be insecure: when `JWT_SECRET` is absent, is the example value shipped in `.env.example`, or is shorter than 32 characters; or when `CORS_ORIGINS` contains a `localhost` origin. When running in development the server SHALL NOT apply these restrictions, so that a short secret or a local origin does not block a contributor.

#### Scenario: Default secret blocks production startup
- **WHEN** the server starts in production with the example `JWT_SECRET` value from `.env.example`
- **THEN** it exits with an error naming `JWT_SECRET` and does not begin listening

#### Scenario: Short secret blocks production startup
- **WHEN** the server starts in production with a `JWT_SECRET` shorter than 32 characters
- **THEN** it exits with an error naming `JWT_SECRET` and does not begin listening

#### Scenario: Local origin blocks production startup
- **WHEN** the server starts in production with a `localhost` entry in `CORS_ORIGINS`
- **THEN** it exits with an error naming `CORS_ORIGINS` and does not begin listening

#### Scenario: Valid production configuration starts
- **WHEN** the server starts in production with a strong `JWT_SECRET` and no local origin
- **THEN** it begins listening and reports its environment

#### Scenario: Development is not subject to production restrictions
- **WHEN** the server starts in development with a short `JWT_SECRET` or a `localhost` origin
- **THEN** it begins listening normally

### Requirement: A missing signing secret is always fatal
The server SHALL refuse to start when `JWT_SECRET` is absent from its configuration, in every environment, since without it no session can be signed. This check SHALL NOT be replaced by a fallback value.

#### Scenario: Missing secret blocks startup in any environment
- **WHEN** the server starts with no `JWT_SECRET` configured
- **THEN** it exits with an error identifying the missing variable and does not begin listening

### Requirement: The environment variables of the project are declared in a template
The repository SHALL ship `.env.example` documenting every environment variable the server reads, including `NODE_ENV`, each with a safe placeholder or its development value and an indication of whether it is required. No secret value SHALL appear in the template other than a clearly marked placeholder.

#### Scenario: Every read variable is documented
- **WHEN** the variables read by the server are compared with `.env.example`
- **THEN** each of them appears in the template, including `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS` and `API_PORT`

#### Scenario: Template carries no real secret
- **WHEN** `.env.example` is inspected
- **THEN** the only value for the signing secret is a placeholder that production startup rejects

#### Scenario: A contributor can configure the project from the template
- **WHEN** a contributor copies `.env.example` to a local environment file and fills in the development values
- **THEN** the server starts in development without further configuration
