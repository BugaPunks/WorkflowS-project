## 1. Parseo de Story Points en el formulario

- [x] 1.1 En `src/pages/UserStories.tsx`, sustituir el mapeo `Number.parseInt(storyPoints, 10) || 0` por uno que distinga entero válido de vacío/no numérico: entero válido → valor (con clamp 0–99), vacío o no numérico → `undefined` (se omite `storyPoints` y se persiste `null`); un `0` explícito se envía como `0`
- [x] 1.2 Verificar que el body enviado omite `storyPoints` cuando el campo queda vacío o inválido, y que no bloquea la creación de la historia

## 2. Badge "Sin estimar" en la interfaz

- [x] 2.1 En la tarjeta de `src/pages/UserStories.tsx`, mostrar "Sin estimar" cuando `storyPoints == null` y `N pts` cuando tenga valor (incluido `0 pts`)
- [x] 2.2 En `src/pages/ProjectDetail.tsx`, aplicar el mismo criterio en la tarjeta del backlog y en la tarjeta de historia dentro del sprint
- [x] 2.3 En la tarjeta de sprint de `src/pages/ProjectDetail.tsx`, mostrar cuántas historias del sprint están sin estimar cuando el conteo sea mayor que 0

## 3. Conteo de historias sin estimar en métricas

- [x] 3.1 En `src/server/lib/metrics.ts`, añadir `unestimated` al retorno de `computeBurndown` (conteo de historias con `storyPoints` sin valor), sin cambiar `totalPoints` ni la serie
- [x] 3.2 En `src/server/lib/metrics.ts`, añadir `unestimated` a cada entrada de `computeVelocity`, sin cambiar `committed` ni `completed`
- [x] 3.3 Confirmar que las rutas de `src/server/routes/metrics.ts` devuelven los campos nuevos sin cambios de contrato (viajan en `{ data }`)

## 4. Reportes

- [x] 4.1 En `src/pages/Reports.tsx`, mostrar "M sin estimar" junto a "Puntos Totales" del burndown
- [x] 4.2 En `src/pages/Reports.tsx`, mostrar el conteo de historias sin estimar por sprint en la sección de velocidad (tooltip o nota), sin añadir series que alteren los ejes

## 5. Pruebas

- [x] 5.1 En `src/server/lib/metrics.test.ts`, añadir casos: sprint con historias sin `storyPoints` → `totalPoints` intacto y `unestimated` correcto; `storyPoints = 0` no cuenta como sin estimar
- [x] 5.2 En `src/server/lib/metrics.test.ts`, añadir caso de `computeVelocity` con historias sin estimar → `committed`/`completed` intactos y `unestimated` correcto
- [x] 5.3 Evaluar un caso E2E (crear historia sin puntos → se muestra "Sin estimar"); si aplica, añadirlo al spec correspondiente en `e2e/`

## 6. Calidad

- [x] 6.1 Ejecutar `npm run check` y `npx tsc --noEmit` sin errores
- [x] 6.2 Ejecutar `npm run test` en verde
- [x] 6.3 Ejecutar `openspec validate --all`
