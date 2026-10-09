# Design

## Context

Ver `proposal.md` - Why para la motivación.

Estado actual relevante:

- `src/server/routes/sprints.ts`: `DELETE /:id` usa `requireSystemRole("ADMIN")`. En el mismo archivo, `PUT /:id` y `DELETE /:id/stories/:storyId` ya usan `requireProjectRole(["SCRUM_MASTER", "PRODUCT_OWNER"], <resolver>)` con un resolver que lee `sprint.projectId`, y `requireProjectRole` aplica el bypass de `ADMIN` de forma centralizada (`src/server/middleware/project-rbac.ts`).
- `src/pages/Sprints.tsx`: el botón "Eliminar" se renderiza sin condición de rol y `handleDeleteSprint` usa `sprintAPI.delete`, que lanza un `Error` con el mensaje del cuerpo o `statusText` y pierde el código de estado.
- `src/pages/Tasks.tsx` y `src/pages/UserStories.tsx` ya resuelven el mismo problema: helper `canDelete*`/`canManage*` sobre la lista `projects` (con `members`) y `fetch` directo que distingue `403`.
- `GET /api/sprints` devuelve `project: true` (solo escalares), por lo que la membresía no viaja en el sprint; la página ya carga `projectAPI.getAll()`, cuya respuesta incluye `members`.

## Goals / Non-Goals

**Goals:**

- Que el permiso de borrado del sprint se decida en un solo lugar y coincida entre API y UI.
- Reutilizar el patrón ya probado de tareas/historias para minimizar decisiones nuevas.

**Non-Goals:**

- No introducir un sistema genérico de capacidades/permisos ni cambiar `project-rbac.ts`.
- No tocar la autorización de creación de sprints ni la visibilidad del botón "Nuevo Sprint" (seguimiento aparte).

## Decisions

### Decisión 1: Usar `requireProjectRole` con resolver del proyecto del sprint

`DELETE /api/sprints/:id` pasa a:

```ts
requireProjectRole(["SCRUM_MASTER", "PRODUCT_OWNER"], async (req) => {
  const sprint = await prisma.sprint.findUnique({
    where: { id: req.params.id },
    select: { projectId: true },
  });
  return sprint?.projectId ?? null;
})
```

- **Por qué:** es idéntico al patrón de `PUT /:id` y `DELETE /:id/stories/:storyId`; obtiene el bypass de ADMIN gratis y no duplica lógica.
- **Alternativa descartada:** comprobar la membresía a mano dentro del handler. Duplicaría la resolución de proyecto y el bypass de ADMIN.

El resolver custom es obligatorio: el resolver por defecto tomaría `req.params.id` como `projectId`.

### Decisión 2: El helper de UI lee la membresía de la lista `projects`

Añadir `canManageSprints(session, projects, sprint)` en `Sprints.tsx` con la misma forma que `canDeleteTask`: `true` si `session.role === "ADMIN"`, o si existe una membresía `PRODUCT_OWNER`/`SCRUM_MASTER` del usuario en el proyecto del sprint; `false` mientras `projects` no haya cargado.

- **Por qué:** `GET /api/sprints` no incluye `members`; la lista `projects` (que la página ya carga) sí. Además iguala tareas/historias y es fail-closed.
- **Alternativa descartada:** ampliar `GET /api/sprints` para incluir `project.members`. Sería un cambio de contrato de API para un dato que la página ya tiene.

### Decisión 3: `handleDeleteSprint` usa `fetch` para distinguir el `403`

Sustituir `sprintAPI.delete` por `fetch("/api/sprints/:id", { method: "DELETE" })` y, ante `!response.ok`, devolver "No tienes permiso para eliminar este sprint" si el estado es `403`, o el `error` del cuerpo en otro caso.

- **Por qué:** `sprintAPI.delete` no conserva el código de estado; tareas/historias ya usan `fetch` directo. Mantener el mismo enfoque evita tocar el cliente API compartido.
- **Alternativa descartada:** hacer que `apiRequest` adjunte el estado al `Error`. Es un cambio transversal a todo el cliente para un solo consumidor.

### Decisión 4: Sprint inexistente devuelve un error sin borrar nada

Se mantiene el comportamiento de `PUT /:id` (mismo resolver): un no-miembro recibe `400` del middleware al no poder resolver el proyecto. En el handler se mapea el error de registro inexistente de Prisma (`P2025`) a `404` para el caso de ADMIN, en lugar del `500` actual.

- **Por qué:** el spec solo exige "un error sin eliminar nada"; esto queda cubierto y mejora el caso ADMIN sin romper el patrón existente.
- **Nota:** no se busca uniformar todo a `404`; hacerlo exigiría salir del patrón `requireProjectRole`.

## Risks / Trade-offs

- [La UI oculta el botón mientras `projects` carga, incluso para ADMIN] → Es el comportamiento fail-closed buscado (igual que tareas/historias); el estado es breve y la lista se carga al montar la página.
- [Ampliar el permiso de borrado a SM/PO habilita borrados que antes no ocurrían] → Es la decisión de producto alineada con `task-management`/`user-story-management`; queda cubierta por escenarios de spec y pruebas de autorización.
- [Duplicar el helper de permisos por página en lugar de centralizarlo] → Se acepta para seguir el patrón local existente; una abstracción común sería un refactor aparte.

## Migration Plan

Sin cambios de datos ni de esquema. Despliegue atómico de API + UI. Rollback: revertir el cambio; la API vuelve a permitir el borrado solo a ADMIN y la UI vuelve a mostrar el botón a todos.

## Open Questions

Ninguna.
