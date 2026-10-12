# AGENTS.md

Guía breve para agentes de IA que revisan o modifican **WorkflowS-project**.

Plataforma web de gestión de proyectos académicos con metodología **Scrum**: usuarios/roles,
proyectos, historias de usuario, sprints, tareas (Kanban), métricas, evaluación,
notificaciones y exportación.

> Todo cambio funcional sigue el flujo **OpenSpec**: proponer → implementar → archivar.
> No empieces a escribir código sin un change propuesto.

## 0. Agentes autónomos (Google Jules / Gemini / CI / background)

Si eres **Jules**, **Gemini** o cualquier agente **desatendido** (no hay una persona
respondiendo en el momento):

1. **No preguntes al usuario.** Nunca cierres un turno esperando confirmación.
2. **Apégate al change de OpenSpec activo o disponible**: lo que devuelve `openspec list`
   o un change en `openspec/changes/<change>/` listo para aplicar. **Nunca** tomes como
   fuente de trabajo lo que está en `openspec/changes/archive/` (es historial).
3. Ante ambigüedad o errores: elige la opción más conservadora, impleméntala y regístrala en
   `openspec/changes/<change>/decisions.md`; continúa sin bloquear la sesión.
4. Detente **solo** ante acciones irreversibles o fuera de alcance: borrado masivo,
   migraciones destructivas (`migrate reset`, `DROP`), tocar `.env`/secretos,
   `git push` / `reset --hard`, publicar en `main`/`master`. En ese caso no lo hagas y
   déjalo anotado.

En modo **interactivo** (con una persona delante) sí puedes preguntar cuando aporte.

## 1. OpenSpec: skills y flujo

Fuente de verdad del "qué" y el "por qué". Estructura:

- `openspec/specs/<capability>/spec.md` → specs vivas (no se editan a mano; se sincronizan al archivar).
- `openspec/changes/<change>/` → change activo (proposal, design, tasks, specs/ delta).
- `openspec/changes/archive/YYYY-MM-DD-<change>/` → changes cerrados (solo referencia histórica).

Skills (instrucciones completas en `.agent/skills/<skill>/SKILL.md`; slash-commands en
`.agent/workflows/opsx-*.md`):

| Skill | Para qué | Comando |
|---|---|---|
| `openspec-explore` | Pensar/explorar sin implementar (ni código ni features) | `/opsx-explore` |
| `openspec-propose` | Crear un change con todos sus artefactos | `/opsx-propose` |
| `openspec-apply-change` | Implementar las tareas del change | `/opsx-apply` |
| `openspec-archive-change` | Archivar un change completado | `/opsx-archive` |

Flujo: `explore` (opcional) → `propose` → `apply` → `archive`.

CLI (usa `--json` para descubrir rutas y estado; no hardcodees `openspec/changes/...`):

```bash
openspec list --json
openspec status --change "<name>" --json
openspec instructions <artifact> --change "<name>" --json
openspec new change "<name>"
openspec validate --all
openspec archive <name>
```

Deltas de specs: `## ADDED|MODIFIED|REMOVED Requirements` con `### Requirement:` y
`#### Scenario:` (WHEN/THEN).

## 2. Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` / `npm run dev:server` / `npm run dev:all` | frontend / backend / ambos |
| `npm run build` / `npm run preview` | build / preview |
| `npm run migrate:dev` / `npm run migrate:prod` | migraciones Prisma |
| `npm run check` / `npm run check:fix` / `npm run format` | Biome |
| `npm run test` | Vitest (excluye `e2e`) |
| `npx tsc --noEmit` | comprobación de tipos |
| `npm run e2e` | Playwright |
| `openspec validate --all` | valida specs y changes |

## 3. Convenciones y calidad

- **Idioma**: UI, specs y documentación en **español**; código (variables, funciones, tipos)
  en **inglés**.
- **Estilo**: Biome con tabs.
- **Rutas**: `src/api/` cliente HTTP; `src/server/routes/` endpoints Express (con su
  `*.test.ts` hermano); `src/pages/`, `src/components/`, `src/islands/`, `src/hooks/`;
  `prisma/schema.prisma`; `e2e/`.
- **Tests**: cada endpoint nuevo o modificado lleva test. No cierres una tarea sin
  `npm run test` en verde.
- **Calidad**: antes de dar por completada una tarea, `npm run check`, `npx tsc --noEmit` y
  `npm run test` deben pasar.
- **Stack**: React 19 + TypeScript + React Router 7 + Rsbuild + Tailwind 4; Express 5;
  Prisma 7 (SQLite dev / PostgreSQL); JWT + bcryptjs; zod; Biome; Vitest; Playwright.
- **Botones**: `<button>`/`<Button>` siempre con `type` explícito (`type="button"` para
  acciones, `type="submit"` solo para enviar formulario). Sin `type` el botón se comporta
  como `submit` y puede recargar la página; Biome lo exige.
