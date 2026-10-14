# Design

## Context

Ver `proposal.md` — Why. Estado relevante: el bundle del frontend llama al API con rutas relativas `/api` (57 llamadas en 23 archivos) y solo dos sitios envían credenciales; el servidor Express sirve `/api` en `API_PORT` y guarda uploads en `uploads/` relativo; las URLs de documentos se almacenan relativas (`/api/files/...`). No existe Docker/CI ni configuración de PaaS.

Restricciones que moldean el diseño: la autenticación es por cookie `httpOnly` `SameSite=Lax` (spec `user-auth`); el middleware `authenticateToken` lee la cookie antes del header `Authorization`; la validación de arranque en producción rechaza un `CORS_ORIGINS` con `localhost` y un `JWT_SECRET` débil (spec `runtime-configuration`); no hay aislamiento de datos entre tests e2e (una base de datos de desarrollo compartida).

## Goals / Non-Goals

**Goals:**
- Desacoplar el origen del API del origen que sirve el frontend, con un cambio de configuración, no de lógica de negocio.
- Mantener intacto el flujo de desarrollo actual (proxy de Rsbuild) y la spec `user-auth`.
- Que el despliegue sea reproducible: puerto, uploads y origen del API configurables por entorno.

**Non-Goals:**
- Migrar los uploads a almacenamiento de objetos (S3/Cloudinary). Se documenta como evolución posterior; aquí basta un volumen persistente.
- Cambiar el esquema de Prisma o el contrato de las respuestas del API.
- Autenticación por Bearer token (solo sería necesaria con orígenes que no comparten dominio registrable; descartado en D1).
- Reorganizar el repositorio en dos paquetes/repos.

## Decisions

### D1 — Subdominios del mismo dominio registrable (no dominios distintos)

Frontend en `app.<dominio>` y API en `api.<dominio>`. Comparten dominio registrable, así que son el **mismo sitio**: la cookie `SameSite=Lax` es *first-party* y se sigue enviando, por lo que `src/server/routes/auth.ts` y la spec `user-auth` no cambian.

Alternativas descartadas:
- **Dominios distintos** (`*.vercel.app` + `*.onrender.com`): la cookie sería de terceros; Safari la bloquea por defecto y Chrome la restringe, y `SameSite=None; Secure` no garantiza persistencia. Obligaría a Bearer token en `localStorage` (más superficie de XSS).
- **Mismo dominio con reverse proxy**: es lo que el proyecto ya soporta, pero no separa los despliegues, que es el objetivo.

### D2 — Origen del API resuelto en tiempo de build con `PUBLIC_API_URL`

Rsbuild expone a `import.meta.env` toda variable de `process.env` prefijada con `PUBLIC_` (verificado en el `loadEnv` de `@rsbuild/core`: recorre `process.env` y hace `define` de `import.meta.env.PUBLIC_*`). Una variable de build evita un archivo `config.js` mutable servido con los estáticos.

- `PUBLIC_API_URL` definida → `API_ORIGIN` es ese valor (se normaliza quitando la barra final).
- Ausente → `API_ORIGIN` vacío → `API_BASE_URL` es `/api` (proxy de desarrollo intacto).

Alternativa descartada: configuración en runtime (p. ej. `window.__API__` inyectado en el HTML) — complica el hosting estático y aporta poco para este proyecto.

### D3 — Fuente única `src/api/config.ts`

Exporta `API_ORIGIN`, `API_BASE_URL` y dos helpers:

- `apiFetch(path, options)`: devuelve `fetch(`${API_BASE_URL}${path}`, { credentials: "include", ...options })`. **No** añade `Content-Type` ni transforma el cuerpo, para no romper los envíos `FormData` ni el manejo de `Response` existente.
- `resolveApiUrl(url)`: convierte una URL relativa del API (`/api/...`) en absoluta contra `API_ORIGIN`; si `API_ORIGIN` está vacío, la deja intacta.

`src/api/client.ts` deja de calcular su propia base y usa `API_BASE_URL`. Los 23 archivos migran de `fetch("/api/x")` a `apiFetch("/x")`.

Alternativas descartadas: interceptar `window.fetch` globalmente (implícito, difícil de testear, oculta el acoplamiento) y adoptar `axios` (dependencia nueva innecesaria).

### D4 — Credenciales en todas las llamadas

`apiFetch` impone `credentials: "include"`. Es imprescindible: sin ello, un `fetch` cross-origin no envía la cookie y cada endpoint protegido respondería 401 aunque el login haya funcionado. Hoy solo `client.ts` y `useSession.tsx` lo hacían.

### D5 — Las URLs de documentos siguen relativas en la base de datos

`src/server/routes/documents.ts` continúa guardando `/api/files/<archivo>`; el frontend resuelve el enlace con `resolveApiUrl` (`DocumentsSection`). Guardar URLs absolutas acoplaría la base de datos al origen del API y obligaría a migrar datos al cambiar de dominio.

### D6 — Puerto de escucha: `PORT ?? API_PORT ?? 5000`

En `src/server/index.ts`. Los PaaS inyectan `PORT`; mantener `API_PORT` preserva el desarrollo y `.env.example`. Cambio retrocompatible.

### D7 — Directorio de uploads configurable con `UPLOADS_DIR`

Se usa en los tres puntos que hoy asumen `"uploads"`: creación del directorio en `index.ts`, `destination` de multer en `documents.ts` y lectura en `files.ts`. En el PaaS se monta un **volumen persistente** en esa ruta, porque el disco por defecto es efímero y los documentos se perderían en cada redeploy.

Alternativa descartada (por ahora): almacenamiento de objetos. Se anota como evolución; añade credenciales y complejidad fuera del alcance.

### D8 — CORS, CSRF y helmet

- `CORS_ORIGINS` debe contener el origen exacto del frontend (`https://app.<dominio>`, sin barra final). El `Origin` que envía el navegador en peticiones cross-origin hace que la protección CSRF existente siga funcionando sin cambios.
- Se revisa `Cross-Origin-Resource-Policy` de `helmet()` (por defecto `same-origin`): si bloquea recursos servidos por el API cuando se consumen desde el origen del frontend, se relaja (`cross-origin`) en el API.

### D9 — Empaquetado y despliegue

- **Frontend (estático)**: `rsbuild build` → `dist/` con SPA fallback (rewrite de todo a `/index.html`) para React Router; variable `PUBLIC_API_URL` en el entorno de build.
- **API**: `package.json` con `start` y `postinstall` (`prisma generate`); `prisma migrate deploy` en el release; `tsx` y `prisma` accesibles en runtime (hoy son `devDependencies`, que un PaaS puede omitir con `NODE_ENV=production`).

### D10 — Verificación e2e con orígenes separados

`playwright.separation.config.ts` (nuevo; `testDir: ./e2e/separation`), con dos servidores:

- API en `:5000` con `CORS_ORIGINS=http://localhost:3000`, `DISABLE_RATE_LIMIT=true`, `UPLOADS_DIR=.e2e-separation-uploads` y `DATABASE_URL`.
- Frontend `rsbuild dev` en `:3000` con `PUBLIC_API_URL=http://localhost:5000`.

`localhost:3000` y `localhost:5000` son el **mismo sitio** (el puerto no cuenta para *same-site*), así que la cookie `Lax` viaja cross-origin igual que con subdominios en producción: el escenario es representativo sin DNS ni TLS.

Aserciones de `e2e/separation/*.spec.ts`: la petición de login se dirige a `http://localhost:5000`; tras el login, una petición con credenciales a un endpoint protegido responde 200 (la cookie cruzó orígenes); los enlaces de descarga de documentos apuntan a `http://localhost:5000/api/files/...` y el archivo se obtiene desde ese origen. Las pruebas crean usuarios frescos y usan un `UPLOADS_DIR` aislado para no contaminar el estado compartido.

Alternativa descartada: servir el `dist` compilado en otro puerto (más fiel al bundle final) — requiere un build extra y un servidor de estáticos; el prefijado del bundle ya queda cubierto por los unit tests del cliente, así que se prioriza la simplicidad del dev server, que inyecta `PUBLIC_API_URL` por el mismo mecanismo.

El comando se documenta como `npm run e2e:separation` (spec `quality-gates`), separado del `npm run e2e` existente para no alterar el escenario same-origin de la suite actual.

## Risks / Trade-offs

- [Estáticos en un PaaS con `PUBLIC_API_URL` mal configurada] → el bundle apunta a un origen inexistente; mitigado por el unit test del prefijado y por documentar la variable en `.env.example`.
- [Uploads efímeros si no se monta volumen] → documentos desaparecen en cada redeploy; mitigado por D7 y verificado por el escenario "persiste tras reiniciar".
- [`Cross-Origin-Resource-Policy: same-origin` de helmet] → recursos del API bloqueados cross-origin; mitigado revisando y relajando en D8.
- [`CORS_ORIGINS` desalineado con el origen real] → CORS y CSRF responden 403; mitigado documentando el valor exacto y porque la validación de producción ya rechaza `localhost`.
- [`devDependencies` omitidas en el PaaS] → `prisma`/`tsx` no disponibles en runtime; mitigado moviéndolas a `dependencies` (D9).
- [PostgreSQL gestionado exige SSL] → el `Pool` de `pg` podría necesitar `sslmode=require`/`ssl`; a verificar al conectar el entorno real.
- [Suite e2e sin aislamiento por worker] → mitigado con usuarios frescos, `UPLOADS_DIR` aislado y `workers: 1`.
- [Normalización de `PUBLIC_API_URL`] → una barra final produciría `//api`; se normaliza y se cubre con unit test.

## Migration Plan

1. Frontend: añadir `src/api/config.ts`, migrar `client.ts` y las 57 llamadas. Sin `PUBLIC_API_URL` el comportamiento en desarrollo no cambia.
2. Backend: `PORT`, `UPLOADS_DIR` y revisión de CORP. Ambos con valores por defecto retrocompatibles.
3. Empaquetado: scripts de `package.json` y configuración SPA del hosting estático.
4. Tests: unit del cliente + `e2e:separation`.
5. Rollback: el frontend vuelve a same-origin simplemente sin definir `PUBLIC_API_URL`; el backend vuelve al comportamiento previo sin `PORT`/`UPLOADS_DIR`. No hay migración de datos ni cambios de esquema.

## Open Questions

- Proveedor de hosting definitivo (Vercel/Netlify para el frontend, Render/Railway para el API) y dominio final: no cambia los specs ni el enfoque; solo los valores concretos de `PUBLIC_API_URL` y `CORS_ORIGINS`.
- Migración futura de uploads a almacenamiento de objetos: diferida, no afecta a este cambio.
