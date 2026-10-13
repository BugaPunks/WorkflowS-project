## Context

`NotificationBell.tsx` es el único punto del frontend que resuelve la navegación de una notificación.
Hoy solo contempla `PROJECT` y `TASK` con rutas reales; para el resto (`MESSAGE`, `SPRINT`,
`USER_STORY`, `RETROSPECTIVE_ITEM`) y para el `else` final hace `navigate("/dashboard")`. Esa ruta
no está declarada en `src/App.tsx` (el dashboard vive en `"/"`) y el router no tiene catch-all, así
que React Router renderiza un árbol vacío: pantalla en blanco.

Los endpoints necesarios para resolver el proyecto de una entidad ya existen y están autenticados:
`GET /api/tasks/:id` (devuelve `projectId`), `GET /api/sprints/:id` (devuelve `projectId`) y
`GET /api/user-stories/:id` (devuelve `projectId`). El capability `notification-center` ya exige que
activar una notificación con referencia navegue a su detalle.

## Goals / Non-Goals

**Goals:**

- Que activar cualquier notificación navegue siempre a una ruta válida, nunca a una pantalla en blanco.
- Aprovechar la navegación existente: abrir el tablero de tareas, la lista de historias o el detalle
  de sprint dentro del proyecto correspondiente cuando la entidad lo permita.
- Defender el router con un catch-all para cualquier URL desconocida.

**Non-Goals:**

- Página dedicada de notificaciones / historial completo (el botón "Ver todas" sigue sin destino).
- Abrir el widget de chat (`ChatWidget`) desde una notificación `MESSAGE`; no hay ruta de chat.
- Añadir endpoints nuevos en el backend: la resolución usa los GET por id existentes.
- Cambiar el esquema Prisma o el modelo `Notification`.

## Decisions

**Decisión 1: Resolver la ruta en el cliente con los GET por id existentes.**
Para `TASK`, `SPRINT` y `USER_STORY`, el `entityId` es el id de la entidad (no el del proyecto), por
lo que hay que obtener `projectId`. Se usa `fetch` a los endpoints existentes en el handler de click.
Alternativa considerada: guardar `projectId` en la notificación (columna o metadata) y evitar el
fetch. Se descarta por requerir migración de Prisma y cambios en todos los triggers del backend,
desproporcionado para el arreglo. Alternativa: endpoint único `/api/notifications/:id/resolve`.
También descartado por añadir superficie de backend innecesaria.

**Decisión 2: Fallback explícito a `/` en lugar de a `/dashboard`.**
Todo caso no resoluble (`MESSAGE`, `RETROSPECTIVE_ITEM`, `entityType` desconocido, fetch fallido o
`projectId` ausente) navega a `"/"`, la ruta real del dashboard. Así se mantiene el requirement de
que activar una notificación con referencia navega a algún sitio útil sin inventar rutas.

**Decisión 3: Catch-all en `App.tsx`.**
Añadir `<Route path="*" element={<Navigate to="/" replace />} />` dentro del `DashboardLayout`. Es
una defensa independiente del bug original: cubre enlaces profundos obsoletos o futuros errores de
resolución y garantiza que nunca haya pantalla en blanco. El `replace` evita ensuciar el historial.

**Decisión 4: Mantener `TASK` apuntando al tablero del proyecto.**
El spec vigente dice "task detail route". El E2E `NTF-01` ya verifica
`/projects/<projectId>/tasks`, y ese es el destino natural del tablero; se conserva para no romper
la prueba ni cambiar UX. (Moverlo a `/projects/<projectId>/tasks/<taskId>` queda como posible mejora
futura, fuera de alcance.)

## Risks / Trade-offs

- **Fetch extra en el click añade latencia y puede fallar.** → Es un único GET; si falla o tarda, el
  fallback a `/` mantiene la app usable y el `try/catch` ya existe. Alternativa síncrona (guardar
  `projectId`) se descartó por costo de migración.
- **`RETROSPECTIVE_ITEM` no tiene vista propia ni GET por id** (solo `GET /api/retrospectives/:sprintId`).
  → Se acepta el fallback a `/`; documentado como no-goal para no ampliar el alcance del fix.
- **El catch-all podría enmascarar rutas mal escritas en el futuro.** → Riesgo bajo: el spec deja
  explícito que cualquier path desconocido va a `/`; si se añade una ruta nueva, se declara antes que
  el catch-all.

## Migration Plan

Cambio solo de frontend, sin migraciones de datos ni de esquema. Despliegue normal del bundle. Para
rollback basta revertir los dos archivos (`NotificationBell.tsx`, `App.tsx`) y las pruebas.

## Open Questions

- ¿Se desea reactivar el botón "Ver todas" con una página de historial de notificaciones? Queda fuera
  de este change.
