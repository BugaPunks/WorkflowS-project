# Proposal

## Why

La página de Sprints muestra el botón "Eliminar" a **cualquier** rol, pero `DELETE /api/sprints/:id` solo autoriza a `ADMIN`: un `SCRUM_MASTER` o `PRODUCT_OWNER` confirma el borrado y recibe un `403` (`Forbidden`) sin explicación. Esto rompe el patrón ya establecido para tareas e historias —donde `PRODUCT_OWNER`/`SCRUM_MASTER` del proyecto sí pueden eliminar y el control se oculta al resto (fail-closed)— y contradice el rol del Scrum Master, que gestiona el ciclo de vida de los Sprints (los crea, inicia y completa, y puede borrar tareas/historias).

## What Changes

- **API**: `DELETE /api/sprints/:id` pasa de `requireSystemRole("ADMIN")` a `requireProjectRole(["SCRUM_MASTER", "PRODUCT_OWNER"])` con el proyecto del sprint como alcance, conservando el bypass de `ADMIN`. Devs y no-miembros reciben `403`.
- **UI**: la página de Sprints renderiza el botón "Eliminar" solo a quien puede borrar el sprint (`ADMIN`, o `PRODUCT_OWNER`/`SCRUM_MASTER` en su proyecto), ocultándolo cuando las membresías aún no están cargadas (fail-closed).
- **UI**: `handleDeleteSprint` distingue el `403` con un mensaje claro ("No tienes permiso para eliminar este sprint") y muestra el mensaje del cuerpo en otros errores, en lugar del texto crudo de la respuesta.
- **Especificación**: se añaden requisitos a `sprint-lifecycle` para la autorización de borrado, la visibilidad condicional del control y el feedback de error.
- **Pruebas**: pruebas de integración de autorización del endpoint (PO, SM, Dev, no-miembro, ADMIN bypass, sprint inexistente) y verificación de que la respuesta no altera datos cuando corresponde.

### Non-goals

- No se modifica en este cambio la visibilidad del botón "Nuevo Sprint" (crear), que también se muestra a roles sin permiso. Queda como seguimiento separado.
- No se cambia el modelo de datos ni el esquema de Prisma.
- No se toca el contrato de `PUT /api/sprints/:id` ni el de `DELETE /api/sprints/:id/stories/:storyId`.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `sprint-lifecycle`: se añaden requisitos para (1) autorizar la eliminación de un sprint a `PRODUCT_OWNER`/`SCRUM_MASTER` del proyecto y `ADMIN` (bypass), con `403` para el resto y sin modificar nada si el sprint no existe; (2) mostrar el control "Eliminar" solo a quienes pueden usarlo, fail-closed; y (3) un mensaje de error específico al eliminar.

## Impact

- `src/server/routes/sprints.ts` — el handler `DELETE /:id`.
- `src/pages/Sprints.tsx` — helper de permisos, render condicional del botón y `handleDeleteSprint`.
- `openspec/specs/sprint-lifecycle/spec.md` — requisitos nuevos (vía delta del cambio).
- Pruebas: nuevo archivo de integración del endpoint (p. ej. `src/server/routes/sprints-delete.test.ts`), siguiendo el estilo de `sprints-remove-story.test.ts`; la verificación E2E de visibilidad es opcional.
- Sin cambios de dependencias ni de esquema de base de datos.
