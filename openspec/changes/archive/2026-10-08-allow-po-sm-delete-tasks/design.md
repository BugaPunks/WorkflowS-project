# Design — Allow PO/SM to Delete Tasks

## Context

El `DELETE /api/tasks/:id` de `src/server/routes/tasks.ts` está protegido con `requireSystemRole("ADMIN")`: solo un administrador puede borrar una tarea. En la prueba del flujo Scrum, la SM (Sarah) creó una tarea y recibió `403` al eliminarla, con el error genérico "Error al eliminar tarea" en la UI. Es el mismo defecto que tenía el borrado de historias de usuario (ya resuelto con `allow-po-sm-delete-user-stories`).

Referencias existentes:
- `GET /api/tasks` devuelve cada tarea con su `project: { id, name }` (include) y el scalar `projectId` → la UI puede conocer el proyecto de cada tarea
- La página Tareas (`src/pages/Tasks.tsx`) ya carga `projects` con `projectAPI.getAll({ memberId })`, que incluye `members[]` (verificado en `requireProjectRole`/proyectos) — solo falta tiparlos en la interfaz local
- El middleware `requireProjectRole` (con resolver async) ya da bypass a `ADMIN`

## Goals / Non-Goals

**Goals:**
- PO/SM del proyecto de la tarea pueden eliminar tareas de ese proyecto; devs y no-miembros no
- Botón "×" visible solo para quien puede eliminar, fail-closed
- Error real de la API en la UI (403 y mensaje del cuerpo)
- Test de integración del endpoint (como el de `sprints-remove-story`)

**Non-Goals:**
- Permitir que el dev borre solo sus propias tareas (descartado por decisión del usuario: SM + PO + ADMIN, igual que historias)
- Cambios de schema
- Modificar el flujo de mover estados del kanban

## Decisions

### 1. Middleware del DELETE: `requireProjectRole` con resolver (patrón historias)
En `src/server/routes/tasks.ts`, reemplazar `requireSystemRole("ADMIN")` por:
```ts
requireProjectRole(["PRODUCT_OWNER", "SCRUM_MASTER"], async (req) => {
	const task = await prisma.task.findUnique({ where: { id: req.params.id } });
	return task?.projectId ?? null;
})
```
- Tarea inexistente → resolver devuelve `null` → el middleware responde `400 { error: "projectId required" }` (mismo comportamiento que el DELETE de historias — consistente)
- `ADMIN` sigue pasando por el bypass del middleware
- El `import { requireSystemRole }` permanece: `POST /:id/evaluate` aún lo usa

### 2. Helper `canDeleteTask` y botón condicional
- Extender `interface Project` en `Tasks.tsx` con `members: { userId: string; role: string }[]`
- Helper puro a nivel de módulo:
```ts
function canDeleteTask(task, session, projects): boolean {
	if (!session) return false;
	if (session.role === "ADMIN") return true;
	const project = projects.find((p) => p.id === task.project?.id);
	const membership = project?.members?.find((m) => m.userId === session.id);
	return membership?.role === "PRODUCT_OWNER" || membership?.role === "SCRUM_MASTER";
}
```
- Envolver el botón "×" (líneas ~269-276) con `{canDeleteTask(task, user, projects) && (...)}`
- Fail-closed: si `projects` no cargó aún, el botón no se muestra

### 3. Errores reales en `handleDeleteTask`
Patrón idéntico al de historias: si `response.status === 403` → "No tienes permiso para eliminar esta tarea"; si no, leer `body.error` del JSON; fallback al mensaje genérico.

### 4. Test de integración (sin dependencias nuevas)
Mismo enfoque que `sprints-remove-story.test.ts`:
- `vi.mock("../db")` aislándola (mock hoisteado con `user`, `projectMember`, `task`) + `JWT_SECRET` definido en el hoisted
- Router real (`tasksRouter`) montado en app express con `express.json()`, `app.listen(0)` + `fetch`
- Tokens reales con `jsonwebtoken` (issuer/audience reales)
- No se toca `dev.db`

## Risks / Trade-offs

- [Resolver devuelve 400 para tarea inexistente (no 404)] → Aceptado por consistencia con historias; el spec documenta que la tarea inexistente no se borra (responde 400/403 según membre...) — el middleware corta antes que el handler
- [Botón × dentro del área draggable] → Si se oculta, el dev arrastra igual la tarjeta (drag intacto); el delete deja de ser accesible visualmente pero el backend sigue protegiendo
- [Doble fuente de verdad members[] ] → `projects` ya se carga con miembros; no se agregan llamadas nuevas

## Migration Plan

- Sin migración de datos: cambio aditivo en API y frontend
- Rollback: revertir `tasks.ts` y `Tasks.tsx`; no hay dato que migrar

## Open Questions

- Ninguna