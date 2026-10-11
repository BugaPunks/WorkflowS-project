# AGENTS.md

Guía para cualquier agente de IA que revise o modifique **WorkflowS-project**.

Este archivo describe el proyecto, sus comandos y, sobre todo, **cómo trabajar con OpenSpec**:
las skills disponibles y cómo debe comportarse el agente con cada comando.

> Si vas a implementar o proponer un cambio funcional, **el flujo obligatorio es OpenSpec**.
> No empieces a escribir código sin un change propuesto y aprobado.

---

## 1. Qué es este proyecto

Plataforma web para la gestión de proyectos académicos bajo metodología **Scrum**
(usuarios/roles, proyectos, historias de usuario, sprints, tareas/Kanban, métricas,
evaluación, notificaciones, exportación).

### Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 19 + TypeScript + React Router 7 |
| Build | Rsbuild (`@rsbuild/core`, plugin React) |
| Estilos | Tailwind CSS 4 (`@tailwindcss/postcss`), `clsx`, `tailwind-merge` |
| Gráficos | Recharts |
| Drag & drop | `@hello-pangea/dnd` |
| Backend | Express 5 (`src/server/`) |
| ORM / DB | Prisma 7 + SQLite (dev) / PostgreSQL (`@prisma/adapter-better-sqlite3`, `@prisma/adapter-pg`) |
| Auth | JWT (`jsonwebtoken`) en cookie HttpOnly + `bcryptjs` |
| Validación | `zod` |
| Lint/Format | Biome |
| Tests unit/integration | Vitest |
| Tests E2E | Playwright |

### Convenciones

- **Idioma**: el proyecto y su documentación están en **español**. Mantén mensajes de UI,
  specs y descripciones en español. El código (nombres de variables, funciones, tipos) en inglés.
- **Estilo**: Biome con tabs. Ejecuta `npm run check:fix` / `npm run format` antes de cerrar.
- **Rutas de código**:
  - `src/api/` → cliente HTTP del frontend (`client.ts`).
  - `src/server/routes/` → endpoints Express (cada ruta suele tener un `*.test.ts` hermano).
  - `src/pages/` → páginas. `src/components/`, `src/islands/`, `src/hooks/`, `src/lib/`.
  - `prisma/schema.prisma` → modelo de datos.
  - `e2e/` → pruebas Playwright.
- **Tests**: cada endpoint nuevo o modificado debe acompañarse de tests (patrón
  `vi.hoisted` + mock de Prisma en `src/server/routes/*.test.ts`). No cierres una tarea
  sin dejar `npm run test` en verde.
- **No rompas la cadena de calidad**: `npm run check`, `npx tsc --noEmit` y los tests
  deben pasar antes de dar por completada una tarea.

---

## 2. Comandos del proyecto

### Desarrollo

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Servidor de desarrollo del frontend (Rsbuild, abre el navegador) |
| `npm run dev:server` | Servidor Express (`tsx src/server/index.ts`) |
| `npm run dev:all` | Frontend + backend a la vez |
| `npm run build` | Build de producción |
| `npm run preview` | Previsualiza el build de producción |

### Base de datos (Prisma)

| Comando | Qué hace |
|---------|----------|
| `npm run migrate:dev` | Crea/aplica migraciones en desarrollo |
| `npm run migrate:prod` | Aplica migraciones en producción |
| `npm run prisma:studio` | Abre Prisma Studio |
| `npm run switch-db` | Alterna SQLite/PostgreSQL (Windows `.cmd`) |
| `npm run switch-db:sh` | Alterna SQLite/PostgreSQL (bash) |
| `npx prisma generate` | Regenera el cliente Prisma tras editar el schema |

### Calidad y pruebas

| Comando | Qué hace |
|---------|----------|
| `npm run lint` / `npm run check` | Biome (lint + formato, sin escribir) |
| `npm run check:fix` | Biome y aplica correcciones |
| `npm run format` | Formatea con Biome |
| `npm run test` / `npm run test:unit` | Vitest (excluye `e2e`) |
| `npm run test:unit:watch` | Vitest en modo watch |
| `npx tsc --noEmit` | Comprobación de tipos |
| `npm run e2e` | Playwright |
| `openspec validate --all` | Valida specs y changes de OpenSpec |

---

## 3. OpenSpec: sistema de cambios spec-driven

OpenSpec es la fuente de verdad del "qué" y el "por qué" del proyecto. Todo cambio
funcional pasa por él: se **propone**, se **implementa** y se **archiva**.

### Estructura de `openspec/`

```
openspec/
├─ config.yaml                     # schema: spec-driven + contexto/reglas opcionales
├─ specs/                          # Especificaciones VIVAS (una carpeta por capability)
│  └─ <capability>/spec.md         #   Requisitos + escenarios, ya sincronizados
└─ changes/
   ├─ <change-activo>/             # Cambio en curso (proposal, design, tasks, specs/)
   │  ├─ proposal.md               #   Qué y por qué
   │  ├─ design.md                 #   Cómo (decisiones técnicas)
   │  ├─ tasks.md                  #   Checklist de implementación (- [ ] / - [x])
   │  └─ specs/<capability>/spec.md#   Delta de spec (ADDED/MODIFIED/REMOVED)
   └─ archive/
      └─ YYYY-MM-DD-<change>/      # Cambios ya cerrados (nombre con fecha)
```

- **Capabilities** existentes (ejemplos): `user-auth`, `user-registration`,
  `user-story-management`, `sprint-lifecycle`, `task-management`, `role-dashboard`,
  `metrics-computation`, `api-rate-limiting`, `data-export`, etc.
- Los **deltas** en `changes/<change>/specs/` usan encabezados como
  `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`.
- Las **specs vivas** en `openspec/specs/` no se editan a mano durante el trabajo;
  se actualizan al **archivar** (sync de delta → spec principal).

### Skills de OpenSpec disponibles

| Skill | Para qué sirve | Comando asociado |
|-------|----------------|------------------|
| `openspec-explore` | Pensar/explorar sin implementar (ni código ni features) | `/opsx-explore` |
| `openspec-propose` | Crear un change con todos sus artefactos | `/opsx-propose` |
| `openspec-apply-change` | Implementar las tareas del change | `/opsx-apply` |
| `openspec-archive-change` | Archivar un change ya completado | `/opsx-archive` |

### Dónde están las skills (instrucciones completas)

Cada skill vive en **`SKILL.md`** y contiene el flujo detallado. **Antes de ejecutar un
comando, lee el `SKILL.md` correspondiente en `.agent/`** para conocer las instrucciones a
profundidad (no te quedes solo con el resumen de la sección 4):

```
.agent/
├─ skills/
│  ├─ openspec-explore/SKILL.md
│  ├─ openspec-propose/SKILL.md
│  ├─ openspec-apply-change/SKILL.md
│  └─ openspec-archive-change/SKILL.md
└─ workflows/
   ├─ opsx-explore.md
   ├─ opsx-propose.md
   ├─ opsx-apply.md
   └─ opsx-archive.md
```

- **`.agent/skills/<skill>/SKILL.md`** → instrucciones canónicas de cada skill
  (`openspec-explore`, `openspec-propose`, `openspec-apply-change`, `openspec-archive-change`).
- **`.agent/workflows/opsx-*.md`** → definición de los slash-commands `/opsx-*`
  (el prompt que se dispara al invocarlos).

> **`.agent/` es la única carpeta de skills versionada.** Las copias para otras herramientas
> están en `.gitignore` y no deben usarse como referencia.

### CLI de OpenSpec

Comandos que el agente debe usar como fuente de verdad (no asumas rutas ni estados):

```bash
openspec list --json                          # changes activos
openspec status --change "<name>" --json      # artefactos, rutas y estado
openspec instructions <artifact> --change "<name>" --json   # guía para un artefacto
openspec instructions apply --change "<name>" --json        # contexto + progreso de tareas
openspec new change "<name>"                  # scaffolding de un change nuevo
openspec validate --all                       # valida todo
openspec archive <name>                       # (la skill hace el flujo guiado)
```

**Regla de oro**: usa `status --json` e `instructions --json` para descubrir rutas
(`planningHome`, `changeRoot`, `artifactPaths`, `actionContext`). **No hardcodees**
`openspec/changes/...`; respeta lo que devuelva el CLI.

---

## 4. Cómo actuar con cada comando

Esta sección es un **resumen**. La fuente de verdad son los `SKILL.md` en `.agent/skills/`
y los workflows en `.agent/workflows/`. **Lee el archivo correspondiente antes de actuar**:

| Comando | Leer instrucciones completas en |
|---------|---------------------------------|
| `/opsx-explore` | `.agent/skills/openspec-explore/SKILL.md` + `.agent/workflows/opsx-explore.md` |
| `/opsx-propose` | `.agent/skills/openspec-propose/SKILL.md` + `.agent/workflows/opsx-propose.md` |
| `/opsx-apply` | `.agent/skills/openspec-apply-change/SKILL.md` + `.agent/workflows/opsx-apply.md` |
| `/opsx-archive` | `.agent/skills/openspec-archive-change/SKILL.md` + `.agent/workflows/opsx-archive.md` |

**Paso 0 en todos los casos**: identifica el change con `openspec list --json`
(o infiere del contexto y confirma). Nunca adivines ni auto-selecciones si hay ambigüedad.

### `/opsx-explore` — Modo exploración (pensar, NO implementar)

**Cuándo**: el usuario quiere pensar una idea, investigar un problema, comparar
opciones o aclarar requisitos, antes o durante un change.

**Qué hacer**:
- Se un **compañero de pensamiento**: curiosidad, preguntas que emergen solas,
  diagramas ASCII, comparaciones, riesgos y supuestos.
- Puedes **leer** el código y el repo con libertad para aterrizar la discusión.
- Puedes **crear/actualizar artefactos OpenSpec** (proposal, design, specs) si el usuario
  lo pide; eso es capturar pensamiento.
- Contrasta siempre contra `openspec/specs/` y los artefactos del change activo.

**Qué NO hacer** (guardrails):
- **Nunca escribir código de aplicación ni implementar features.** Si el usuario pide
  implementar, recuérdale salir de explore y proponer un change.
- No forzar estructura, no interrogar, no auto-capturar insights: **ofrece** capturarlos.
- No inventar: si algo no está claro, investiga el código.

### `/opsx-propose` — Proponer un change nuevo

**Cuándo**: el usuario describe algo que quiere construir o arreglar y hay que dejarlo
listo para implementar.

**Qué hacer**:
1. Si no hay input, **pregunta** qué quiere construir (no avances sin entenderlo).
   Deriva un nombre en kebab-case (ej. "add user auth" → `add-user-auth`).
2. Crea el change: `openspec new change "<name>"`.
3. Descubre el orden de artefactos: `openspec status --change "<name>" --json`
   (mira `applyRequires`, `artifacts`, dependencias y rutas).
4. Para cada artefacto `ready`, en orden de dependencias:
   - `openspec instructions <artifact-id> --change "<name>" --json`.
   - Usa el `template` como estructura y escribe en `resolvedOutputPath`.
   - Aplica `context` y `rules` como **restricciones**; **no los copies** al archivo.
   - Lee los artefactos de los que depende antes de escribir.
   - Muestra "Created <artifact-id>".
5. Repite hasta que todo `applyRequires` esté `done`.
6. Muestra `openspec status --change "<name>"` y cierra con:
   "Todo listo. Ejecuta `/opsx-apply` para implementar."

**Guardrails**: crea **todos** los artefactos requeridos; si el contexto es crítico y
ambiguo, pregunta; si el change ya existe, pregunta si continuar o crear otro; verifica
que cada archivo exista tras escribirlo.

### `/opsx-apply` — Implementar las tareas

**Cuándo**: empezar, continuar o terminar tareas de un change.

**Qué hacer**:
1. Selecciona el change (nombre, contexto, o único activo; si hay duda, pregunta).
   Anuncia: "Using change: <name>" y cómo cambiarlo.
2. Lee el estado: `openspec status --change "<name>" --json`.
3. Pide instrucciones: `openspec instructions apply --change "<name>" --json`
   (devuelve `contextFiles`, progreso y lista de tareas).
   - `state: "blocked"` → faltan artefactos, avisa y sugiere continuar la propuesta.
   - `state: "all_done"` → felicita y sugiere archivar.
4. **Lee todos los `contextFiles`** (proposal, specs, design, tasks) antes de tocar código.
5. Muestra progreso "N/M tasks complete" y el resumen pendiente.
6. Implementa tarea por tarea:
   - Anuncia cuál trabajas, aplica cambios **mínimos y enfocados**, y marca
     inmediatamente en `tasks.md`: `- [ ]` → `- [x]`.
   - **Pausa y pregunta** si: la tarea es ambigua, aparece un problema de diseño
     (sugiere actualizar artefactos), hay un error/bloqueo, o el usuario interrumpe.
   - No adivines ni inventes requisitos.
7. Al terminar o pausar, muestra el estado (completadas en la sesión, N/M, siguiente paso).

**Guardrails**: no asumas nombres de archivo, usa los `contextFiles` del CLI; mantén el
alcance por tarea; actualiza el checkbox al terminar cada tarea; deja los checks de calidad
(`npm run check`, `npx tsc --noEmit`, `npm run test`) en verde.

### `/opsx-archive` — Archivar un change completado

**Cuándo**: el change está terminado (o el usuario decide cerrarlo).

**Qué hacer**:
1. Si no hay nombre, **pregunta** cuál archivar (solo changes activos). **No adivines.**
2. Estado: `openspec status --change "<name>" --json`.
   - Si hay artefactos no `done` → advierte y pide confirmación para continuar.
3. Revisa `tasks.md`: cuenta `- [ ]` vs `- [x]`. Si hay tareas abiertas → advierte y
   pide confirmación. Si no existe `tasks.md`, continúa sin ese aviso.
4. **Sync de deltas**: con `artifactPaths.specs.existingOutputPaths`, compara cada
   delta con `openspec/specs/<capability>/spec.md`, resume los cambios y pregunta:
   "Sync now (recommended)" / "Archive without syncing". Si sincroniza, usa la skill
   `openspec-sync-specs` (vía subagente). Archiva igualmente, cualquiera sea la elección.
5. Mueve el change creando `archive/` si falta y usando `YYYY-MM-DD-<name>`:
   ```bash
   mv "<changeRoot>" "<changesDir>/archive/YYYY-MM-DD-<name>"
   ```
   Si el destino ya existe, **falla** e informa (renombrar, borrar duplicado o esperar).
6. Muestra el resumen: change, schema, ubicación del archivo, estado del sync y avisos.

**Guardrails**: preserva los archivos del change (incl. metadatos) al mover; los avisos
no deben bloquear; si hay deltas, **siempre** corre la evaluación de sync y muestra el
resumen combinado antes de preguntar.

---

## 5. Flujo recomendado de trabajo

```
Idea / problema
   │
   ▼
/opsx-explore   ──► (opcional) pensar, investigar, comparar, decidir
   │
   ▼
/opsx-propose   ──► crea change + proposal.md + design.md + tasks.md (+ deltas de specs)
   │
   ▼
/opsx-apply     ──► implementa tareas, marca checkboxes, tests en verde
   │
   ▼
/opsx-archive   ──► sincroniza deltas a openspec/specs/ y mueve a changes/archive/
```

### Reglas transversales

1. **OpenSpec manda**: descubre siempre rutas y estados con el CLI (`--json`),
   no asumas estructura ni contenido.
2. **No implementes sin change**: explorar ≠ implementar. La implementación vive en `/opsx-apply`.
3. **Specs vivas**: no edites `openspec/specs/**` durante el trabajo; se actualizan al archivar.
4. **Deltas bien formados**: usa `## ADDED|MODIFIED|REMOVED Requirements` con
   `### Requirement:` y escenarios `#### Scenario:` (con **WHEN**/**THEN**).
5. **Trazabilidad**: `proposal` (qué/por qué) → `design` (cómo) → `tasks` (pasos) → specs (contrato).
6. **Calidad**: antes de cerrar cualquier tarea, `npm run check`, `npx tsc --noEmit` y
   `npm run test` deben pasar. Para cambios de UI, considerar `npm run e2e`.
7. **Idioma**: escribe specs y mensajes en español; el código en inglés.
8. **Cambios mínimos y enfocados**: una tarea a la vez; no refactorices oportunistamente
   salvo que la tarea lo pida.
