# Runtime configuration Capability

## Purpose

Derives and reports the server's runtime environment at startup, refuses insecure or incomplete configuration before accepting traffic, and documents every environment variable the project reads.

## Requirements

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
The repository SHALL ship `.env.example` documenting every environment variable the server reads, including `NODE_ENV`, the API rate-limit variables `API_RATE_LIMIT_MAX` and `API_RATE_LIMIT_WINDOW_MS`, the deployment port `PORT` and the uploads directory `UPLOADS_DIR`, each with a safe placeholder or its development value and an indication of whether it is required.

#### Scenario: Every read variable is documented
- **WHEN** the variables read by the server are compared with `.env.example`
- **THEN** each of them appears in the template, including `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `API_PORT`, `PORT`, `UPLOADS_DIR`, `API_RATE_LIMIT_MAX` and `API_RATE_LIMIT_WINDOW_MS`

#### Scenario: Template carries no real secret
- **WHEN** `.env.example` is inspected
- **THEN** the only value for the signing secret is a placeholder that production startup rejects

#### Scenario: A contributor can configure the project from the template
- **WHEN** a contributor copies `.env.example` to a local environment file and fills in the development values
- **THEN** the server starts in development without further configuration

### Requirement: El puerto de escucha acepta el valor provisto por el entorno de despliegue

El servidor SHALL escuchar en el puerto indicado por la variable `PORT` cuando esté presente, y SHALL recurrir a `API_PORT` y luego a `5000` cuando no lo esté, de modo que el servicio funcione detrás de una plataforma que inyecta su propio puerto sin configuración adicional.

#### Scenario: El entorno provee PORT
- **WHEN** el servidor arranca con `PORT` definido
- **THEN** escucha en ese puerto

#### Scenario: Sin PORT se usa API_PORT o el valor por defecto
- **WHEN** el servidor arranca sin `PORT` definido
- **THEN** escucha en `API_PORT` si está definido, o en `5000` en caso contrario

### Requirement: El directorio de uploads es configurable

El servidor SHALL almacenar los documentos subidos en el directorio indicado por `UPLOADS_DIR` (por defecto `uploads/`) y SHALL servirlos desde ese mismo directorio, de modo que un despliegue pueda montar un volumen persistente y un documento subido siga siendo descargable tras un reinicio.

#### Scenario: El documento se guarda y se sirve desde el directorio configurado
- **WHEN** el servidor se ejecuta con `UPLOADS_DIR` definido y un usuario sube un documento
- **THEN** el archivo se almacena en ese directorio y su descarga se resuelve desde el mismo

#### Scenario: Un documento persiste tras reiniciar
- **WHEN** el servidor se reinicia conservando el mismo `UPLOADS_DIR`
- **THEN** un documento subido antes del reinicio sigue siendo descargable

#### Scenario: Sin la variable se usa el directorio por defecto
- **WHEN** el servidor se ejecuta sin `UPLOADS_DIR`
- **THEN** almacena y sirve los documentos desde `uploads/`
