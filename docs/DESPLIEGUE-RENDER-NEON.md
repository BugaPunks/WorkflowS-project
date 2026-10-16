# Despliegue gratuito de WorkflowS (Render + Neon, sin tarjeta)

Guía paso a paso para publicar el proyecto para la defensa de grado usando solo
planes gratuitos y **sin tarjeta de crédito**. Se descartan Oracle y Azure.

## Arquitectura elegida

```
Navegador ──HTTPS──> Render Web Service (Docker)
                        ├── sirve el SPA compilado (dist/)
                        └── sirve /api  (Express)
                                  │
                                  └──> Neon PostgreSQL (datos persistentes)
```

Un **único servicio** sirve el frontend y el API en el **mismo origen**. Esto no
es solo comodidad: `onrender.com` figura en la Public Suffix List, así que
`algo.onrender.com` y `otro.onrender.com` son sitios distintos para el
navegador. Con la cookie de sesión en `SameSite=Lax`, un despliegue separado
(frontend y API en subdominios distintos) haría que el login se pierda al
siguiente request. En un mismo origen no hay CORS ni cookies de terceros de por
medio.

Por eso el archivo `render.yaml` declara un solo servicio web.

## Requisitos

| Recurso | Proveedor | Coste | Tarjeta |
|---|---|---|---|
| Cuenta GitHub | GitHub | Gratis | No |
| Backend + frontend | Render (plan free) | Gratis | No |
| PostgreSQL | Neon (plan free) | Gratis | No |

Limitaciones asumidas del plan gratuito de Render:

- El servicio **se duerme tras 15 minutos** sin tráfico. El primer request tarda
  ~50 s en despertar. Para la demo: abrir la URL un minuto antes, o usar un ping
  periódico a `/api/health` (ver "Evitar el cold start").
- **Disco efímero**: la carpeta `uploads/` se vacía en cada redeploy. Los datos
  de la base (Neon) sí persisten. Si necesitas conservar adjuntos, ver la
  sección "Persistencia de archivos subidos".

## Paso 1 — Crear la base de datos en Neon

1. Entra en https://neon.com y crea una cuenta (con GitHub, sin tarjeta).
2. Crea un proyecto. Neon crea la base `neondb` automáticamente.
3. Copia la **Connection string** del panel (botón *Connect*). Tiene esta forma:

   ```
   postgresql://usuario:clave@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```

   Deja el `?sslmode=require` al final: Neon exige TLS.

## Paso 2 — Subir el proyecto a GitHub

Los cambios de despliegue ya están en el árbol de trabajo. Revísalos y súbelos:

```bash
git add Dockerfile .dockerignore render.yaml package.json \
        prisma/schema.prisma prisma/migrations prisma/migrations.bak-sqlite-* \
        src/server/index.ts .env.example
git commit -m "chore: despliegue en Render con PostgreSQL"
git push
```

> Cambios clave incluidos: el provider de Prisma pasa de `sqlite` a
> `postgresql`, las migraciones se sustituyen por el baseline de Postgres, y el
> servidor sirve el SPA cuando existe `dist/`.

## Paso 3 — Crear el servicio en Render

1. Entra en https://render.com y crea una cuenta **con GitHub** (no pide
   tarjeta para el plan free).
2. *New* → **Blueprint** → selecciona el repositorio `WorkflowS-project`.
   Render lee `render.yaml` y muestra los datos que faltan.
3. Rellena:
   - `DATABASE_URL` → la cadena de Neon copiada en el paso 1.
   - `CORS_ORIGINS` → la URL pública del servicio, **sin barra final**
     (p. ej. `https://workflows.onrender.com`).
   - `JWT_SECRET` → Render lo genera solo (>= 32 caracteres).
     El servidor se niega a arrancar en producción si es corto o si sigue
     siendo el valor de ejemplo: es intencional.
4. *Apply* / *Create*. Render construye el `Dockerfile`.

**Orden importante:** el arranque de producción rechaza cualquier `CORS_ORIGINS`
con `localhost`. Si no conocías la URL antes de crear el servicio, Render
asignará una del tipo `https://workflows-xxxx.onrender.com`; cópiala, pégala en
`CORS_ORIGINS` y vuelve a desplegar. Mientras no lo hagas, el log mostrará
`✖ Configuración de producción insegura — CORS_ORIGINS` y el contenedor se
reiniciará. Eso es la validación de seguridad haciendo su trabajo, no un bug.

> **Migraciones a través del pooler.** Se probó contra una base real de Neon con
> el host que incluye `-pooler` y funcionaron tanto `prisma migrate deploy` como
> el seed, incluso con `channel_binding=require`. Si alguna migración fallara por
> el pooler, usa el host **directo** (el mismo sin `-pooler`) solo para migrar y
> deja el del pooler para el runtime.

## Paso 4 — Cargar datos de demostración (una sola vez)

Los datos viven en Neon, no en la imagen. Ejecuta el seed **contra Neon** desde
tu máquina (o desde la *Shell* del servicio en Render):

> **Ya está hecho.** Durante la validación del despliegue se aplicaron las
> migraciones y se ejecutó el seed contra la base de Neon `db_wrk`. Puedes saltar
> este paso; solo repítelo si cambias de base o quieres datos frescos.


```bash
# En tu máquina, con la cadena de Neon:
DATABASE_URL="postgresql://usuario:clave@...neon.tech/neondb?sslmode=require" \
  npx prisma db seed
```

En PowerShell:

```powershell
$env:DATABASE_URL="postgresql://usuario:clave@...neon.tech/neondb?sslmode=require"
npx prisma db seed
```

Usuarios de prueba que crea el seed:

| Email | Contraseña | Rol |
|---|---|---|
| `admin@workflow.com` | `admin123` | ADMIN |
| `dev1@workflow.com` ... `dev4` | `password123` | TEAM_DEVELOPER |

⚠️ Son credenciales públicas en este repositorio: para la defensa está bien, pero
cambia la contraseña del admin si vas a dejar el sitio público mucho tiempo.

## Paso 5 — Verificar

- `https://TU-URL.onrender.com/api/health` → `{"status":"ok",...}`
- `https://TU-URL.onrender.com/` → carga el SPA
- `https://TU-URL.onrender.com/cualquier/ruta` → también carga el SPA (fallback de React Router)
- Inicia sesión con `admin@workflow.com` / `admin123` y navega: si la sesión se
  mantiene al recargar, las cookies y el mismo origen funcionan.

## Verificación ya realizada

La imagen `workflows:test` se construyó y se ejecutó contra la base real de Neon
durante la preparación. Resultados obtenidos:

| Prueba | Resultado |
|---|---|
| `docker build` (etapas builder + runner) | ✅ imagen generada |
| `prisma migrate deploy` contra Neon (vía pooler) | ✅ "All migrations have been successfully applied" |
| `prisma migrate status` | ✅ "Database schema is up to date!" |
| `prisma db seed` contra Neon | ✅ usuarios creados |
| `GET /api/health` | ✅ 200 |
| `GET /` y `GET /dashboard` (SPA + fallback de React Router) | ✅ 200 |
| `GET /static/js/...` (assets) | ✅ 200 |
| `POST /api/auth/login` con `Origin` propio | ✅ 200 + cookie `token` |
| `GET /api/projects` con cookie | ✅ 200 con datos del seed |
| `GET /api/notifications` sin cookie | ✅ 401 |
| `POST /api/auth/login` con `Origin` ajeno (CSRF) | ✅ 403 |
| `POST /api/auth/logout` y reutilizar la cookie | ✅ 200, luego 401 |
| Función de producción con `CORS_ORIGINS` localhost | ✅ aborta con exit 1 (por diseño) |

Notas de endpoints que **no** son errores:

- `GET /api/notifications` sin `?userId=` responde 400: el parámetro es
  obligatorio por diseño.
- `GET /api/metrics` a secas responde 404: la ruta tiene subpaths.

## Probar la imagen en local (WSL)

Tienes Docker en WSL; conviene validar antes de subir:

```bash
docker build -t workflows .
docker run --rm -p 10000:10000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://usuario:clave@host/neondb?sslmode=require" \
  -e JWT_SECRET="un-secreto-de-al-menos-32-caracteres-para-probar" \
  -e CORS_ORIGINS="http://localhost:10000" \
  workflows
```

> Nota: con `NODE_ENV=production` el contenedor **no** arranca si `CORS_ORIGINS`
> apunta a localhost. Para probar la imagen localmente usa
> `NODE_ENV=development`, o acepta que el arranque falle a propósito (sirve para
> confirmar que la validación de producción está activa).

## Evitar el cold start (opcional)

Con una cuenta gratuita en https://cron-job.org o https://uptimerobot.com, crea
un ping cada 10-14 minutos a:

```
https://TU-URL.onrender.com/api/health
```

Mantiene el servicio despierto durante la defensa.

## Persistencia de archivos subidos (opcional)

En el plan free de Render no hay disco persistente, así que `uploads/` se
pierde en cada redeploy. Opciones:

1. **Aceptarlo** para la demo (los datos de la BD sí persisten).
2. Render de pago con *Persistent Disk* montado en `/app/uploads`
   (`UPLOADS_DIR` ya apunta ahí).
3. Migrar las subidas a un almacenamiento externo gratuito (Cloudinary, S3 free
   tier). Implica cambiar `multer.diskStorage` en `src/server/routes/documents.ts`
   por un storage remoto.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| El contenedor se reinicia con `✖ Configuración de producción insegura` | `CORS_ORIGINS` contiene `localhost` o `JWT_SECRET` es corto. Corrige la variable de entorno. |
| El login parece funcionar pero la sesión se pierde | Frontend y API en orígenes distintos. Usa el servicio único de `render.yaml` (mismo origen). |
| `Can't reach database server` al arrancar | `DATABASE_URL` mal copiada o sin `?sslmode=require`. |
| `P3009 / P1000` en `prisma migrate deploy` | La BD tiene estado previo de SQLite. Borra el proyecto en Neon y crea uno nuevo, o ejecuta `npx prisma migrate reset` contra esa base. |
| El primer acceso tarda ~50 s | El servicio estaba dormido (plan free). Ver "Evitar el cold start". |
| Los avatares no cargan | El CSP permite `img-src https:` para los avatares externos del seed (`api.dicebear.com`); si usas otro dominio, añádelo en `src/server/index.ts`. |

## Alternativas gratuitas sin tarjeta (si Render no convence)

| Opción | Cuándo conviene | Nota |
|---|---|---|
| Hugging Face Spaces (Docker) | Un solo contenedor, 16 GB RAM gratis | Se duerme tras 48 h; almacenamiento efímero |
| Cloudflare Pages / Netlify / Vercel | Solo el frontend | Sirven estáticos gratis, pero el API necesita otro host |
| Neon / Supabase | Base PostgreSQL gratis | Neon ya se usa aquí; Supabase es equivalente |
| Koyeb | Alternativa a Render | Puede pedir verificación de identidad |

**Descartados hoy:** Fly.io y Railway (piden tarjeta), Glitch/Cyclic/Deta
(cerrados), Oracle y Azure (excluidos por ti).
