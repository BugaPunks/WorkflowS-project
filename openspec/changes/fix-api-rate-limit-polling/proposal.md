## Why

El limitador global de la API (100 solicitudes / 15 min por IP) se agota en pocos minutos por el propio polling de la aplicación: el centro de notificaciones consulta dos endpoints cada 10 s (`NotificationBell.tsx:51`) y los chats cada 5 s (`ChatWidget.tsx:68`, `ProjectDetail.tsx:76`). Solo en una página de proyecto eso son ~24 req/min, de modo que el cupo de 100 se consume en ~4 minutos y, a partir de ahí, **toda** llamada a `/api` responde `429 Too Many Requests`, incluidas acciones no relacionadas como guardar una preferencia de notificación (`PUT /api/notification-preferences/:type`). El resultado observable es que el usuario desactiva un interruptor y este se revierte solo, con el error enterrado en la consola.

El comportamiento del limitador no está descrito en ninguna capacidad activa de `openspec/specs/`, así que no hay contrato que impida reintroducir el defecto ni que documente los valores esperados. Este change corrige el límite y crea esa capacidad.

## What Changes

- **Exención del polling de lectura**: los `GET` de solo lectura que la aplicación consulta de forma periódica dejan de consumir el cupo del limitador general: `GET /api/notifications`, `GET /api/notifications/unread-count`, `GET /api/chat/:projectId/messages` y `GET /api/chat/conversation/:chatId/messages`. Se implementa con un helper puro y testeable.
- **Subida del límite general**: el máximo por defecto del limitador de `/api` pasa de `100` a `1000` solicitudes por ventana de 15 minutos, porque la navegación normal ya podía superar las 100.
- **Límite configurable por entorno**: el máximo y la ventana se leen de `API_RATE_LIMIT_MAX` (por defecto `1000`) y `API_RATE_LIMIT_WINDOW_MS` (por defecto `900000`). Los limitadores de `auth/login` (5/15 min) y `auth/register` (10/h) **no cambian**.
- **Documentación de variables**: `.env.example` documenta las dos variables nuevas.
- **Contrato verificable**: nueva capacidad `api-rate-limiting` con requisitos y escenarios para el límite, la exención del polling y la configurabilidad; `runtime-configuration` se amplía para declarar las variables nuevas.

## Capabilities

### New Capabilities
- `api-rate-limiting`: límite de solicitudes de la API por IP y ventana, exención de los endpoints de polling de lectura, valores por defecto y su sobrescritura por variables de entorno.

### Modified Capabilities
- `runtime-configuration`: el catálogo de variables que `.env.example` debe documentar incorpora `API_RATE_LIMIT_MAX` y `API_RATE_LIMIT_WINDOW_MS`.

## Impact

- **Backend**: `src/server/index.ts` (límite general, `skip` de polling, lectura de env), nuevo `src/server/lib/rate-limit.ts` (helper `isPollingRequest`), nuevo `src/server/lib/rate-limit.test.ts`.
- **Configuración**: `.env.example` (dos variables nuevas, con su valor por defecto).
- **API**: sin cambios de contrato; los únicos cambios de respuesta son menos `429` en endpoints exentos y un umbral más alto en el resto.
- **Tests**: suite unitaria con Vitest (`rate-limit.test.ts`). La suite E2E no se ve afectada porque arranca el servidor con `DISABLE_RATE_LIMIT=true` (`playwright.config.ts:44`).
- **Dependencias**: ninguna nueva.
