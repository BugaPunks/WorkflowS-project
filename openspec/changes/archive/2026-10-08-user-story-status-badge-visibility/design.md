## Context

La página `UserStories.tsx` muestra, por tarjeta: un badge con `story.status` y, para quienes gestionan el proyecto (`canManageStory`), un `<select>` de estado `BACKLOG`/`COMPLETED` (agregado en el cambio anterior). Para esos usuarios el badge es redundante, porque el selector ya comunica el estado. Para los developers, que no ven el selector, el badge sigue siendo la única forma de ver el estado.

## Goals / Non-Goals

**Goals:**
- Mostrar el badge de estado **solo** a usuarios que no pueden gestionar la historia (no ven el selector).
- Mantener el comportamiento fail-closed ya establecido: sin datos de membresía, no se ofrece el selector.

**Non-Goals:**
- Cambiar el selector, su lógica de permisos o su handler.
- Cambiar backend, schema o tests.
- Modificar el layout más allá del renderizado condicional del badge.

## Decisions

### 1. Renderizar el badge con la negación del mismo helper
En `UserStories.tsx`, envolver el `<span>` del badge en la condición inversa al selector:
```tsx
{!canManageStory(story, user, projects) && (
  <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-900">
    {story.status || "PENDING"}
  </span>
)}
```
- Reutiliza el helper `canManageStory` ya existente: fuente única de verdad del permiso, sin lógica duplicada.
- Efecto colateral deseado (fail-closed coherente): si las membresías aún no cargaron, `canManageStory` es `false` → se muestra el badge y no el selector.
- Alternativa considerada: mover el selector al lugar del badge en vez de ocultarlo. Se descartó por ser un cambio mayor de layout sin beneficio; el selector ya está junto a "Eliminar".

### 2. Colorear el selector según el estado
Para conservar la lectura rápida (que el badge aportaba) sin reintroducir el componente extra, el `<select>` se pinta según el valor mostrado:
```tsx
function statusSelectClassName(status: string): string {
  const base = "text-xs border rounded px-2 py-1";
  return status === "COMPLETED"
    ? `${base} bg-green-100 text-green-800 border-green-300`
    : `${base} bg-gray-100 text-gray-700 border-gray-300`;
}
```
- `className={statusSelectClassName(story.status)}` en el selector.
- El color se deriva del mismo valor normalizado que el `value` del selector (`COMPLETED` vs. resto), por lo que es consistente con lo que ve el usuario.
- Alternativa considerada: un punto (dot) de color junto al selector; se descartó por añadir un elemento extra, justo lo que se buscaba evitar.

## Risks / Trade-offs

- [Un manager deja de ver el texto crudo del estado] → El selector muestra "Backlog"/"Completada", que es información equivalente y accionable.
- [Dependencia de `canManageStory` en dos lugares] → Es exactamente lo deseado: ambos controles quedan gobernados por la misma regla de permiso.

## Migration Plan

- Sin migración de datos. Rollback: revertir el cambio puntual en `UserStories.tsx`.

## Open Questions

- Ninguna.
