## Why

La Iteración 3 se cierra con su requisito más importante sin implementar: **RF9.3 (preferencias de notificación por usuario)**, que es literalmente el criterio de aceptación de HU-09 ("Las notificaciones deben ser configurables por el usuario para evitar sobrecarga de información"). No existe modelo de datos, ni endpoint, ni interfaz: los 16 modelos de `prisma/schema.prisma` no incluyen ninguno de preferencias y `src/server/routes/notifications.ts` solo expone listar y marcar como leída.

Sobre ese hueco se acumulan otros cuatro: los disparadores de notificación están incompletos (no se notifica la finalización de un sprint, que HU-09 exige explícitamente), el centro de notificaciones no navega al detalle aunque el criterio §7c lo requiere, HU-10 es un dashboard estático sin datos ni configuración (su criterio de aceptación es "configurable por el usuario"), y RNF3.2 no restringe `/evaluations` ni la métrica de contribución individual, que son datos reserved al docente.

El entregable "Reporte de exactitud de métricas" (§5 y §7a de `docs/iteracion3.md`) es hoy inviable: no hay runner de tests unitarios, así que la matemática de las métricas solo se puede ejercitar a través de la suite E2E, que tarda ~4 minutos y siembra los datos por API. Por eso los 44 tests E2E pasan en verde y aun así no detectan ninguno de estos huecos.

## What Changes

- **RF9.3 — Preferencias de notificación**: nuevo modelo `NotificationPreference` que permite a cada usuario habilitar o deshabilitar por tipo de evento. Helper único de emisión que consulta la preferencia antes de insertar, aplicada a los cinco puntos de emisión existentes (`tasks.ts` asignación y evaluación, `chat.ts` mensaje directo, `projects.ts` asignación a proyecto, `retrospectives.ts` nota de retrospectiva). Interfaz de configuración.
- **Disparador faltante de RF9.2**: notificar a los miembros del proyecto cuando un sprint pasa a `COMPLETED`.
- **Navegación desde la notificación**: `entityType` y `entityId` en `Notification`; cada emisor guarda la referencia y el clic en el ítem navega al detalle correspondiente, cumpliendo el criterio §7c de HU-09.
- **Taxonomía de tipos validada**: `Notification.type` pasa de `String` libre a enumeración, corrijo el uso de `TASK_ASSIGNED` para una asignación de historia de usuario, y se añade "marcar todas como leídas".
- **Contador de no leídas exacto**: el badge hoy cuenta solo sobre los 20 registros más recientes (`take: 20`), por lo que subestima cuando hay más de 20 sin leer. Se sustituye por un recuento real en base de datos.
- **HU-10 con datos y configurable**: nuevo endpoint de resumen con proyectos activos, tareas pendientes y próximos vencimientos; los paneles por rol pasan a renderizar información real y el usuario elige qué módulos ver.
- **RNF3.2 — Control de acceso**: `/evaluations` restringida a ADMIN y `/api/metrics/projects/:id/contribution` restringida a ADMIN, dejando de exponer datos de evaluación y rendimiento del equipo a estudiantes.
- **Entregable de exactitud de métricas**: extracción de la matemática a funciones puras y una batería de tests unitarios que cubren el criterio §7a (sprint de 10 días con 100 puntos, el día 5 muestra exactamente 50 restantes), incluidos los casos borde que hoy nadie verifica.
- **Corrección de defectos verificados** (no son requisitos nuevos, restauran el comportamiento pretendido):
  - `description` es opcional en el esquema Zod pero obligatorio en Prisma: `POST /api/user-stories` sin él responde **500** en lugar de 400.
  - Sprint de un solo día: `daysDiff = 0` produce `idealDecrement = Infinity` y `ideal = NaN`, que se serializa a `null` y deja el gráfico sin línea ideal.
  - Una historia con 0 Story Points no muestra el valor por el chequeo de veracidad `{story.storyPoints && ...}`.
- **Infraestructura de pruebas**: `e2e/**` entra en el ámbito de Biome (hoy `npx biome check e2e/...` responde `No files were processed`), se resuelve la configuración contradictoria `fullyParallel: true` con `workers: 1`, y la suite deja de contaminar `dev.db`.
- **Unificación de la numeración de requisitos**: `docs/iteracion3.md` (§3), `docs/Estado_Implementacion.md` y la matriz de trazabilidad del propio `iteracion3.md` usan tres numeraciones distintas para los mismos requisitos —la propia `iteracion3.md:77-81` admite la inconsistencia `RF12.1*` / `RF10.1*`— y `docs/INFORME_ITERACION_3.md` se corrige para usar la numeración canónica.
- **Fuera de alcance**: la interfaz de asignación de Story Points. No es requisito de HU-08, HU-09 ni HU-10; el campo existe en el modelo y en la API pero ningún componente de `src/` lo envía. Se registra como deuda técnica documentada.

## Capabilities

### New Capabilities

- `notification-center`: ciclo de vida del centro de notificaciones — taxonomía validada de tipos de evento, emisión condicionada, navegación al detalle desde la notificación, recuento exacto de no leídas y marcado masivo como leídas.
- `notification-preferences`: preferencias de notificación por usuario y por tipo (RF9.3), su API de lectura y escritura, y el Consultar-preferencia que gobierna cada emisión.
- `role-dashboard`: resumen de datos por rol para el dashboard (HU-10), configuración de módulos visibles por el usuario y control de acceso basado en roles sobre las vistas y métricas del docente (RNF3.2).
- `metrics-computation`: definición de la matemática de métricas de sprint (burn-down ideal y real, velocidad, contribución) como funciones puras verificables, incluida la semántica del índice de día y el comportamiento en los casos borde.

### Modified Capabilities

Ninguna. Las capacidades existentes en `openspec/specs/` (`user-auth`, `user-registration`) no cambian.

## Impact

- **Base de datos**: tres migraciones Prisma — modelo `NotificationPreference`; columnas `entityType` y `entityId` en `Notification`; enum de tipos de notificación. Requiere `prisma migrate dev` y reseeding de `dev.db`.
- **Backend**: `src/server/routes/notifications.ts` ( preferences, recuento de no leídas, marcar todas), `src/server/routes/tasks.ts`, `chat.ts`, `projects.ts`, `retrospectives.ts`, `sprints.ts` (nuevo helper `notify()` y disparador de sprint completado), `metrics.ts` (extracción a funciones puras, guard de `daysDiff`), `user-stories.ts` (validación de `description`, tipo de notificación), `evaluations.ts` y `App.tsx` (restricción de rol), nuevo `src/server/routes/dashboard.ts`.
- **Frontend**: `src/components/NotificationBell.tsx` (navegación, recuento, marcar todas), nuevo panel de preferencias, `src/pages/GradingView.tsx`, `src/components/dashboards/TeacherDashboard.tsx` y `src/islands/TeamDeveloperWelcomeOptions.tsx` (datos reales y módulos configurables), `src/pages/Evaluations.tsx` (guard de rol).
- **Dependencias**: se añade `vitest` como devDependency. Sin nuevas dependencias de producción; los gráficos siguen con Recharts.
- **Tests**: migración de `e2e/dashboards.spec.ts` — el caso `DASH-04` asume que el estudiante accede a `/evaluations`, comportamiento que RNF3.2 prohíbe, y pasa a verificar el rechazo. Nuevos tests unitarios de métricas y nuevos tests E2E de preferencias, navegación y disparador de sprint.
- **Documentación**: `docs/INFORME_ITERACION_3.md` (corregir numeración y hallazgos), `docs/Estado_Implementacion.md`, `docs/iteracion3.md` (matriz de trazabilidad unificada y semántica del índice de día).