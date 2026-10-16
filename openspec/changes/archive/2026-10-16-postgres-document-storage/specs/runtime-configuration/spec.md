# Spec Delta

## MODIFIED Requirements

### Requirement: The environment variables of the project are declared in a template
The repository SHALL ship `.env.example` documenting every environment variable the server reads, including `NODE_ENV`, the API rate-limit variables `API_RATE_LIMIT_MAX` and `API_RATE_LIMIT_WINDOW_MS`, the deployment port `PORT`, the document storage backend `STORAGE_BACKEND` and the uploads directory `UPLOADS_DIR` (read only by the `disk` backend), each with a safe placeholder or its development value and an indication of whether it is required.

#### Scenario: Every read variable is documented
- **WHEN** the variables read by the server are compared with `.env.example`
- **THEN** each of them appears in the template, including `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `API_PORT`, `PORT`, `STORAGE_BACKEND`, `UPLOADS_DIR`, `API_RATE_LIMIT_MAX` and `API_RATE_LIMIT_WINDOW_MS`

#### Scenario: Template carries no real secret
- **WHEN** `.env.example` is inspected
- **THEN** the only value for the signing secret is a placeholder that production startup rejects

#### Scenario: A contributor can configure the project from the template
- **WHEN** a contributor copies `.env.example` to a local environment file and fills in the development values
- **THEN** the server starts in development without further configuration

## REMOVED Requirements

### Requirement: El directorio de uploads es configurable
**Reason**: Un directorio configurable sigue perdiendo todos los archivos cuando la plataforma de despliegue no ofrece disco persistente, que es exactamente el caso del plan gratuito en uso. El destino del almacenamiento se generaliza a un backend seleccionable, especificado en la capacidad `document-storage`, del cual el directorio de uploads pasa a ser una implementación entre dos.

**Migration**: En un despliegue sin disco persistente, definir `STORAGE_BACKEND=postgres` para guardar los bytes en la base de datos. El backend de disco sigue honrando `UPLOADS_DIR`, de modo que el desarrollo local y el despliegue con volumen persistente no necesitan cambios.
