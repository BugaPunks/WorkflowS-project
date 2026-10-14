# Spec Delta

## Purpose

Permite que el frontend se despliegue en un origen distinto del API: resuelve el origen del API en tiempo de build, adjunta credenciales de sesión a cada petición y construye URLs absolutas para los recursos servidos por el API.

## ADDED Requirements

### Requirement: El origen del API es configurable en tiempo de build

El frontend SHALL resolver el origen del API a partir de una variable pública de build (`PUBLIC_API_URL`). Cuando la variable está definida, toda petición al API SHALL dirigirse a `<PUBLIC_API_URL>/api`; cuando está ausente, las peticiones SHALL usar la ruta relativa `/api`, preservando el funcionamiento mediante proxy en desarrollo. El origen SHALL resolverse en un único módulo del cliente, no mediante rutas codificadas en cada componente.

#### Scenario: Build sin variable usa rutas relativas
- **WHEN** el frontend se compila sin `PUBLIC_API_URL`
- **THEN** las peticiones al API se dirigen a la ruta relativa `/api` del propio origen

#### Scenario: Build con variable apunta al origen del API
- **WHEN** el frontend se compila con `PUBLIC_API_URL=https://api.dominio.test`
- **THEN** las peticiones al API se dirigen a `https://api.dominio.test/api/...`

#### Scenario: Las llamadas del API pasan por una única función del cliente
- **WHEN** un componente del frontend necesita consultar el API
- **THEN** la petición se construye a través de la función de cliente compartida y no con una ruta relativa codificada en el componente

### Requirement: Cada petición al API adjunta credenciales de sesión

Toda petición del frontend al API SHALL enviarse con credenciales de sesión, de modo que la cookie de sesión viaje aunque el API esté en un origen distinto del que sirve la aplicación.

#### Scenario: La cookie de sesión viaja en una petición cross-origin
- **WHEN** un usuario autenticado realiza una petición al API desde el origen del frontend
- **THEN** la petición incluye las credenciales y el API autoriza la sesión

#### Scenario: La subida de archivos adjunta credenciales
- **WHEN** el frontend sube un documento mediante `multipart/form-data`
- **THEN** la petición incluye las credenciales

### Requirement: Los recursos servidos por el API se enlazan contra el origen del API

Los enlaces a archivos servidos por el API (documentos y sus versiones) SHALL resolverse como URLs absolutas contra el origen del API, de modo que abrir un enlace de descarga desde el frontend no apunte al origen del frontend. Las URLs almacenadas SHALL permanecer relativas al API, sin acoplarse a un origen concreto.

#### Scenario: Descarga de un documento desde el origen del API
- **WHEN** el usuario abre el enlace de descarga de un documento cuya URL almacenada es `/api/files/<archivo>`
- **THEN** la navegación se dirige a `<origen del API>/api/files/<archivo>`

#### Scenario: El enlace respeta el origen configurado
- **WHEN** el frontend se ejecuta con `PUBLIC_API_URL` definida y el usuario abre la descarga de un documento
- **THEN** el enlace apunta al origen del API configurado y no al origen del frontend

### Requirement: La variable pública del API está documentada

El repositorio SHALL documentar `PUBLIC_API_URL` en `.env.example`, indicando que solo aplica al build del frontend y su valor por defecto (vacío, que produce rutas relativas `/api`).

#### Scenario: La variable aparece documentada
- **WHEN** se inspecciona `.env.example`
- **THEN** `PUBLIC_API_URL` aparece documentada con su valor por defecto y una nota de que es una variable de build del frontend

### Requirement: La separación de orígenes está cubierta por pruebas automatizadas

La configuración de cliente cross-origin SHALL estar cubierta por pruebas automatizadas: pruebas unitarias de la resolución de la URL base y del prefijado de las peticiones, y una prueba end-to-end que ejecute la aplicación con el frontend y el API en orígenes distintos y verifique login, transporte de la sesión y descarga de documentos.

#### Scenario: Prueba unitaria del prefijado de la URL base
- **WHEN** se ejecuta la prueba unitaria del cliente con `PUBLIC_API_URL` definida
- **THEN** la URL construida por una llamada del cliente empieza por el origen configurado

#### Scenario: Prueba end-to-end con orígenes separados
- **WHEN** se ejecuta el comando end-to-end de separación
- **THEN** la aplicación carga desde el origen del frontend, el login se completa contra el origen del API, la sesión persiste entre peticiones y un documento se descarga desde el origen del API
