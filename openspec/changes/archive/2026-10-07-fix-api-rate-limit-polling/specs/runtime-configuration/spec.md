## MODIFIED Requirements

### Requirement: The environment variables of the project are declared in a template
The repository SHALL ship `.env.example` documenting every environment variable the server reads, including `NODE_ENV` and the API rate-limit variables `API_RATE_LIMIT_MAX` and `API_RATE_LIMIT_WINDOW_MS`, each with a safe placeholder or its development value and an indication of whether it is required. No secret value SHALL appear in the template other than a clearly marked placeholder.

#### Scenario: Every read variable is documented
- **WHEN** the variables read by the server are compared with `.env.example`
- **THEN** each of them appears in the template, including `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `API_PORT`, `API_RATE_LIMIT_MAX` and `API_RATE_LIMIT_WINDOW_MS`

#### Scenario: Template carries no real secret
- **WHEN** `.env.example` is inspected
- **THEN** the only value for the signing secret is a placeholder that production startup rejects

#### Scenario: A contributor can configure the project from the template
- **WHEN** a contributor copies `.env.example` to a local environment file and fills in the development values
- **THEN** the server starts in development without further configuration