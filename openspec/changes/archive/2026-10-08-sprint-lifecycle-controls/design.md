# Design — Sprint Lifecycle Controls

## Context

`src/pages/ProjectDetail.tsx` renderiza cada sprint en una tarjeta con encabezado (nombre, fechas, badge de estado, y "Calificar Sprint" si `isProjectAdmin`). El estado se muestra con un badge (`sprint.status`) pero no hay botón para cambiarlo.

Referencias existentes:
- `PUT /api/sprints/:id` (`src/server/routes/sprints.ts:100`): `authenticateToken` + `requireProjectRole(["SCRUM_MASTER","PRODUCT_OWNER"])` con resolver por `sprint.projectId` (bypass `ADMIN`). Al recibir `status === "COMPLETED"` (si antes no lo estaba) hace `notify(...)` a **todos** los miembros del proyecto con `type: "SPRINT_COMPLETED"`.
- `sprintUpdateSchema.status` es `z.string().optional()` → acepta cualquier estado.
- `sprintAPI.update(id, data)` ya existe en `src/api/client.ts:99`.
- `isProjectAdmin` (`ProjectDetail.tsx:765-769`) = membresía `OWNER`/`LEAD`/`SCRUM_MASTER`/`PRODUCT_OWNER` o `user.role === "ADMIN"`. Es el flag que ya usan "+ Nuevo Sprint" y el borrado de historias.

## Goals / Non-Goals

**Goals:**
- Iniciar un sprint (PLANNING/PLANNED → ACTIVE) y completarlo (ACTIVE → COMPLETED) desde la UI
- Acción visible solo para `isProjectAdmin`; devs no las ven
- Confirmación al completar (dispara notificación masiva) y aviso si hay tareas pendientes
- Recarga tras éxito y feedback de error real
- Test de integración del contrato `PUT /api/sprints/:id`

**Non-Goals:**
- Cambiar el backend o el schema (ya soporta todo)
- Máquina de estados estricta en el servidor (transiciones inválidas fuera de las dos acciones de UI)
- Cerrar automáticamente tareas/HU al completar (queda para un flujo posterior)
- Múltiples sprints activos simultáneos (fuera de alcance)

## Decisions

### 1. Dos botones en el encabezado de la tarjeta, gated por `isProjectAdmin`
En `ProjectDetail.tsx`, dentro del bloque `flex items-center gap-3` del encabezado (junto al badge), antes del badge de estado:
```tsx
{isProjectAdmin && canStartSprint(sprint.status) && (
  <button type="button" onClick={() => handleSprintStatus(sprint.id, "ACTIVE")}
    className="text-xs text-green-700 hover:text-green-800 font-medium underline">
    Iniciar Sprint
  </button>
)}
{isProjectAdmin && canCompleteSprint(sprint.status) && (
  <button type="button" onClick={() => handleSprintStatus(sprint.id, "COMPLETED")}
    className="text-xs text-blue-950 hover:text-blue-800 font-medium underline">
    Completar Sprint
  </button>
)}
```
- `canStartSprint(status)` = `status === "PLANNING" || status === "PLANNED"` (helpers puros a nivel de módulo, testables)
- `canCompleteSprint(status)` = `status === "ACTIVE"`
- Un sprint `COMPLETED` no muestra ninguno

### 2. Handler único `handleSprintStatus`
```tsx
const handleSprintStatus = async (sprintId: string, status: string) => {
  if (status === "COMPLETED") {
    const pendingTasks = /* tareas del sprint con status !== "COMPLETED" */
    const msg = pendingTasks > 0
      ? `Hay ${pendingTasks} tarea(s) sin completar. ¿Completar el sprint igualmente?`
      : "¿Completar el sprint? Se notificará a todos los miembros.";
    if (!confirm(msg)) return;
  }
  try {
    // El archivo usa `fetch` crudo para todas las operaciones de sprint.
    const response = await fetch(`/api/sprints/${sprintId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) { /* extraer body.error → throw */ }
    await loadProject(); // recarga existente (proyecto + sprints + historias)
  } catch (err) {
    alert(err instanceof Error ? err.message : "No se pudo actualizar el sprint");
  }
};
```
- Reutiliza `loadProject` (el loader ya existente) para refrescar la vista
- `pendingTasks`: se cuenta desde `sprint.tasks` (el `GET /api/sprints` ya incluye `tasks`), filtrando `status !== "COMPLETED"`

### 3. Sin cambios de backend
El endpoint ya valida autorización y emite notificaciones. Solo agregamos cobertura de test porque la UI pasa a depender del contrato.

### 4. Test de integración `sprints-lifecycle.test.ts`
Mismo esqueleto que `sprints-remove-story.test.ts`: `vi.mock("../db")` con `user`, `projectMember`, `sprint` (`findUnique`, `update`) y `notify` mockeado; router real `sprintsRouter` montado en express con `express.json()` y `listen(0)`; tokens reales. Casos:
- `403` dev / no-miembro; `401` sin token
- `200` SM y PO cambiando a `ACTIVE`
- `200` ADMIN (bypass) sin membresía
- Al pasar a `COMPLETED` (desde distinto estado): `sprint.update` con `status: "COMPLETED"` y `notify` llamado **una vez por miembro** con `type: "SPRINT_COMPLETED"`
- Al pasar a `COMPLETED` cuando ya estaba `COMPLETED`: **no** re-notifica
- `400` (`projectId required`) si el sprint no existe

> Nota de implementación: mockear `../lib/notify` con `vi.fn()` para poder aseverar las notificaciones sin depender de prisma.

## Risks / Trade-offs

- [Completar el sprint con trabajo pendiente] → Se avisa por `confirm()`, pero se permite (comportamiento Scrum) — el trabajo no terminado queda visible y puede moverse a otro sprint después
- [Transiciones inválidas vía API directa] → Fuera de alcance; la UI solo ofrece las dos acciones válidas
- [Doble clic en completar] → El backend no re-notifica si ya estaba `COMPLETED` (guard existente), por lo que el peor caso es una transición idempotente

## Migration Plan

- Sin migración de datos: solo UI y tests
- Rollback: revertir `ProjectDetail.tsx` y eliminar el test nuevo; sin impacto en datos

## Open Questions

- Ninguna