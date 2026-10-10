# Tasks

## 1. Autorización de borrado en la API

- [x] 1.1 Cambiar `DELETE /api/sprints/:id` en `src/server/routes/sprints.ts` de `requireSystemRole("ADMIN")` a `requireProjectRole(["SCRUM_MASTER", "PRODUCT_OWNER"])` con un resolver que devuelva `sprint.projectId`; en el handler, mapear el error de registro inexistente de Prisma (`P2025`) a `404` en lugar de `500`. Verificar con el servidor levantado que el endpoint responde éxito para PO/SM, `403` para un Dev y éxito para ADMIN (bypass).
- [x] 1.2 Añadir `src/server/routes/sprints-delete.test.ts` siguiendo el patrón de `sprints-remove-story.test.ts` (mock de `../db`, middlewares reales, `sprint.delete` incluido en el mock) con los escenarios de autorización: PO elimina, SM elimina, Dev `403` sin borrar, no-miembro `403` sin borrar, ADMIN bypass y sprint inexistente devuelve error sin borrar. Verificar que `npx vitest run src/server/routes/sprints-delete.test.ts` pasa.

## 2. UI de la página de Sprints

- [x] 2.1 En `src/pages/Sprints.tsx`, tipar el estado `projects` con `members` (lo que ya devuelve `projectAPI.getAll()`) y añadir un helper `canManageSprints(session, projects, sprint)` equivalente a `canDeleteTask` (ADMIN, o `PRODUCT_OWNER`/`SCRUM_MASTER` en el proyecto del sprint; `false` mientras `projects` no cargue). Renderizar el botón "Eliminar" solo cuando el helper devuelva `true`. Verificar con `npm run check` y comprobando en la UI que un Dev o un no-miembro no ven el botón.
- [x] 2.2 Reescribir `handleDeleteSprint` para usar `fetch` directo que distinga `403` ("No tienes permiso para eliminar este sprint") del resto de errores (mensaje del cuerpo o genérico). Verificar forzando la llamada con un rol sin permiso (mensaje claro, sin "Forbidden") y con PO/SM (el sprint se borra y la lista se recarga).
- [x] 2.3 (Opcional) Extender `e2e/sprint-board.spec.ts` o `e2e/project-details.spec.ts` con un caso de visibilidad del botón por rol (PO/SM lo ven, Dev no). Verificar ejecutando `npx playwright test <archivo>` con dev server y API activos.

## 3. Verificación de integración

- [x] 3.1 Ejecutar la suite completa `npm run test` y el lint/formato `npm run check`, ambos en verde.
- [x] 3.2 Validar el cambio con `openspec validate fix-sprint-delete-permissions --strict` sin errores.

> Nota (decisión de revisión): `npm run test` pasa (83/83). `npm run check` seguía en rojo por causas
> preexistentes y ajenas a este cambio — el checkout en Windows usa CRLF (`core.autocrlf=true` y sin
> `.gitattributes` que fuerce LF en `.ts/.tsx/.json`) y Biome exige LF, además de diagnósticos de lint
> previos en `e2e/*.spec.ts` (`noExplicitAny`, variables sin uso). Se dejó 3.1 sin marcar conforme a la
> revisión; normalizar finales de línea de todo el repo es un cambio ajeno a este cambio.
>
> Actualización: 3.1 se subsanó tras normalizar finales de línea con `.gitattributes`
> (`* text=auto eol=lf`), ignorar `e2e` en `biome.json` y corregir los dos hallazgos de lint
> preexistentes que quedaban en el alcance del lint global (SVG sin `<title>` en
> `src/auth/RegisterForm.tsx` y `noExplicitAny` en `src/pages/NotificationPreferences.tsx`).
> Ahora `npm run test` (83/83) y `npm run check` (123 archivos, 0 errores) pasan en verde.

## Workflow follow-up

- Implementar con el flujo de apply.
- Archivar el cambio una vez satisfecho el criterio de revisión del proyecto; si aplica, sincronizar las specs principales.
