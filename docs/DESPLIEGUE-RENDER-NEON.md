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
  periódico a `/api/health` (ver "Evitar el cold start" **y el detalle del cupo
  de 750 horas**, importante para no agotarlo).
- **Disco efímero**: la carpeta `uploads/` se vacía en cada redeploy. Los datos
  de la base (Neon) sí persisten, y por eso el despliegue guarda los documentos
  subidos **dentro de la base** (`STORAGE_BACKEND=postgres` en `render.yaml`), no
  en el disco. Ver "Persistencia de archivos subidos".
- **5 GB de tráfico al mes** en el plan Hobby (bajó de 100 GB en abril de 2026).
  Para una demo con pocos usuarios es de sobra; si se excede y no hay método de
  pago registrado, Render suspende los servicios free hasta el mes siguiente.

Los números completos están en "Límites reales de los planes gratuitos".


## Paso 1 — Crear la base de datos en Neon

1. Entra en https://neon.com y crea una cuenta (con GitHub, sin tarjeta).
2. Crea un proyecto. Neon crea la base `neondb` automáticamente.
3. Copia la **Connection string** del panel (botón *Connect*). Tiene esta forma:

   ```
   postgresql://usuario:clave@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```

   Deja el `?sslmode=require` al final: Neon exige TLS.

   Neon te da **dos** cadenas, y el despliegue usa las dos:

   - la **pooled** (la del botón *Connect* con *Connection pooling* activado;
     su host lleva `-pooler`), que va en `DATABASE_URL` y la usa la aplicación;
   - la **directa** (el mismo botón con *Connection pooling* desactivado; el
     host es el mismo **sin** `-pooler`), que va en `DIRECT_URL` y solo la usa el
     CLI de Prisma para migrar. Motivo en el *Paso 3*.

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
   - `DATABASE_URL` → la cadena **pooled** de Neon copiada en el paso 1.
   - `DIRECT_URL` → la cadena **directa** (la misma sin `-pooler`). Es la que usa
     `prisma migrate deploy` en el arranque.
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

> **`CORS_ORIGINS` es opcional.** Si la dejas vacía, el servidor toma
> `RENDER_EXTERNAL_URL`, la URL pública que Render inyecta automáticamente, así
> que el servicio arranca igual. Definirla a mano sigue siendo más explícito y
> es necesario si agregas un dominio propio o un segundo origen. Lo que **no**
> se puede es poner `localhost` en producción: eso sí aborta el arranque.

> **Por qué `DIRECT_URL`: migrar a través del pooler no es fiable.** `prisma
> migrate deploy` toma un *advisory lock* de sesión (`pg_advisory_lock`), y el
> host `-pooler` de Neon es PgBouncer en **modo transacción**, donde el estado de
> sesión no sobrevive al límite de cada transacción. El resultado es un fallo
> **intermitente** al arrancar:
>
> ```
> Error: P1002
> Timed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(72707369)).
> Timeout: 10000ms.
> ```
>
> La documentación de Prisma es explícita: los comandos del CLI deben usar la
> cadena **directa**, y solo el tráfico de la aplicación debe usar la pooled. Por
> eso `prisma.config.ts` apunta el CLI a `DIRECT_URL` (si existe) y `src/server/db.ts`
> mantiene `DATABASE_URL` para el runtime. En local, sin pooler, `DIRECT_URL` se
> omite y el CLI usa `DATABASE_URL`.

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
| `prisma migrate deploy` contra Neon | ⚠️ Vía **pooler** no es fiable: falla con `P1002` (advisory lock). Ver "Por qué `DIRECT_URL`". Con la cadena directa funciona. |
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

## Plan B — demo local con Docker (recomendado tenerlo listo)

Si el plan free de Render se duerme, se suspende por cupo o la defensa es sin
internet estable, puedes levantar todo el stack en tu máquina:

```bash
docker compose up -d --build
docker compose exec app npx prisma db seed   # solo la primera vez
```

Luego abre **http://localhost:8080** y entra con `admin@workflow.com` /
`admin123`. Para detenerlo:

```bash
docker compose down        # conserva los datos en volúmenes
docker compose down -v     # borra también los datos
```

Qué levanta:

- `db`: PostgreSQL 16 con volumen persistente (y puerto local 5433 para
  inspeccionarlo con un cliente SQL).
- `app`: la misma imagen del despliegue, sirviendo el SPA y el API en el mismo
  origen, con el backend de almacenamiento de disco (`STORAGE_BACKEND=disk`) y
  `uploads/` en un volumen que sí persiste.

Diferencia a tener en cuenta: aquí se usa `NODE_ENV=development` a propósito,
porque con `production` la cookie de sesión se marca `Secure` y el navegador no
la guarda sobre `http://localhost` (el login fallaría). Es la única diferencia
funcional respecto a Render, donde el sitio va por HTTPS.

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

**Pero ojo con el presupuesto de horas.** Render otorga **750 horas de instancia
por mes y por *workspace*, compartidas entre todos tus servicios free**. Un
servicio despierto 24/7 consume ~720 horas, es decir casi todo el cupo. Si lo
agotas, Render suspende tus servicios free hasta el mes siguiente.

Recomendación práctica: **activa el ping solo el día de la defensa** (o unas
horas antes) y desactívalo después, en vez de dejarlo todo el mes. Así gastas
unas pocas horas y conservas el cupo.

Dato útil: `/api/health` **no consulta la base de datos**. Por eso el ping
mantiene despierto a Render sin despertar el cómputo de Neon, que también escala
a cero cuando está inactivo. Lo mejor de ambos mundos.

## Persistencia de archivos subidos

En el plan free de Render no hay disco persistente: la carpeta `uploads/` se
vacía en cada redeploy. Por eso el servidor deja elegir **dónde** se guardan los
bytes de un documento, con la variable `STORAGE_BACKEND`:

| Valor | Dónde guarda | Cuándo usarlo |
|---|---|---|
| `disk` (por defecto) | El directorio de `UPLOADS_DIR` | Desarrollo local y `docker-compose`, donde el volumen sí persiste |
| `postgres` | Dentro de la base de datos | Despliegues sin disco persistente (el plan free de Render) |

**Este despliegue usa `postgres`** (`render.yaml` lo define), así que nada se
escribe en el contenedor y los documentos sobreviven a los redeploys: viven en la
misma base de Neon que el resto de los datos.

Detalles que conviene saber:

- **La lectura no depende de la variable**: cada archivo guarda en qué backend se
  almacenó, y la descarga lo respeta. Cambiar `STORAGE_BACKEND` nunca deja
  inalcanzable un documento ya subido.
- **Los bytes ocupan el mismo límite de 1 GB de Neon** que el resto de los datos,
  y el límite por archivo es de 10 MB (`MAX_FILE_SIZE` en
  `src/server/routes/documents.ts`). Para una sustentación es de sobra; si algún
  día se llenara, se puede añadir un backend de almacenamiento de objetos
  implementando el mismo contrato de `src/server/storage/`.
- **El borrado limpia los bytes**: al eliminar un documento, con el backend de
  disco se borra el archivo y con el de Postgres desaparece con la fila.

Alternativas descartadas, por si hicieran falta más adelante:

1. Render de pago con *Persistent Disk* montado en `/app/uploads`
   (`UPLOADS_DIR` ya apunta ahí; bastaría con volver a `STORAGE_BACKEND=disk`).
2. Almacenamiento externo gratuito (Cloudinary, S3 free tier): exige una cuenta
   o tarjeta nueva; el contrato de `src/server/storage/` ya deja el hueco.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| El contenedor se reinicia con `✖ Configuración de producción insegura` | `CORS_ORIGINS` contiene `localhost` o `JWT_SECRET` es corto. Corrige la variable de entorno. |
| El login parece funcionar pero la sesión se pierde | Frontend y API en orígenes distintos. Usa el servicio único de `render.yaml` (mismo origen). |
| `Can't reach database server` al arrancar | `DATABASE_URL` mal copiada o sin `?sslmode=require`. |
| `P1002` / `Timed out trying to acquire a postgres advisory lock` en el arranque | `prisma migrate deploy` está migrando a través del host `-pooler` de Neon (PgBouncer en modo transacción). Define `DIRECT_URL` con la cadena **sin** `-pooler` y vuelve a desplegar. Es un fallo intermitente: puede que el despliegue anterior funcionara. |
| `P3009 / P1000` en `prisma migrate deploy` | La BD tiene estado previo de SQLite. Borra el proyecto en Neon y crea uno nuevo, o ejecuta `npx prisma migrate reset` contra esa base. |
| El primer acceso tarda ~50 s | El servicio estaba dormido (plan free). Ver "Evitar el cold start". |
| Los servicios free quedan suspendidos a mitad de mes | Se agotaron las 750 horas de instancia o los 5 GB de tráfico sin método de pago. Revisa *Billing* en Render; se restablece el mes siguiente. |
| Neon suspende el cómputo | Se agotaron las 100 CU-horas del proyecto en el mes. No borra datos; se restablece al mes siguiente. |
| Los avatares no cargan | El CSP permite `img-src https:` para los avatares externos del seed (`api.dicebear.com`); si usas otro dominio, añádelo en `src/server/index.ts`. |
| Un documento no se descarga tras un redeploy | El archivo se subió cuando el servidor usaba `STORAGE_BACKEND=disk`, así que sus bytes estaban en el disco efímero y ya no están (la descarga responde 404 en vez de fallar). Vuelve a subirlo con el backend de Postgres activo. |

## Límites reales de los planes gratuitos (verificado en octubre de 2026)

Estos números cambian seguido; se listan con lo que dicen los proveedores hoy.

**Render (plan Hobby, sin tarjeta):**

- 750 horas de instancia por mes **compartidas en todo el workspace**.
- Servicio web **free**: 512 MB RAM, se duerme a los 15 min de inactividad y
  despierta en ~1 minuto.
- **5 GB de tráfico al mes** (bajó de 100 GB en abril de 2026); el exceso cuesta
  $0.15/GB y, **si no hay método de pago registrado, Render suspende los
  servicios free por el resto del mes**.
- Máximo 25 servicios; 500 minutos de build al mes.
- La base PostgreSQL free de Render **caduca a los 30 días** (y no tiene
  backups). Por eso este despliegue usa **Neon**, que no caduca.
- Render recomienda explícitamente no usar instancias free para producción;
  para una sustentación es adecuado.

**Neon (plan Free, sin tarjeta):**

- **Sin fecha de caducidad**.
- 1 GB de almacenamiento por proyecto; 100 CU-horas de cómputo por proyecto al
  mes; 5 GB de transferencia al mes.
- El cómputo **escala a cero tras 5 minutos** de inactividad y despierta en
  milisegundos. Si agotas las 100 CU-horas, el cómputo se suspende hasta el
  siguiente mes (no borra datos).

## Alternativas gratuitas sin tarjeta (si Render no convence)

| Opción | Cuándo conviene | Nota |
|---|---|---|
| Cloudflare Pages / Netlify / Vercel / GitHub Pages | Solo el frontend | Estáticos gratis y sin dormir, pero el API necesita otro host |
| Neon / Supabase | Base PostgreSQL gratis | Neon ya se usa aquí; Supabase equivale (500 MB, se pausa por inactividad) |
| Railway | Pruebas cortas | $5 de crédito 30 días y luego $1/mes: no alcanza para tener el servicio encendido; sin tarjeta |
| Alwaysdata / SnapDeploy / Zeabur | Alternativas de contenedor | Revisa límites y duración de la cuenta antes de confiar la demo |

**Descartados hoy:**

- **Hugging Face Spaces (Docker/Gradio)**: desde mediados de 2026 crear Spaces
  que ejecutan código requiere plan pago; solo los *Static Spaces* siguen
  gratis. Ya no sirve para hostear este backend.
- **Koyeb**: eliminó el plan Hobby sin tarjeta (febrero 2026) y ahora exige una
  preautorización de $29.
- **Fly.io**: sin free tier desde octubre de 2024.
- **Glitch / Cyclic / Deta**: cerrados.
- **Oracle y Azure**: excluidos por ti.

