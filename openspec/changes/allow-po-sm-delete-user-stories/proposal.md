## Why

Durante la prueba del flujo se detectó una inconsistencia de permisos: el Product Owner puede crear y editar historias de usuario, pero **no puede eliminarlas** — `DELETE /api/user-stories/:id` exige `requireSystemRole("ADMIN")` y devuelve 403, mientras que el frontend muestra el botón "Eliminar" a **todos** los usuarios sin verificar rol (el PO lo ve, hace clic y falla; los developers ven un botón que nunca debería estar ahí).

## What Changes

- **Backend:** `DELETE /api/user-stories/:id` pasa de `requireSystemRole("ADMIN")` a `requireProjectRole(["PRODUCT_OWNER", "SCRUM_MASTER"], <resolver>)`, reutilizando el mismo resolver custom del `PUT` (busca la historia y devuelve su `projectId`, ya que en esa ruta el `:id` es la historia y no el proyecto). El bypass de ADMIN del middleware conserva el acceso del docente.
- **Frontend:** el botón "Eliminar" en `src/pages/UserStories.tsx` se renderiza solo cuando el usuario es `ADMIN` del sistema, o `PRODUCT_OWNER`/`SCRUM_MASTER` en el proyecto de esa historia (dato ya disponible en los proyectos cargados con sus `members`).
- **Frontend:** `handleDeleteStory` muestra el error real devuelto por la API en lugar del mensaje genérico.
- Sin cambios de datos ni migraciones.

## Capabilities

### New Capabilities
- `user-story-management`: Autorización para administrar (eliminar) historias de usuario — quién puede borrar vía API según rol de sistema y rol en el proyecto, y visibilidad condicional del botón de eliminación en la UI.

### Modified Capabilities

## Impact

- **Archivos:** `src/server/routes/user-stories.ts` (middleware del DELETE, ~6 líneas + comentario), `src/pages/UserStories.tsx` (interface `Project` con `members`, helper de permisos, renderizado condicional del botón, mensaje de error).
- **API:** `DELETE /api/user-stories/:id` — comportamiento relajado de ADMIN-only a PO/SM/ADMIN (no es BREAKING: solo amplía quién puede; los clientes existentes que podían borrar siguen pudiendo).
- **Seguridad:** la autoridad sigue siendo el backend (un developer que fuerce la petición recibe 403); el frontend solo mejora la UX.
- **Dependencias/backend extra:** ninguno. Relacionado con el change `fix-modal-overlay-and-story-points` (que introdujo el campo de puntos), pero de alcance independiente.
