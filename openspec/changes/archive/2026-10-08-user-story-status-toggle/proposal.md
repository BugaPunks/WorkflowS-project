# User Story Status Toggle

## Why

El backend ya permite cambiar el estado de una historia de usuario (`PUT /api/user-stories/:id` acepta `status`, marca `completedAt` con `COMPLETED`/`DONE` y lo limpia con `BACKLOG`/`TODO`), pero **ninguna página del frontend lo llama**. Hoy las HUs se pueden crear, ver y eliminar, pero no marcar como terminadas desde la UI, lo que impide cerrar el flujo Scrum (una HU nunca podrá reflejar que su trabajo se completó).

## What Changes

- Agregar en cada tarjeta de la página **Historias** (`UserStories.tsx`) un **selector de estado** que permita alternar entre `BACKLOG` y `COMPLETED`, visible solo para quienes gestionan el proyecto (`PRODUCT_OWNER`/`SCRUM_MASTER`, o `ADMIN` del sistema).
- Handler `handleToggleStatus` que llama a `PUT /api/user-stories/:id` con el estado contrario, recarga la lista al éxito y muestra el error de la API al fallo (incluyendo `403`).
- Agregar un **test de integración** para `PUT /api/user-stories/:id` cubriendo transiciones de estado, autorización (PO/SM/ADMIN/403) y el efecto sobre `completedAt`.

## Capabilities

### New Capabilities
<!-- Ninguna: se extiende una capacidad existente. -->

### Modified Capabilities
- `user-story-management`: se agrega el requisito de cambio de estado (toggle `BACKLOG` ↔ `COMPLETED`) desde la UI, con autorización PO/SM/ADMIN, visibilidad fail-closed y feedback de error.

## Impact

- `src/pages/UserStories.tsx`: selector de estado por tarjeta + helper de permisos + handler `handleToggleStatus`
- `src/server/routes/user-stories-status.test.ts` (nuevo): integración del `PUT /api/user-stories/:id` (vitest + `fetch` nativo + `vi.mock("../db")`), reutilizando el patrón de los tests de rutas existentes
- **Sin cambios de backend ni de schema**: el endpoint ya existe y ya aplica la autorización; solo se agrega cobertura de test y UI
- `src/api/client.ts`: sin cambios (el handler usa el patrón `fetch` crudo que ya usa la página)
