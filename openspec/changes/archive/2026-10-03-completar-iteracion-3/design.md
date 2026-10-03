## Context

WorkflowS es una SPA React (Rsbuild + React 19) sobre un backend Express 5 + Prisma 7 con SQLite. La Iteración 3 entregó el módulo de métricas (`src/server/routes/metrics.ts`, `src/pages/Reports.tsx` con Recharts) y el centro de notificaciones (`src/server/routes/notifications.ts`, `src/components/NotificationBell.tsx` con polling cada 10 s), pero con cuatro huecos verificados sobre el código.

**Estado verificado de los huecos:**

| Hueco | Evidencia |
|---|---|
| RF9.3 sin implementar | No existe modelo de preferencias entre los 16 de `prisma/schema.prisma`; `notifications.ts` expone solo 2 endpoints (listar, marcar leída) |
| Disparador de sprint ausente | `sprints.ts:117` actualiza el estado sin emitir notificación |
| Clic sin navegación | `NotificationBell` invoca `handleMarkRead(id)` y nada más; sin `entityType`/`entityId` en el modelo |
| Contador truncado | `notifications.ts:21` usa `take: 20`; `NotificationBell.tsx:28` cuenta sobre ese arreglo |
| `description` → 500 | `user-stories.ts:10-18` declara `description` opcional; `prisma/schema.prisma` lo define `String` (obligatorio) |
| Burn-down `NaN` | `metrics.ts:46` → `daysDiff = 0` ⇒ `idealDecrement = Infinity` ⇒ `ideal = NaN` ⇒ `null` en el gráfico |
| Story Points `0` invisible | `ProjectDetail.tsx:1074,1178` usan `{story.storyPoints && (...)}` |

La suite E2E está verde (44/44 en tres ejecuciones completas tras activa r `server.keepAliveTimeout = 65_000` en `src/server/index.ts:150`) pero no puede detectar estos huecos: `e2e/metrics.spec.ts` siembra los Story Points por API precisamente porque la interfaz no puede hacerlo.

**Restricciones relevantes:**

- Sin WebSockets por decisión documentada en `iteracion3.md` §6c: la entrega de notificaciones sigue siendo por polling.
- La base es SQLite en desarrollo con Prisma 7; las migraciones deben ser coherentes con el seeding existente.
- `biome.json` solo incluye `src/**` y ficheros raíz, de modo que `e2e/**` no se formatea ni se valida.
- `playwright.config.ts` declara `fullyParallel: true` con `workers: 1` y los tests comparten `dev.db` sin aislamiento.

## Goals / Non-Goals

**Goals:**

- Cerrar RF9.3 de forma que el criterio de aceptación de HU-09 sea verdad, y que el preference-check sea un único punto de aplicación imposible de saltarse.
- Convertir la matemática de métricas en funciones puras y cubrirla con tests unitarios, incluido el criterio §7a, para poder entregar el "Reporte de exactitud de métricas" que §5 de `iteracion3.md` exige.
- Dar al dashboard contenido real y configurable, que es el criterio de aceptación de HU-10.
- Aplicar RNF3.2 sobre las vistas y métricas reservadas al docente.
- Corregir los defectos verificados que hoy producen respuestas incorrectas o datos lost.
- Unificar la numeración de requisitos, que hoy difiere entre `iteracion3.md` §3, `Estado_Implementacion.md` y la matriz de trazabilidad del propio `iteracion3.md:177-182`.

**Non-Goals:**

- Interfaz de asignación de Story Points. No pertenece a HU-08/09/10; queda registrada como deuda técnica.
- Sustituir el polling por WebSockets o Server-Sent Events (decisión previa explícita).
- Cambios en la fórmula de la línea ideal. El comportamiento actual es correcto para días transcurridos; lo que se hace es documentarlo y blindarlo con tests, más corregir el caso degenerado.
- Migrar a una base de datos de pruebas con Docker. La propuesta es un esquema SQLite separado en fichero, por simplicidad.
- Rediseño visual del centro de notificaciones. Se añade la superficie de preferencias sin reformatear el panel existente.

## Decisions

### D1 — El preference-check vive en un único helper `notify()`

Se crea `src/server/lib/notify.ts` con la firma `notify({ userId, type, title, message, entityType?, entityId? })`, que consulta la preferencia del destinatario y solo inserta si el tipo está habilitado. Los cinco puntos de emisión actuales y el nuevo de sprint se convierten a este helper.

- **Por qué**: distributed enforcement. Si cada emisor consultara su propia preferencia, un sexto disparador futuro la saltaría. Un único punto de escritura hace la regla estructural y no por convención.
- **Alternativa considerada**: una opción de configuración en el cliente (consultar preferencias en el `NotificationBell` y filtrar al pintar). Descartada: el dato seguiría en la base de datos, el usuario lo seguiría recibiendo en el badge si se filtrara mal, y no cumple "evitar sobrecarga de información" porque el ruido se sigue generando.
- **Coste**: una consulta extra por notificación. Irrelevante a esta escala; se evalúa cachear por request si el perfil lo exigiera.

### D2 — El enum de tipos vive en Prisma, no en una constante compartida

`Notification.type` pasa de `String` a enum de Prisma. Las preferencias referencian ese enum.

- **Por qué**: la base de datos es el único lugar donde ya se garantiza la integridad referencial; un enum Prisma hace imposible el tipo no reconocido a nivel de datos, no solo de validación. Además permite que la consulta de preferencias relacione tipo y preferencia.
- **Alternativa considerada**: `String` más un `z.enum` en el esquema Zod. Descartada: el esquema Zod protege la entrada HTTP, pero `createMany` y los scripts pueden introducir tipos inválidos sin pasar por él.
- **Migración**: los datos existentes usan `TASK_ASSIGNED`, `EVALUATION_COMPLETED`, `MESSAGE`, `PROJECT_ASSIGNED`, `RETROSPECTIVE_ITEM`; todos están en el enum, luego la migración es aditiva. Las filas que usan `TASK_ASSIGNED` para una asignación de historia no se pueden distinguir de las legítimas, así que se conservan como están y la corrección solo aplica a partir de la nueva emisión.

### D3 — Preferencias ausentes significan "habilitado", y hay un único endpoint de lectura que devuelve el conjunto completo

`GET /api/notifications/preferences` devuelve un objeto con los siete tipos y su estado, resolviendo los ausentes como `true`. `PUT /api/notifications/preferences/:type` actualiza uno.

- **Por qué**: evita materializar filas por defecto para cada usuario nuevo y hace que "sin preferencia" sea indistinguible de "habilitado", que es la semántica que quiere el usuario y la que exige el escenario de entrega sin fila almacenada.
- **Alternativa considerada**: sembrar filas por defecto al crear el usuario. Descartada: siete filas por usuario para representar un estado que es el predeterminado, y obliga a un backfill para los usuarios existentes.

### D4 — Las métricas se extraen a `src/server/lib/metrics.ts` como funciones puras

`computeBurndown(sprint)`, `computeVelocity(sprints)` y `computeContribution(tasks)` reciben objetos planos y devuelven objetos planos. Las rutas quedan como adaptadores finos que cargan Prisma y delegan.

- **Por qué**: es lo que permite los tests de caja blanca del §7a sin levantar servidor ni base de datos. La suite E2E tarda ~4 minutos y sembrar por API enmascara precisamente los defectos del lado del cliente que nos importan.
- **Alternativa considerada**: probar las fórmulas a través de la API en tests de integración. Descartada: los errores de `NaN` y de días transcurridos son aritméticos, y probarlos a través de HTTP cuesta minutos por iteración y no aísla la causa.
- **Nota sobre el índice de día**: se mantiene `días transcurridos` como semántica (serie de `díasTranscurridos + 1` puntos, la línea ideal llega a 0 en el último índice). Con eso, el ejemplo del §7a —100 puntos y día 5 igual a 50— se cumple para un sprint cuyas fechas distan 10 días. La discrepancia aparente con "sprint de 10 días" viene de que un sprint del 1 al 10 tiene 9 días transcurridos; se documenta explícitamente para que ningún test futuro interprete la duración de otra manera.

### D5 — Guard de días degenerados en `computeBurndown`, con un único punto para el sprint de un día

Cuando `endDate <= startDate` la serie se devuelve vacía, salvo que las fechas caigan en el mismo día natural, en cuyo caso se devuelve un único punto con `ideal = totalPoints`. Nunca se devuelve `NaN` ni `Infinity`.

- **Por qué**: `daysDiff = 0` hace que `totalPoints / 0` sea `Infinity` y `Infinity * 0` sea `NaN`; `Math.max(0, NaN)` devuelve `NaN`, que `res.json` serializa a `null` y Recharts recibe como línea inexistente. Un único punto con el total es la lectura correcta: no ha pasado ningún día.
- **Alternativa considerada**: extender artificialmente la serie a un día. Descartada: inventa un día de duración que el usuario no configuró.

### D6 — El contador de no leídas se calcula en SQL, no sobre la página

Nuevo `GET /api/notifications/unread-count` con un `count` filtrado por `userId` y `read: false`, sin `take`.

- **Por qué**: contar sobre los 20 más recientes subestima el badge en cuanto hay más de 20 sin leer. Con `unreadCount > 9 ? "9+"`, el usuario ve un `9+` que no corresponde a su pendiente real.
- **Alternativa considerada**: subir el `take` del listado. Descartada: seguiría truncando yya que el truncamiento es el defecto; el número correcto requiere un agregado.

### D7 — `entityType` y `entityId` como columnas, con un mapa de rutas en el cliente

La notificación guarda la referencia; `NotificationBell` resuelve la ruta con un mapa `entityType -> patrón de ruta`. Las filas antiguas deja esas columnas a null y se comportan como hoy (solo marcar leída).

- **Por qué**: guarda en el cliente una decisión de presentation (la forma de la ruta) que cambia con el router, y mantiene el modelo simple. La alternativa de guardar la ruta ya formateada en la base de datos la deja obsoleta en cuanto cambia una ruta.
- **Alternativa considerada**: sin columnas y con navegación genérica a "lo más reciente". Descartada: no cumple el criterio §7c de HU-09, que exige llegar al detalle.

### D8 — El resumen del dashboard se calcula en una sola consulta agregada por rol

Nuevo `src/server/routes/dashboard.ts` con `GET /api/dashboard/summary`, que resuelve los proyectos del usuario, filtra los activos por fecha, agrega sus tareas no completadas y ordena los vencimientos más próximos. ADMIN sin pertenencias recibe colecciones vacías.

- **Por qué**: una ruta y un viaje resuelven los tres módulos del panel y evitan que cada componente del panel haga su propio `fetch` y descargue tres veces los datos del mismo proyecto.
- **Alternativa considerada**: reutilizar `/api/metrics/.../contribution`. Descartada: es una métrica de docente (RNF3.2) y no cubre tareas pendientes ni vencimientos.

### D9 — La configuración del dashboard se guarda en el usuario, no en el navegador

`DashboardLayout` ya tiene el `user` en sesión; se persiste un objeto de módulos visibles en una columna del usuario y se expone por `GET/PATCH /api/dashboard/preferences`.

- **Por qué**: el criterio de aceptación dice "configurable por el usuario". Guardarlo en `localStorage` lo ata al navegador y no sobrevive a un cambio de equipo, lo que es una lectura débil de "por el usuario".
- **Alternativa considerada**: preferencia solo en cliente. Descartada por la razón anterior.

### D10 — RNF3.2 se aplica en la ruta y en el servidor

`/evaluations` deja de ser una ruta de `DashboardLayout` y pasa a una ruta protegida por rol; `GET /api/metrics/projects/:projectId/contribution` recibe el guard de ADMIN. Los estudiantes conservan el acceso a sus propias calificaciones.

- **Por qué**: proteger solo el servidor deja el componente montado y la URL abierta; proteger solo el cliente es trivial de saltar con `curl`. Las dos capas son necesarias.
- **Alternativa considerada**: filtrar en el render. Descartada: los datos ya habrían salido del servidor.

## Risks / Trade-offs

- **La suite E2E se rompe en el caso `DASH-04`** → mitigación: `DASH-04` asume hoy que el estudiante accede a `/evaluations`, que es exactamente lo que RNF3.2 prohíbe; la tarea lo convierte en un test de rechazo (403/redirección). Es una migración anunciada en la propuesta, no una regresión.
- **Endurecer `description` a `z.string().min(1)` cambia respuestas 500 → 400** → mitigación: ninguno de los 44 tests actuales envía `description` vacío (verificado con grep sobre `e2e/`), pero la suite completa se ejecuta tras el cambio y no se publica el resultado sin ella.
- **El enum de Prisma bloquea el seeding si el seed usa tipos inventados** → mitigación: se grepea `prisma/seed.ts` y `e2e/` por literales de tipo antes de aplicar la migración, y la migración se genera sobre una copia de `dev.db`.
- **Aislar la base de pruebas cambia la ruta que espera la suite** → mitigación: la variable de base de datos se resuelve en un único punto de configuración; si el aislamiento no está activo, la suite sigue funcionando contra `dev.db` como hoy, sin cambio de comportamiento.
- **`Biome` sobre `e2e/**` puede producir muchos errores de formato de una vez** → mitigación: se ejecuta `biome check` en modo informe, se revisa el volumen y se aplica el formato en un commit propio, separado de los cambios funcionales, para que un diff grande no oculte una regresión.
- **Añadir Vitest introduce un segundo runner** → mitigación: Vitest se limita a `src/server/lib/**/*.test.ts`, sin solapamiento con Playwright, y un `test:unit` separado para que nadie los confunda.
- **La corrección del tipo `USER_STORY_ASSIGNED` no distingue el histórico** → trade-off aceptado: las filas existentes con `TASK_ASSIGNED` que en realidad son asignaciones de historia quedan mal etiquetadas hasta que se purguen; no se escribe un migración de datos porque no hay forma fiable de distinguirlas.

## Migration Plan

1. `NotificationPreference` y columnas `entityType`/`entityId`, más el enum de tipos — una migración, tres cambios de esquema.
2. `DashboardPreferences` en el usuario — segunda migración.
3. Copia de seguridad de `dev.db` antes de cada migración; el comando de reversión es `prisma migrate reset` sobre la copia, ya que el proyecto es local y sin datos de producción.
4. Tras migrar: `npx prisma migrate dev`, `npm run dev:all`, y comprobación manual de los seis disparadores de notificación.
5. Orden de aplicación: el helper `notify()` y las preferencias antes que el disparador de sprint, para que el sprint no nazca saltándose la preferencia.
6. Publicación: `biome check`, `tsc --noEmit`, `npm run test:unit` y `npx playwright test` en verde antes de commitear.

## Open Questions

- Si el docente debe poder ver las calificaciones de un miembro concreto desde `/evaluations` y si el ADMIN que no pertenece al proyecto debe ver el dashboard de ese proyecto, o solo un estado vacío. El enunciado de RNF3.2 no lo aclara y afecta a la decisión D8.
- Si "próximos vencimientos" incluye las fechas de sprint además de las de tarea; la descripción de HU-10 no lo especifica.
- Si las preferencias de notificación se ofrecen también a un ADMIN para silenciar las suyas propias, o si el panel de preferencias es exclusivo de estudiantes.