# Proposal

## Why

El frontend y el API están acoplados a un mismo origen: el bundle llama al API con rutas relativas (`/api`, 57 llamadas repartidas en 23 archivos del frontend) y depende del proxy de Rsbuild en desarrollo o de un reverse proxy en producción. El plan de despliegue separa el frontend (estático, p. ej. Vercel/Netlify) del API (servicio, p. ej. Render/Railway) en **subdominios distintos del mismo dominio** (`app.dominio` + `api.dominio`). Con ese supuesto roto, las llamadas irían al origen del frontend (404), la cookie de sesión no se enviaría (el usuario vería 401 tras el login) y los enlaces de documentos quedarían rotos.

## What Changes

- **Origen del API configurable en el frontend**: nueva variable pública de build `PUBLIC_API_URL`; cuando no está definida, el frontend sigue usando rutas relativas `/api` (proxy de desarrollo intacto).
- **Fuente única del cliente**: nuevo `src/api/config.ts` con `apiFetch()` (prefija el origen del API y añade `credentials: "include"` a cada llamada) y `resolveApiUrl()` (construye URLs absolutas para recursos servidos por el API). Se migran las 57 llamadas `fetch("/api/...")` de los 23 archivos a `apiFetch`.
- **Enlaces de documentos**: `DocumentsSection` resuelve `doc.url` y las URLs del historial contra el origen del API.
- **Puerto del API compatible con PaaS**: el servidor escucha en `PORT` cuando el entorno de despliegue lo provee, con fallback a `API_PORT` y a `5000`.
- **Directorio de uploads configurable**: nueva variable `UPLOADS_DIR` usada de forma consistente por la subida (multer) y la descarga de archivos, para poder montar un volumen persistente.
- **Configuración de despliegue**: SPA rewrites para el frontend estático; script `start`, `postinstall` de Prisma y `prisma migrate deploy` para el API; revisión de `Cross-Origin-Resource-Policy` de helmet para permitir el consumo cross-origin.
- **Documentación**: `.env.example` documenta `PORT`, `UPLOADS_DIR` y `PUBLIC_API_URL`.
- **Tests**: unit tests del cliente (`apiFetch`/`resolveApiUrl`) y un comando e2e de Playwright documentado que verifica el escenario de orígenes separados (login cross-origin, sesión transportada por cookie, descarga de documentos contra el origen del API).

No es un cambio incompatible para el desarrollo actual: sin `PUBLIC_API_URL`, el frontend sigue hablando por `/api` relativo.

## Capabilities

### New Capabilities
- `frontend-api-client`: resuelve el origen del API en tiempo de build, adjunta credenciales a cada petición y construye URLs absolutas para recursos servidos por el API, de modo que el frontend pueda desplegarse en un origen distinto del API.

### Modified Capabilities
- `runtime-configuration`: el puerto de escucha acepta el `PORT` provisto por el entorno de despliegue y el directorio de uploads es configurable; el template documenta las nuevas variables.
- `quality-gates`: se añade un comando end-to-end documentado que verifica el escenario de despliegue con orígenes separados.

## Impact

- Frontend: `src/api/config.ts` (nuevo), `src/api/client.ts`, 23 archivos con llamadas al API (`src/auth/*`, `src/components/*`, `src/hooks/useSession.tsx`, `src/pages/**`), `src/pages/ProjectDetailSections/DocumentsSection.tsx`, `src/env.d.ts`, `rsbuild.config.ts`.
- Backend: `src/server/index.ts` (puerto, helmet/CORP), `src/server/routes/documents.ts` (destino de multer), `src/server/routes/files.ts` (lectura del directorio de uploads).
- Empaquetado/despliegue: `package.json` (scripts), configuración de Vercel/Netlify (SPA rewrites), `playwright.separation.config.ts` (nuevo) y `e2e/separation/*.spec.ts` (nuevo).
- Docs: `.env.example`.
