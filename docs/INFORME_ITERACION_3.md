# Informe de Iteración 3 — Cumplimiento HU-08/09/10 y Estado de la Suite E2E

**Fecha:** 3/10/2026
**Alcance:** verificación de los criterios de aceptación de RF8, RF9 y HU-10, y auditoría/corregición de la suite Playwright.
**Método:** lectura de código fuente + verificación empírica contra la API y la UI en ejecución.

---

## 1. Resumen ejecutivo

| Ámbito | Criterio | Estado |
|---|---|---|
| Story Points | RF8 (asignar y visualizar puntos) | ❌ **NO CUMPLE** en la UI |
| Velocity | RF9.1 / RF9.2 | ✅ Cumple |
| Burndown en calificaciones | RF9.3 | ❌ **NO CUMPLE** (placeholder) |
| Dashboard por rol | HU-10 | ⚠️ **PARCIAL** (split visual, sin datos) |
| Control de acceso por rol | RNF3.2 | ❌ **NO CUMPLE** |
| Suite E2E | 44 tests | ✅ **44/44 verde** (3 ejecuciones seguidas) |

> **Corrección respecto al análisis previo:** se corrige la conclusión sobre RF8. La verificación con `Select-String` sobre todo `src/` demuestra que **no existe ningún campo de entrada, formulario ni modal para asignar Story Points**. La UI solo los muestra. El detalle está en §2.1.

---

## 2. Cumplimiento por criterio

### 2.1 RF8 — Story Points (HU-08) — ❌ NO CUMPLE

**Lo que sí existe**

- El modelo de datos soporta el campo: `UserStory.storyPoints Int?` (`prisma/schema.prisma`).
- La API acepta el valor en creación y actualización:
  - `src/server/routes/user-stories.ts:17` → `storyPoints: z.number().optional()` (create)
  - `src/server/routes/user-stories.ts:26` → `storyPoints: z.number().optional()` (update)
  - `src/server/routes/user-stories.ts:102,146` → se persiste solo si viene definido.
- La UI **muestra** el valor en la tarjeta de la historia:
  - `src/pages/ProjectDetail.tsx:1074-1076` → `{story.storyPoints} pts`
  - `src/pages/ProjectDetail.tsx:1178-1180` → valor numérico junto a la historia.

**Lo que falta**

| Requisito | Estado | Evidencia |
|---|---|---|
| RF8.1 Visible en la tarjeta de la historia | ✅ | `ProjectDetail.tsx:1076` |
| RF8.2 Total de Story Points del sprint/proyecto | ⚠️ Solo en Reportes | `src/pages/Reports.tsx:230` muestra `totalPoints`; el backlog no muestra total |
| RF8.3 El desarrollador puede añadir/modificar puntos | ❌ | No hay input ni modal. Búsqueda exhaustiva: las únicas apariciones de `points` en todo `src/` son `storyPoints` (solo lectura), `totalPoints`, `committed`, `velocityData` y `burndownData` |
| RF8.4 Endpoint dedicado de asignación | ❌ | No existe `PATCH /api/projects/:id/story-points` ni equivalente |

**Bug adicional detectado:** el renderizado usa `{story.storyPoints && (...)}`. Al ser un chequeo de veracidad, una historia con **0 puntos no muestra el valor**, lo cual es inconsistente con el significado de "0 = sin estimar".

**Conclusión:** el dato existe de extremo a extremo en la API pero **la capacidad de asignarlo es exclusivamente por API**. Un usuario de la aplicación no puede cumplir RF8.

---

### 2.2 RF9.1 / RF9.2 — Velocity (HU-09) — ✅ CUMPLE

- `GET /api/metrics/projects/:projectId/velocity` (`src/server/routes/metrics.ts:140-177`):
  - `committed` = suma de `storyPoints` de **todas** las historias del sprint (`metrics.ts:156-159`).
  - `completed` = suma de `storyPoints` de las historias con `completedAt !== null` (`metrics.ts:160-162`).
  - Un punto de datos por sprint, ordenado por `startDate` ascendente (`metrics.ts:147-153`).
- Renderizado: `src/pages/Reports.tsx:199-217` (`BarChart` con `committed` vs `completed`).
- Enlace de acceso: `src/islands/ProductOwnerWelcomeOptions.tsx:52`.

La definición usada es coherente con Scrum (puntos comprometidos vs. puntos entregados).

---

### 2.3 RF9.3 — Burn-down en la vista de calificaciones — ❌ NO CUMPLE

El burn-down **existe y funciona**, pero no en la vista de calificaciones:

- Endpoint: `GET /api/metrics/sprints/:sprintId/burndown` (`src/server/routes/metrics.ts:17-88`).
- Gráfico: `src/pages/Reports.tsx:222-263` (`ComposedChart` con series `ideal` y `actual`).

**La vista de calificaciones no lo muestra.** En `src/pages/GradingView.tsx:314-322` hay únicamente un bloque de texto estático:

> "Aquí se mostraría un resumen automático del {Sprint|Proyecto} (User Stories completadas, Velocity, Burn-down chart, etc.) para apoyar la evaluación."

No hay `recharts`, ni petición a `/api/metrics/*`, ni render de serie alguna en ese componente. Es un placeholder que describe la funcionalidad pendiente.

**Conclusión:** RF9.3 no está implementado.

**Fórmula del burn-down (nota para futuros tests)** — `metrics.ts:46-70`:

```ts
daysDiff       = ceil((endDate - startDate) / 86400000)
idealDecrement = totalPoints / daysDiff
ideal(day i)   = max(0, totalPoints - idealDecrement * i)   // i ∈ [0, daysDiff]
actual(day i)  = totalPoints - Σ puntos(completadas con completedAt <= fecha_i)
```

La serie tiene `daysDiff + 1` puntos y la línea ideal llega exactamente a `0` en el último día, sea cual sea la duración. `actual` se devuelve como `null` para fechas futuras (`metrics.ts:72,78`), por lo que un sprint en curso muestra la línea real truncada al día actual.

---

### 2.4 HU-10 — Dashboard personalizado por rol — ⚠️ PARCIAL

**Lo que existe** — `src/pages/Dashboard.tsx:21-25`:

| Rol | Componente | Heading |
|---|---|---|
| `ADMIN` | `TeacherDashboard` | "Panel de Docente" |
| Resto | `StudentDashboard` → `TeamDeveloperWelcomeOptions` | "Panel de Desarrollador" |

**Lo que falta:** el dashboard es ** puramente estático**. No hay ninguna llamada a la API ni lectura de `localStorage` para proyectos activos, tareas pendientes o fechas de vencimiento. Tampoco hay opciones para configurar qué módulos mostrar; el menú es fijo por rol (`ProductOwnerWelcomeOptions.tsx:52-53`, `TeamDeveloperWelcomeOptions.tsx`).

Es decir: cumple el "diseño diferente según el rol", no el "dashboard con la información del usuario".

---

### 2.5 RNF3.2 — Restricción de acceso por rol — ❌ NO CUMPLE

`/evaluations` está declarado como ruta protegida en `src/App.tsx:61`, dentro del `DashboardLayout`, pero **no hay verificación de rol**: cualquier usuario autenticado alcanza el módulo de calificaciones.

Endpoint relacionado: `GET /api/metrics/projects/:projectId/contribution` (`src/server/routes/metrics.ts:90`) — el comentario de la ruta indica `any authenticated` y devuelve la distribución de tareas completadas por miembro del equipo, es decir, datos que deberían restringirse al docente.

Esto es consistente con que E2E test passes: el estudiante sí ve Evaluations hoy.

---

## 3. Bugs de producto encontrados (NO corregidos)

| # | Severidad | Ubicación | Descripción |
|---|---|---|---|
| BUG-1 | 🔴 Alta | `src/server/routes/user-stories.ts:10-18` | `description` es `z.string().optional()` en el esquema Zod, pero en `prisma/schema.prisma` el campo es obligatorio (`String`). `POST /api/user-stories` sin `description` pasa la validación y revienta con **HTTP 500** en lugar de 400. Los tests E2E lo esquivan enviando siempre `description`; el bug sigue latente en la API pública. |
| BUG-2 | 🔴 Alta | RF8.3 | No existe interfaz para asignar Story Points (§2.1). |
| BUG-3 | 🟠 Media | `src/pages/GradingView.tsx:314-322` | Placeholder de métricas en la vista de calificaciones (§2.3). |
| BUG-4 | 🟠 Media | `src/pages/ProjectDetail.tsx:1074,1178` | `{story.storyPoints && ...}` oculta el valor `0`. |
| BUG-5 | 🟠 Media | `src/App.tsx:61` + `metrics.ts:90` | `/evaluations` y `/contribution` sin restricción de rol (§2.5). |

---

## 4. Estado de la suite E2E

### 4.1 Correcciones aplicadas

| Archivo | Problema original | Corrección |
|---|---|---|
| `e2e/metrics.spec.ts` | `POST /api/projects` sin `ownerId` → 400; el test continuaba sin dueño y los follow-ups fallaban | Se envía `ownerId` del usuario autenticado; se verifica el código HTTP (201) antes de continuar |
| `e2e/metrics.spec.ts` | Selector `nth(1)` frágil sobre la tabla de historias | Selector por texto de la historia |
| `e2e/metrics.spec.ts` | Fechas de sprint hardcodeadas ya vencidas → serie `actual` nula | Fechas calculadas respecto a hoy, con duración explícita |
| `e2e/metrics.spec.ts` | Aserciones sobre elementos inexistentes | Reescrito con 2 tests: `MET-01` (matemática del burn-down vía API) y `MET-02` (render de burn-down, velocity y contribución en `/reports`) |
| `e2e/notifications.spec.ts` | Aserciones comentadas; el test no verificaba nada del panel | Reescrito: crea tarea vía API, comprueba la notificación `TASK_ASSIGNED`, el badge, el decremento de "No leído" y la persistencia de `read: true` tras recargar |
| `e2e/dashboards.spec.ts` | Test titulado `Student SHOULD see Evaluations` afirmaba un requisito que el producto **no** cumple; logs de `pageerror`/`console` sin filtrar | 4 tests que validan el split real por rol (`Panel de Docente` vs `Panel de Desarrollador`), `SCRUM_MASTER`, y el acceso a `Mis Calificaciones`. Logs eliminados |

**Nota sobre `MET-01`:** al no existir UI para asignar puntos (§2.1), el test siembra los Story Points por API. Esto significa que **la suite E2E no puede detectar el BUG-2**: el hueco de la UI queda fuera de toda cobertura automatizada.

### 4.2 Test intermitente `ECONNRESET` — ✅ Corregido

**Síntoma:** `e2e/grading.spec.ts:20` fallaba con `apiRequestContext.post: read ECONNRESET` en 2 de 4 ejecuciones completas de la suite, pero pasaba 5/5 al ejecutarse aislado.

**Causa:** Node cierra las conexiones keep-alive a los **5 s** por defecto (`server.keepAliveTimeout`). El `APIRequestContext` de Playwright reutiliza el socket entre peticiones; si la siguiente petición llega después de ese plazo, la escritura falla con `ECONNRESET`. Al ejecutarse aislado el ritmo es menor y la condición no se da.

**Corrección** — `src/server/index.ts`, tras `app.listen`:

```ts
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
```

**Resultado:** 3 ejecuciones completas consecutivas de los 44 tests sin ningún fallo (antes: 2 de 4 con fallo).

### 4.3 Resultado final

```
npx playwright test
  → 44 passed (4.1m)
  → 44 passed (3.9m)
  → 44 passed (4.1m)
```

| Métrica | Valor |
|---|---|
| Total de tests | 44 |
| Pass | 44 |
| Fail | 0 |
| Flaky | 0 |
| Skip | 0 |

---

## 5. Riesgos residuales y recomendaciones

1. **Cobertura de la UI de Story Points (ALTA).** No hay ninguna prueba, y no puede haberla mientras la UI no exista. Al implementar RF8.3 hay que añadir el test E2E del flujo completo.
2. **E2E fuera del linter (MEDIA).** `biome.json` solo incluye `src/**` y ficheros raíz; `npx biome check e2e/metrics.spec.ts` responde `No files were processed`. Los tests no se formatean ni validan en CI.
3. **Sin framework de tests unitarios (MEDIA).** No hay Vitest/Jest. La matemática de las métricas (`idealDecrement`, `burnedSoFar`) está verificada solo a través de la API dentro de un test E2E; un test unitario aislaría esa lógica en milisegundos.
4. **Config contradictoria de Playwright (BAJA).** `playwright.config.ts` declara `fullyParallel: true` con `workers: 1`, y los tests comparten `dev.db` sin aislamiento. Con `workers > 1` la suite sería inestable por colisión de datos.
5. **Pollution de `dev.db` (MEDIA).** La suite crea usuarios y proyectos reales en la base de desarrollo en cada ejecución y no los limpia.

### Plan de trabajo sugerido

**Iteración 4 — Cerrar los requisitos faltantes**

1. Implementar RF8.3 (modal de Story Points) + endpoint y corregir el render de `0`.
2. Implementar RF9.3 (resumen de métricas real en `GradingView`).
3. Corregir BUG-1 (`description` → `z.string().min(1)`).
4. Restringir `/evaluations` y `/contribution` por rol (RNF3.2).
5. Añadir tests E2E de 1 y 2; mover las fórmulas de métricas a unit tests.
6. Incluir `e2e/**` en `biome.json`.

---

*Informe generado por verificación de código y ejecución real de la suite. Las cifras provienen de ejecuciones de `npx playwright test` sobre `dev.db`.*