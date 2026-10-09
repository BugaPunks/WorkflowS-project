## Context

`src/pages/UserStories.tsx` lista las historias del usuario en tarjetas y ofrece crear, ver y eliminar. El backend (`src/server/routes/user-stories.ts`, `PUT /:id`) **ya** soporta cambiar `status` y ajustar `completedAt` (se setea con `COMPLETED`/`DONE`, se limpia con `BACKLOG`/`TODO`), protegido por `authenticateToken` + `requireProjectRole(["PRODUCT_OWNER","SCRUM_MASTER"])` con bypass `ADMIN`. El endpoint **no tiene tests** y el front nunca lo invoca.

Referencias existentes:
- `canDeleteStory(story, session, projects)` (`UserStories.tsx:24`) ya resuelve el permiso de gestión (ADMIN, o PO/SM en el proyecto de la historia) y es fail-closed cuando `projects` aún no cargó.
- El manejo de errores de `handleDeleteStory` (`UserStories.tsx:120`) es el patrón a reutilizar: distingue `403`, lee `body.error` y cae a un mensaje genérico.
- El estado de una HU hoy se muestra con un badge (`story.status || "PENDING"`).
- `requireProjectRole` responde `400 { error: "projectId required" }` si el resolver no encuentra proyecto (historia inexistente y usuario no ADMIN).

## Goals / Non-Goals

**Goals:**
- Permitir alternar el estado de una HU entre `BACKLOG` y `COMPLETED` desde la página *Historias*.
- Mostrar el control solo a quien puede usarlo (ADMIN, o PO/SM del proyecto de la historia), fail-closed mientras no carguen las membresías.
- Recargar la lista al éxito y mostrar el error real de la API (incluido `403`) al fallo.
- Cubrir con test de integración el contrato `PUT /api/user-stories/:id`.

**Non-Goals:**
- Cambiar el backend, el schema o la autorización (ya soportan todo).
- Máquina de estados de 3+ valores o estados intermedios como `IN_PROGRESS` (decisión del usuario: solo `BACKLOG` ↔ `COMPLETED`).
- Permitir el cambio a `TEAM_DEVELOPER`.
- Drag & drop en el tablero del proyecto para el estado de la HU.
- Un test unitario de UI (no hay infraestructura de testing de componentes en el repo).

## Decisions

### 1. Selector de dos opciones por tarjeta, gated por permiso
En la tarjeta de `UserStories.tsx`, dentro del bloque `flex items-center justify-between mt-auto` (junto al badge de estado), se agrega:
```tsx
{canManageStory(story, user, projects) && (
  <select
    value={story.status === "COMPLETED" ? "COMPLETED" : "BACKLOG"}
    onChange={(e) => handleToggleStatus(story, e.target.value)}
    className="text-xs border rounded px-2 py-1"
    aria-label="Estado de la historia"
  >
    <option value="BACKLOG">Backlog</option>
    <option value="COMPLETED">Completada</option>
  </select>
)}
```
- `canManageStory(story, session, projects)` replica la lógica de `canDeleteStory` (ADMIN, o PO/SM en el proyecto) y es fail-closed si faltan datos. Se extrae como helper con nombre genérico para no acoplar ambas acciones; `canDeleteStory` puede reutilizarlo.
- El `value` normaliza cualquier estado no-`COMPLETED` (p. ej. `PENDING`) a `BACKLOG`, manteniendo el control en 2 estados.
- Alternativa considerada: botón toggle ("Marcar completada"/"Reabrir"); se descartó para ofrecer un único control explícito con los dos valores visibles.

### 2. Handler `handleToggleStatus`
```tsx
const handleToggleStatus = async (story: UserStory, status: string) => {
  try {
    const response = await fetch(`/api/user-stories/${story.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("No tienes permiso para cambiar el estado de esta historia");
      }
      let message = "Error al cambiar el estado de la historia";
      try {
        const body = await response.json();
        if (body?.error) message = body.error;
      } catch {
        // respuesta sin cuerpo JSON
      }
      throw new Error(message);
    }
    await loadStories();
  } catch (err) {
    setError(err instanceof Error ? err.message : "Error al cambiar el estado");
    console.error(err);
  }
};
```
- Reutiliza `loadStories` (ya existe) y el banner de `error` existente.
- La página usa `fetch` crudo para sus operaciones (como el resto del archivo), no `userStoryAPI`.

### 3. Sin cambios de backend
El endpoint y su autorización ya existen. El único trabajo de contrato es **agregar el test de integración** porque la UI pasa a depender de él.

### 4. Test de integración `user-stories-status.test.ts`
Mismo esqueleto que `tasks-remove.test.ts`: `vi.mock("../db")` con `user`, `projectMember`, `userStory` (`findUnique`, `update`), `vi.mock("../lib/notify")`, router real `userStoriesRouter` montado con `express.json()` y `listen(0)`, tokens JWT reales. Casos:
- `401` sin token
- `403` `TEAM_DEVELOPER`
- `403` sin membresía
- `200` PO → `COMPLETED`: `userStory.update` recibe `status: "COMPLETED"` y `completedAt` (Date)
- `200` SM → `BACKLOG`: `completedAt: null`
- `200` ADMIN (bypass) sin membresía
- `400` (`projectId required`) si la historia no existe
- `500` si `update` falla

> `userStory.findUnique` se usa dos veces (resolver de RBAC + lectura de `assigneeId`); el mock devuelve un objeto con `projectId` y `assigneeId` para satisfacer ambas.

## Risks / Trade-offs

- [Normalizar estados no-COMPLETED a BACKLOG en el selector] → Un estado exótico (`PENDING`) se muestra como "Backlog"; es aceptable porque la decisión es un modelo de 2 estados y el backend normaliza con `BACKLOG`/`TODO`.
- [Cambio de estado sin confirmación] → Es idempotente y reversible (volver a `BACKLOG` limpia `completedAt`), por lo que no requiere `confirm()`; el badge y el selector reflejan el nuevo estado.
- [Recargar toda la lista en cada cambio] → Consistente con el resto de la página y suficiente para el volumen esperado.

## Migration Plan

- Sin migración de datos: solo UI y un test nuevo.
- Rollback: revertir `UserStories.tsx` y eliminar el test; sin impacto en datos.

## Open Questions

- Ninguna.
