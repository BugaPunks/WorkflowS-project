## 1. Helper de exención de polling

- [x] 1.1 Crear `src/server/lib/rate-limit.ts` con `isPollingRequest(req: Pick<Request, "method" | "path">): boolean`, que devuelve `true` solo cuando `req.method === "GET"` y `req.path` coincide exactamente con `/notifications`, `/notifications/unread-count`, `/chat/:id/messages` o `/chat/conversation/:id/messages` (documentar que `req.path` es relativo al montaje en `/api`).
- [x] 1.2 Añadir `src/server/lib/rate-limit.test.ts` (Vitest) que verifique: los cuatro paths de polling en `GET` devuelven `true`; un `POST` a esos mismos paths devuelve `false`; y `GET /notifications/123`, `/chat/abc/messages/extra`, `/projects` y `/tasks` devuelven `false`.

## 2. Configuración y montaje del limitador

- [x] 2.1 En `src/server/index.ts`, añadir un helper que lea un entero positivo de entorno y resolver `API_RATE_LIMIT_MAX` (por defecto `1000`) y `API_RATE_LIMIT_WINDOW_MS` (por defecto `900000`), cayendo al default si falta, no es numérico o no es entero positivo.
- [x] 2.2 Actualizar `apiLimiter` para usar `windowMs` y `max` resueltos y `skip: (req) => disableRateLimit || isPollingRequest(req)`.
- [x] 2.3 Confirmar que `authLimiter` y `registerLimiter` conservan sus valores actuales (5/15 min y 10/h) sin cambios.

## 3. Documentación de variables

- [x] 3.1 Documentar `API_RATE_LIMIT_MAX` y `API_RATE_LIMIT_WINDOW_MS` en `.env.example`, con los valores por defecto (`1000` y `900000`) y una nota de que son opcionales.

## 4. Verificación

- [x] 4.1 Ejecutar `npm run test:unit` y confirmar que el nuevo test y la suite existente pasan.
- [x] 4.2 Ejecutar `npm run check` (Biome) sin errores.
- [x] 4.3 Prueba manual: arrancar `npm run dev:all`, usar la app más de 8 minutos y confirmar que no aparece `429` al guardar preferencias de notificación ni por el polling.
- [x] 4.4 Prueba manual: superar el máximo configurado en un endpoint no exento (p. ej. `GET /api/projects`) devuelve `429`, confirmando que el limitador general sigue activo.