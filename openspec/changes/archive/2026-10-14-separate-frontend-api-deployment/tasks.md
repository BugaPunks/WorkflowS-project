# Tasks

## 1. Cliente API del frontend

- [x] 1.1 Crear `src/api/config.ts` con `API_ORIGIN` (derivado de `PUBLIC_API_URL`, normalizando la barra final), `API_BASE_URL` (`<origen>/api` o `/api`), `apiFetch(path, options)` (prefija la base, añade `credentials: "include"`, no toca cabeceras ni el cuerpo) y `resolveApiUrl(url)`. Extraer helpers puros (p. ej. `resolveApiBaseUrl(origin)` y `buildApiUrl(origin, path)`) para poder probarlos. Declarar `PUBLIC_API_URL` en `src/env.d.ts`. Verificación: `npx tsc --noEmit` en verde.
- [x] 1.2 Añadir `src/api/config.test.ts` (vitest) sobre los helpers puros: con origen definido la URL queda prefijada por ese origen; sin origen queda relativa `/api`; una barra final en `PUBLIC_API_URL` no produce `//api`. Verificación: `npm run test` en verde con esos casos.
- [x] 1.3 Migrar `src/api/client.ts` para usar `API_BASE_URL`/`apiFetch`, y reemplazar las 57 llamadas `fetch("/api/...")` de los 23 archivos (`src/auth/*`, `src/components/*`, `src/hooks/useSession.tsx`, `src/pages/**`) por `apiFetch("/...")`. Verificación: `grep -rE 'fetch\([\`"]/api' src --include='*.tsx' --include='*.ts' | grep -v /server/` sin resultados, `npx tsc --noEmit` y `npm run test` en verde.
- [x] 1.4 En `src/pages/ProjectDetailSections/DocumentsSection.tsx`, resolver `doc.url` y `ver.url` con `resolveApiUrl` en los enlaces de descarga. Verificación: cubierto por la prueba e2e de separación de la sección 4.
- [x] 1.5 Documentar `PUBLIC_API_URL` en `.env.example` (valor por defecto vacío; variable de build solo del frontend). Verificación: inspección del archivo.

## 2. Configurabilidad del backend

- [x] 2.1 En `src/server/index.ts`, escuchar en `process.env.PORT ?? process.env.API_PORT ?? 5000`. Verificación: arrancar con `PORT=5123 npx tsx src/server/index.ts` y comprobar `curl http://localhost:5123/api/health`.
- [x] 2.2 Introducir `UPLOADS_DIR` (por defecto `uploads/`) y usarlo de forma consistente en la creación del directorio (`src/server/index.ts`), el `destination` de multer (`src/server/routes/documents.ts`) y la lectura del archivo (`src/server/routes/files.ts`). Verificación: prueba automatizada que, con un `UPLOADS_DIR` temporal, sube un documento y lo descarga desde ese directorio.
- [x] 2.3 Revisar `Cross-Origin-Resource-Policy` de `helmet()` y, si bloquea el consumo cross-origin de recursos del API, relajarlo. Verificación: una respuesta del API consumida desde el origen del frontend no se bloquea (cubierto en la sección 4).
- [x] 2.4 Documentar `PORT` y `UPLOADS_DIR` en `.env.example`. Verificación: inspección del archivo.

## 3. Empaquetado y despliegue

- [x] 3.1 En `package.json`, añadir `start` (arranque del API), `postinstall` (`prisma generate`) y asegurar que `tsx` y `prisma` están disponibles en runtime. Verificación: `npm run start` arranca el API en desarrollo.
- [x] 3.2 Añadir el SPA fallback del frontend estático (rewrite de todas las rutas a `/index.html`) para el hosting elegido. Verificación: `npm run build && npm run preview` y recargar una ruta profunda (p. ej. `/projects/<id>/tasks`) devuelve la app.
- [x] 3.3 Crear `docs/DEPLOYMENT.md` documentando: variables del frontend (`PUBLIC_API_URL`) y del API (`NODE_ENV`, `DATABASE_URL`, `JWT_SECRET` ≥32, `CORS_ORIGINS` con el origen exacto del frontend, `UPLOADS_DIR`), despliegue en subdominios del mismo dominio, volumen persistente para uploads y `prisma migrate deploy` en el release. Verificación: seguir el documento permite arrancar frontend y API en orígenes distintos.

## 4. Verificación end-to-end de la separación (Playwright)

- [x] 4.1 Crear `playwright.separation.config.ts` (`testDir: ./e2e/separation`, `workers: 1`) con dos `webServer`: API en `:5000` con `CORS_ORIGINS=http://localhost:3000`, `DISABLE_RATE_LIMIT=true`, `UPLOADS_DIR=.e2e-separation-uploads` y `DATABASE_URL`; y `rsbuild dev` en `:3000` con `PUBLIC_API_URL=http://localhost:5000`. Añadir el script `e2e:separation` y `.e2e-separation-uploads/` a `.gitignore`. Verificación: `npm run e2e:separation` levanta ambos orígenes y ejecuta la suite.
- [x] 4.2 Crear `e2e/separation/separation.spec.ts`: registrar un usuario fresco contra el origen del API, iniciar sesión desde la interfaz (comprobando que la petición de login va a `http://localhost:5000`), verificar que una petición con credenciales a un endpoint protegido responde 200 (la cookie cruzó orígenes), y comprobar que el enlace de descarga de un documento apunta a `http://localhost:5000/api/files/...` y el archivo se obtiene desde ese origen. Verificación: `npm run e2e:separation` en verde.
- [x] 4.3 Documentar el comando `e2e:separation` en `docs/DEPLOYMENT.md`. Verificación: inspección del documento.

## 5. Verificación de integración

- [x] 5.1 `npm run check` y `npx tsc --noEmit` en verde.
- [x] 5.2 `npm run test` (unit) en verde.
- [x] 5.3 `npm run e2e` en verde (sin regresiones en el escenario same-origin).
- [x] 5.4 `npm run e2e:separation` en verde.
- [x] 5.5 `openspec validate --all` en verde.

## Workflow follow-up

- Archivar el change con `openspec archive separate-frontend-api-deployment --yes` tras completar la verificación.
