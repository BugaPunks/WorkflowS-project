## Why

Al crear una historia de usuario dejando el campo *Puntos (Story Points)* vacío o con un valor no
numérico, el formulario (`src/pages/UserStories.tsx`) aplica
`Number.parseInt(valor, 10) || 0`, que convierte silenciosamente basura (`.`, `-`, `+`) en `0`. La
historia se guarda con `storyPoints = 0` y la tarjeta muestra un engañoso badge "0 pts" aunque
nadie la estimó. Además, `0` y "sin estimar" hoy no se distinguen en la interfaz: una historia sin
estimar simplemente no muestra nada, por lo que el docente no puede saber cuántas historias del
sprint quedaron sin estimar.

## What Changes

- Corregir el mapeo de *Story Points* en el formulario de creación para que un campo vacío **o** un
  valor no numérico se envíen como "sin estimar" (`null`), nunca como `0`.
- Conservar `0` como estimación válida cuando el usuario lo escribe explícitamente (un `0` tecleado
  sigue siendo `0 pts`), en línea con el requirement vigente de `metrics-computation` ("Stories
  carrying zero points are counted as estimated").
- Mostrar un badge neutro **"Sin estimar"** cuando `storyPoints` no tenga valor, tanto en la tarjeta
  de la lista de historias como en las tarjetas de backlog y de sprint del proyecto.
- Exponer el conteo de **historias sin estimar** en las métricas: `computeBurndown` y
  `computeVelocity` devuelven un campo `unestimated`, y la UI de reportes lo muestra. No cambia
  ninguna suma (`totalPoints`, `committed`, `completed` siguen igual porque `null` ya cuenta como 0),
  así que los gráficos del docente no se alteran.
- Marcar en la tarjeta de sprint del proyecto cuántas historias del sprint están sin estimar.

## Capabilities

### New Capabilities

<!-- Ninguna: no se introduce un capability nuevo. -->

### Modified Capabilities

- `user-story-points`: la regla de parseo del campo de puntos deja de convertir valores inválidos en
  `0` (pasan a "sin estimar"), y el renderizado de la tarjeta deja de omitir el badge cuando no hay
  valor para mostrar "Sin estimar".
- `metrics-computation`: el burndown y la velocidad exponen además el conteo de historias sin
  estimar por sprint, sin modificar los totales ya existentes.

## Impact

- **Frontend**: `src/pages/UserStories.tsx` (mapeo del campo y badge de tarjeta),
  `src/pages/ProjectDetail.tsx` (badge "Sin estimar" en backlog/sprint y conteo por sprint),
  `src/pages/Reports.tsx` (mostrar "sin estimar" junto a los puntos totales y por sprint).
- **Backend**: `src/server/lib/metrics.ts` (`computeBurndown`/`computeVelocity` añaden
  `unestimated`). Las rutas `src/server/routes/metrics.ts` no cambian: los campos nuevos viajan en
  la respuesta `{ data }` ya existente.
- **Esquema Prisma**: sin cambios (`storyPoints Int?` ya es nullable), por lo que **no hay migración**.
- **Pruebas**: `src/server/lib/metrics.test.ts` (sumas intactas + conteo sin estimar) y, si aplica,
  un caso E2E de creación de historia sin puntos.
- **Fuera de alcance**: editar una historia ya creada para asignarle puntos después (hoy requiere
  borrar y recrear); el CSV de exportación (es por tareas y ya escribe `points: "N/A"`).
