## Context

`src/pages/UserStories.tsx` es el único punto donde se capturan Story Points. En
`handleCreateStory` el valor del campo se mapea así:

```ts
const points =
  storyPoints.trim() === ""
    ? undefined
    : Math.min(99, Math.max(0, Number.parseInt(storyPoints, 10) || 0));
```

El `|| 0` convierte en `0` cualquier contenido no parseable (`.`, `-`, `+`), y `0` es
indistinguible de "sin estimar" en la UI: las tarjetas sólo pintan el badge cuando
`storyPoints != null`, y `0 != null`, así que una historia sin estimar no muestra nada y una
"convertida a 0" muestra `0 pts`.

En las métricas (`src/server/lib/metrics.ts`), `computeBurndown` y `computeVelocity` ya tratan
`null` y `0` igual con `item.storyPoints || 0`. Es decir: cambiar `null` por `0` no altera
`totalPoints`, `committed` ni `completed`, y por eso **los gráficos del docente no cambian**. Lo que
falta es información explícita: cuántas historias del sprint quedaron sin estimar.

El requirement vigente de `metrics-computation` "Stories carrying zero points are counted as
estimated" fija que `0` es una estimación válida y se muestra como `0`; esto condiciona la decisión
de parseo (ver Decisión 1).

## Goals / Non-Goals

**Goals:**

- Que el campo de puntos vacío o no numérico guarde "sin estimar" (`null`) y nunca `0`.
- Distinguir visualmente "sin estimar" de `0 pts` en la UI.
- Exponer el conteo de historias sin estimar en burndown y velocidad, sin tocar los totales.

**Non-Goals:**

- Editar una historia ya creada para asignarle puntos (hoy requiere borrar y recrear).
- Cambiar el CSV de exportación (es por tareas y ya escribe `points: "N/A"`).
- Alterar el cálculo de totales o los gráficos existentes.
- Tocar el esquema Prisma (no hace falta migración).

## Decisions

**Decisión 1: Un `0` explícito sigue siendo `0`; sólo vacío/no numérico pasa a "sin estimar".**

Se descartó la variante "todo `0` es sin estimar" porque `0` es una estimación válida en Planning
Poker y el requirement vigente de `metrics-computation` obliga a contarla y mostrarla como `0`. El
bug real es el `|| 0` que fabrica ceros a partir de basura; se corrige distinguiendo "no parseable"
de "cero".

Alternativas consideradas:

- *Tratar 0 como sin estimar*: elimina la posibilidad de estimar historias triviales y contradice
  el requirement de `metrics-computation`. Descartada.
- *Validar en el backend*: el backend ya recibe sólo números (zod) y `null` cuando el campo se
  omite; el problema está en el cliente antes de enviar. Mantener el arreglo en el cliente evita
  cambiar contratos.

**Decisión 2: El parseo usa `Number.isFinite` sobre el entero, no `|| 0`.**

Regla propuesta en el cliente:

```ts
const raw = storyPoints.trim();
const parsed = raw === "" ? Number.NaN : Number.parseInt(raw, 10);
const points = Number.isFinite(parsed)
  ? Math.min(99, Math.max(0, parsed))
  : undefined; // "sin estimar": se omite storyPoints y Prisma guarda null
```

`raw === ""` ya cae en `NaN`; el `Math.min/Math.max` conserva el rango 0–99 existente. Un `"0"`
produce `points = 0` y se envía.

**Decisión 3: `unestimated` como campo adicional en las funciones puras de métricas.**

`computeBurndown` devuelve `{ totalPoints, series, unestimated }` y `computeVelocity` añade
`unestimated` a cada entrada. Se calcula contando `item.storyPoints == null`. No se toca el `|| 0`
de los totales. Las rutas (`src/server/routes/metrics.ts`) ya devuelven el objeto de la función tal
cual, así que el campo nuevo viaja sin cambios en el contrato existente.

**Decisión 4: Badge "Sin estimar" reutilizable en las tres vistas.**

En `UserStories.tsx`, `ProjectDetail.tsx` (backlog y tarjeta dentro del sprint) el patrón
`storyPoints != null ? "N pts" : "Sin estimar"` sustituye al render condicional actual. El conteo
por sprint ("N historias · M sin estimar") se añade en la tarjeta de sprint y en Reportes.

## Risks / Trade-offs

- **Cambia una expectativa previa de la spec**: "Tarjeta sin puntos no muestra ningún badge" pasa a
  "muestra 'Sin estimar'". Es intencional y es el objetivo del change; se refleja como MODIFIED.
- **Historias ya guardadas con `0` fabricado** por el bug anterior no se migran (no se sabe cuáles
  eran realmente `0` legítimo). El conteo de "sin estimar" sólo cuenta `null` de ahora en adelante.
  → Aceptado: corregir datos retroactivamente requeriría adivinar la intención.
- **Recharts y campos nuevos**: `unestimated` no se añade como serie; se muestra como texto/badge
  junto a los gráficos para no alterar los ejes ni las escalas.
- **Sin migración**: `storyPoints Int?` ya es nullable; el rollback es revertir los archivos de
  frontend y `metrics.ts`.

## Migration Plan

Sin migraciones de datos ni de esquema. Despliegue normal del bundle de frontend y del servidor.
Rollback: revertir los cambios en `UserStories.tsx`, `ProjectDetail.tsx`, `Reports.tsx` y
`metrics.ts` (y sus tests).

## Open Questions

- ¿Se quiere, en un change posterior, permitir editar los puntos de una historia ya creada en lugar
  de borrar y recrear? Queda fuera de este alcance.
