## Context

El servidor monta un limitador global sobre `/api` con `express-rate-limit` (`src/server/index.ts:150-164`): 100 solicitudes por IP cada 15 minutos. La aplicación, por diseño, consulta endpoints de lectura con un intervalo corto:

- `NotificationBell` sondea `GET /api/notifications` y `GET /api/notifications/unread-count` cada 10 s (`src/components/NotificationBell.tsx:51`).
- `ChatWidget` consulta `GET /api/chat/conversation/:chatId/messages` cada 5 s mientras el chat está abierto (`src/components/ChatWidget.tsx:68`).
- `ProjectDetail` consulta `GET /api/chat/:projectId/messages` cada 5 segundos (`src/pages/ProjectDetail.tsx:76`).

Solo en una página de proyecto eso supone ~24 solicitudes por minuto, así que el cupo de 100 se agota en ~4 minutos. A partir de ahí el servidor responde `429` a **toda** la API, incluido `PUT /api/notification-preferences/:type`, de modo que los interruptores de preferencias se revierten solos. Los limitadores de credenciales (`POST /api/auth/login` 5/15min y `POST /api/auth/register` 10/h) son independientes y correctos; el problema es exclusivamente el limitador general.

No existe ninguna capacidad activa en `openspec/specs/` que describa el comportamiento del limitador, así que este change lo documenta además de corregirlo.

## Goals / Non-Goals

**Goals:**

- Que el polling de lectura de la propia aplicación deje de agotar el cupo del limitador general.
- Que el límite general sea lo bastante holgado para la navegación normal, sin eliminar la protección frente a abuso.
- Hacer el máximo y la ventana configurables por entorno, con valores por defecto seguros.
- Dejar un contrato testeable (capacidad `api-rate-limiting`) y cobertura unitaria del helper de exención.

**Non-Goals:**

- Reducir la frecuencia de polling del frontend ni unificar notificaciones en un solo endpoint (era otra opción, no elegida).
- Manejar el `429` en la interfaz (mejora de UX independiente).
- Cambiar los limitadores de `auth/login` y `auth/register`.
- Introducir un almacén de rate limit distribuido (Redis) para despliegues multi-instancia: el store en memoria por proceso se mantiene.

## Decisions

### 1. Eximir el polling del limitador general en lugar de solo subir el cupo
Se añade una función `skip` al `apiLimiter` que devuelve `true` para las peticiones de polling, combinada con la bandera `DISABLE_RATE_LIMIT` ya existente. Así el polling nunca agota el cupo y el limitador general sigue protegiendo el resto de endpoints.

- **Alternativa A — solo subir el máximo.** Descartada: el polling seguiría consumiendo cupo y una sesión larga volvería a agotarlo; además el número tendría que crecer sin criterio.
- **Alternativa B — montar un limitador aparte y más generoso para los endpoints de polling.** Descartada: añade una instancia y orden de montaje sin aportar sobre `skip`; `skip` expresa la intención de forma más directa y ya hay precedente (`skip: () => disableRateLimit`).
- **Alternativa C — limitar por usuario autenticado en vez de por IP.** Descartada para este change: cambia la semántica de todo el limitador y no es necesario para corregir el defecto.

### 2. `isPollingRequest` como helper puro y testeable
Se extrae a `src/server/lib/rate-limit.ts` con la firma `isPollingRequest(req: Pick<Request, "method" | "path">)` para poder probarlo con objetos mínimos, siguiendo la convención de `src/server/lib/*.test.ts` (Vitest).

- **Coincidencia por `req.path` + `req.method`.** Dentro de un middleware montado con `app.use("/api", ...)`, Express elimina el prefijo de montaje, por lo que `req.path` es, p. ej., `/notifications/unread-count` (sin `/api`). Se documenta esta dependencia en el propio módulo y se cubre con tests.
- **Solo `GET`.** El patrón exige `req.method === "GET"`, de modo que un `POST`/`PUT` sobre la misma ruta sigue contando.
- **Allowlist explícita.** Exactamente cuatro rutas:
  - `/notifications`
  - `/notifications/unread-count`
  - `/chat/:id/messages` → `/^\/chat\/[^/]+\/messages$/`
  - `/chat/conversation/:id/messages` → `/^\/chat\/conversation\/[^/]+\/messages$/`

  El segundo patrón no cubre el de `conversation` porque `[^/]+` no admite la barra, así que se listan por separado.

### 3. Valores por defecto y lectura de entorno
`max` por defecto `1000` (≈66 req/min) y `windowMs` por defecto `900000` (15 min). Se leen de `API_RATE_LIMIT_MAX` y `API_RATE_LIMIT_WINDOW_MS` con un helper que cae al valor por defecto cuando la variable falta, no es numérica o no es un entero positivo (evita que `Number("")`/`Number("abc")`/`0` desactiven el límite sin querer).

- **Alternativa — `Number(env) || default` inline.** Descartada: `Number("0")` es `0` y sería falsy para `||`, y un `NaN` pasaría inadvertido; un helper pequeño lo hace explícito y comprobable.

### 4. `authLimiter` y `registerLimiter` intactos
Mantienen sus umbrales estrictos (5/15 min y 10/h). No forman parte del defecto y reducirlos o tocarlos ampliaría el riesgo de seguridad.

## Risks / Trade-offs

- **Se relaja el control sobre los GET de polling** (podrían usarse para sondeo abusivo) → Mitigación: los cuatro endpoints son GET autenticados y acotados a datos propios (el listado de notificaciones devuelve las del propio usuario); el resto de `/api` conserva el límite y `auth/login`/`auth/register` siguen estrictos.
- **El `skip` depende de las rutas literales**: si una ruta se renombra, la exención dejaría de aplicar en silencio → Mitigación: allowlist concentrada en un solo módulo y test unitario que enumera los cuatro paths y verifica que otros no coinciden.
- **`req.path` relativo al punto de montaje**: una reubicación del middleware cambiaría la coincidencia → Mitigación: la dependencia queda documentada en el módulo y cubierta por tests; el middleware permanece montado en `/api`.
- **Subir el máximo general a 1000 reduce la protección anti-abuso en endpoints no-auth** → Mitigación: el objetivo es no bloquear tráfico legítimo; 1000/15 min sigue acotando y es ajustable por entorno.
- **Store en memoria = límite por instancia** → Fuera de alcance: el proyecto se ejecuta en un solo proceso; se documenta como limitación conocida, no se resuelve aquí.

## Migration Plan

- **Sin migración de datos.** Es un cambio de configuración y de lógica de limitador; no toca el esquema Prisma.
- **Despliegue**: actualizar código y, opcionalmente, definir `API_RATE_LIMIT_MAX`/`API_RATE_LIMIT_WINDOW_MS` en el entorno. Si no se definen, aplican los valores por defecto (1000 / 900000).
- **Rollback**: revertir el commit. Los valores por defecto son seguros y el `.env.example` documenta las variables; ninguna variable nueva es obligatoria.
- **Verificación post-despliegue**: usar la app más de 8 minutos sin ver `429` en preferencias/notificaciones; comprobar que una ráfaga superior al máximo en un endpoint no exento sigue devolviendo `429`.

## Open Questions

- Ninguna bloqueante. Queda fuera de este change reducir la frecuencia de polling del frontend (`NotificationBell` 10 s, `ChatWidget`/`ProjectDetail` 5 s) o manejar el `429` con aviso en la interfaz; pueden abordarse en un change posterior.