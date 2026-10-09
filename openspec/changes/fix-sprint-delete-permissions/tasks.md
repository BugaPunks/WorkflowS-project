# Tasks

## 1. Autorización de borrado en la API

- [ ] 1.1 Cambiar `DELETE /api/sprints/:id` en `src/server/routes/sprints.ts` de `requireSystemRole("ADMIN")` a `requireProjectRole(["SCRUM_MASTER", "PRODUCT_OWNER"])` con un resolver que devuelva `sprint.projectId`; en el handler, mapear el error de registro inexistente de Prisma (`P2025`) a `404` en lugar de `500`. Verificar con el servidor levantado que el endpoint responde éxito para PO/SM, `403` para un Dev y éxito para ADMIN (bypass).
- [ ] 1.2 Añadir `src/server/routes/sprints-delete.test.ts` siguiendo el patrón de `sprints-remove-story.test.ts` (mock de `../db`, middlewares reales, `sprint.delete` incluido en el mock) con los escenarios de autorización: PO elimina, SM elimina, Dev `403` sin borrar, no-miembro `403` sin borrar, ADMIN bypass y sprint inexistente devuelve error sin borrar. Verificar que `npx vitest run src/server/routes/sprints-delete.test.ts` pasa.

## 2. UI de la página de Sprints

- [ ] 2.1 En `src/pages/Sprints.tsx`, tipar el estado `projects` con `members` (lo que ya devuelve `projectAPI.getAll()`) y añadir un helper `canManageSprints(session, projects, sprint)` equivalente a `canDeleteTask` (ADMIN, o `PRODUCT_OWNER`/`SCRUM_MASTER` en el proyecto del sprint; `false` mientras `projects` no cargue). Renderizar el botón "Eliminar" solo cuando el helper devuelva `true`. Verificar con `npm run check` y comprobando en la UI que un Dev o un no-miembro no ven el botón.
- [ ] 2.2 Reescribir `handleDeleteSprint` para usar `fetch` directo que distinga `403` ("No tienes permiso para eliminar este sprint") del resto de errores (mensaje del cuerpo o genérico). Verificar forzando la llamada con un rol sin permiso (mensaje claro, sin "Forbidden") y con PO/SM (el sprint se borra y la lista se recarga).
- [ ] 2.3 (Opcional) Extender `e2e/sprint-board.spec.ts` o `e2e/project-details.spec.ts` con un caso de visibilidad del botón por rol (PO/SM lo ven, Dev no). Verificar ejecutando `npx playwright test <archivo>` con dev server y API activos.

## 3. Verificación de integración

- [ ] 3.1 Ejecutar la suite completa `npm run test` y el lint/formato `npm run check`, ambos en verde.
- [ ] 3.2 Validar el cambio con `openspec validate fix-sprint-delete-permissions --strict` sin errores.

## Workflow follow-up

- Implementar con el flujo de apply.
- Archivar el cambio una vez satisfecho el criterio de revisión del proyecto; si aplica, sincronizar las specs principales.
