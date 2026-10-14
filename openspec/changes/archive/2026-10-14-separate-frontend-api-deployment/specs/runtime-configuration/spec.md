# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
