## Context

- `DELETE /api/user-stories/:id` (`src/server/routers` → `src/server/routes/user-stories.ts` líneas 191-206) usa `requireSystemRole("ADMIN")` con comentario `// DELETE user story - ADMIN only`.
- El `PUT` de la misma ruta (líneas 116-124) ya resuelve correctamente el problema del `:id` ambiguo con un resolver custom:
  ```ts
  requireProjectRole(["PRODUCT_OWNER", "SCRUM_MASTER"], async (req) => {
      const us = await prisma.userStory.findUnique({ where: { id: req.params.id } });
      return us?.projectId ?? null;
  })
  ```
- `requireProjectRole` (`src/server/middleware/project-rbac.ts`) tiene **bypass para `role === "ADMIN"`** (línea 26) y valida la membresía `ProjectMember` del usuario contra los roles permitidos; si no hay proyecto resuelto → 400; si no es miembro o rol no coincide → 403.
- Frontend `src/pages/UserStories.tsx`: `handleDeleteStory` hace `DELETE /api/user-stories/:id` y el botón "Eliminar" se renderiza incondicionalmente (línea ~210-216). La página ya carga `projectAPI.getAll({ memberId: user.id })` y `GET /api/projects` incluye `members: true` (con `userId` y `role`), pero el `interface Project` local solo tipa `{ id, name }`.
- La sesión (`useSession`) expone `session.role` (rol de sistema) y `session.id`.

Stakeholders: docente (ADMIN), Product Owner, Scrum Master, developers (ven el backlog en solo-lectura para borrar).

## Goals / Non-Goals

**Goals:**
- PO y SM del proyecto pueden eliminar historias de su backlog vía API (además de ADMIN, por bypass).
- Developers y no-miembros NO pueden eliminar (403) — la API es la autoridad.
- El botón "Eliminar" solo se muestra a quienes pueden usarlo (sin botones que fallen).
- Error de eliminación visible con el motivo real de la API.

**Non-Goals:**
- Cambiar permisos de crear/editar historias (ya correctos: PO/SM + bypass ADMIN).
- Modificar otras rutas o el middleware `requireProjectRole`.
- Tests e2e automatizados de la matriz de roles (verificación manual + unit existentes).
- Migraciones de datos o cambios de esquema.

## Decisions

### D1 — Reutilizar el resolver custom del PUT en el DELETE
- **Alternativa descartada:** resolver por defecto de `requireProjectRole` (usa `req.params.projectId || req.params.id`) — en `DELETE /:id` el `:id` es el ID de la **historia**, lo que produciría una búsqueda de membresía con un projectId inválido → 403 para siempre.
- **Decisión:** copiar el resolver async del `PUT` (historia → `projectId`). Misma semántica que edición: si la historia no existe → `null` → 400 "projectId required" (aceptable, no explica existencia de historias ajenas).

### D2 — Regla de visibilidad del botón en el frontend
- Mostrar "Eliminar" si: `session.role === "ADMIN"` **O** la membresía del `session.id` en el proyecto de esa historia tiene rol `PRODUCT_OWNER` o `SCRUM_MASTER`.
- Datos: helper puro `canDeleteStory(story, session, projects)`; `interface Project` se extiende con `members: { userId: string; role: string }[]`.
- **Fail-closed:** si `projects` está vacío/cargando o la historia no está en un proyecto conocido → botón oculto. Un admin siempre lo ve (no depende de `projects`).
- **Alternativa descartada:** ocultar el botón solo para no-ADMIN (Opción A) — rechazada porque impide al PO gestionar su propio backlog.

### D3 — Backend como autoridad, frontend como UX
- El frontend oculta el botón, pero cualquier cliente que fuerce la petición pasa por el mismo `requireProjectRole` → 403. No se confía en el ocultamiento para seguridad.

### D4 — Mensaje de error honesto
- `handleDeleteStory` distingue `response.status === 403` ("No tienes permiso...") / `404|400` y el mensaje `error` del body si existe, en vez del genérico "Error al eliminar historia". Sin cambios de API.

## Risks / Trade-offs

- [El resolver hace un `findUnique` extra por request de borrado] → Negligible: una query puntual por PK, igual que ya hace el PUT.
- [Historia inexistente devuelve 400 en vez de 404] → Comportamiento ya aceptado en el PUT (mismo resolver); cambiarlo requeriría tocar el middleware (fuera de alcance).
- [Sessions viejas sin `role`/`id`] → `useSession` ya alimenta el resto de la UI con esos campos; si faltan → botón oculto (fail-closed).
- [Ocultar el botón rompe flujo de un ADMIN que no es miembro] → El check de ADMIN va primero y no depende de membresía.
- [Conflicto con el change `fix-modal-overlay-and-story-points` tocando el mismo archivo] → Ambos cambios ya aplicaron/editan `UserStories.tsx`; aplicar este change después del otro (estado actual) evita conflictos.

## Migration Plan

1. Sin migraciones ni despliegue especial — frontend + una línea de middleware, HMR en desarrollo.
2. Orden: backend (D1) → frontend (D2/D4) → verificación.
3. **Rollback:** `git revert` — el endpoint vuelve a ADMIN-only sin datos involucrados.

## Open Questions

- ¿Exponer en el futuro un `GET /api/user-stories/:id/can-manage` para no derivar permisos de la lista de proyectos? (No necesario hoy; fuera de alcance.)
