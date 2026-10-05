## Context

`GET /api/metrics/export/projects/:projectId` (`src/server/routes/metrics.ts:105-155`) nació en la Iteración 3 como endpoint auxiliar de HU-08 y es hoy la implementación de HU-14. Hoy combina tres responsabilidades en un solo archivo: consulta a Prisma, construcción del CSV y escritura de la respuesta HTTP. El armado del archivo está acoplado a la forma exacta de la consulta (`sprints → tasks → assignee`), lo que hace imposible probar el escapado sin levantar servidor y base de datos, y por eso hoy no hay ninguna prueba unitaria de la parte del proyecto que más se audita externamente.

La suite del proyecto es Playwright (`e2e/`, 25 specs, 48 tests, `workers: 1` sobre un `dev.db` compartido) más un único archivo de unitarios con Vitest (`src/server/lib/metrics.test.ts`). El precedente de extraer la matemática a funciones puras verificables sin servidor es de la Iteración 3 (`openspec/specs/metrics-computation`), y es el patrón que sigue la documentación del propio proyecto.

Restricciones que condicionan el diseño:

- El build es un artefacto que se quiere cerrar: **no se añaden dependencias de producción**. Una librería de CSV sería la opción obvia, pero abre superficie en la última iteración.
- La cabecera del CSV y el nombre de archivo están fijados por el documento de la iteración (§5.b Tabla 28 y §5.d): `Sprint,Tarea,Asignado,Estado,Prioridad,Puntos` y `project-{projectId}-report.csv`. Son contrato con el entregable, no decisiones libres.
- El cambio agreed no toca despliegue, así que el "arranque DEV/PROD" se limita a lo que el proceso de Node puede hacer por sí solo.

## Goals / Non-Goals

**Goals:**

- Que cualquier contenido de tarea, sprint o responsable produzca filas con exactamente 6 columnas parseables.
- Poder verificar el formato del CSV con tests unitarios, sin servidor ni base de datos.
- Cubrir el criterio de aceptación de HU-14 (filtrar la exportación) sin romper el comportamiento actual sin filtros.
- Eliminar la carga del hash bcrypt en la consulta de exportación.
- Que `/reports` y la exportación tengan la misma autorización, y que no haya enlaces a vistas inaccesibles.
- Que el servidor diga en qué entorno arranca y falle rápido si la configuración de producción es insuficiente.
- Que la suite completa sea lanzable con un comando documentado y que no queden `console.log` de desarrollo.

**Non-Goals:**

- Arquitectura de despliegue (Nginx, archivos estáticos, PM2/systemd, Docker, `.env.production`).
- PDF y Excel. §5.a del documento prioriza CSV sobre ellos; siguen siendo diseño conceptual de plantillas.
- Migrar el modelo de datos a PostgreSQL ni cambiar el driver.
- Los enlaces muertos a `/reports/dashboard`, `/reports/performance` y `/reports/sprints` de `AdminWelcomeOptions.tsx`: rutas que nunca existieron, ajenas a HU-14.
- Sustituir el `<a>` por un endpoint de descarga POST o por streaming.

## Decisions

### D1. Módulo puro `src/server/lib/csv.ts` en lugar de una librería

Se extraen dos funciones sin dependencias de Prisma ni Express:

- `escapeCsvCell(value: string): string` — entrecomilla **todo** valor y duplica las comillas dobles internas. Si el valor ya venía entrecomillado parcialmente hoy, el problema desaparece porque la regla es uniforme.
- `buildProjectReportCsv(rows: ExportRow[]): string` — recibe una lista plana `{ sprint, title, assignee, status, priority }` y devuelve el archivo completo.

`buildProjectReportCsv` recibe filas **ya aplanadas**, no la estructura anidada de Prisma. Así el módulo no necesita saber nada de `sprints.tasks.assignee` y el aplanado (con su `Sin asignar` y su `N/A`) queda en la ruta, donde sí pertenece.

*Alternativa descartada:* `csv-stringify` / `papaparse`. Aportan escapado correcto y probado, pero es una dependencia de producción nueva en el build que se cierra, y su superficie (opciones de delimitador, quoting, BOM) es mayor que las 30 líneas que necesita este caso. Si el formato de exportación crece a múltiples archivos heterogéneos, la decisión se revisa.

*Alternativa descartada:* `res.attachment()` de Express. Solo resuelve el `Content-Disposition`, que ya está bien resuelto en la línea 145-148; no toca el cuerpo malformado.

### D2. Escapado uniforme y orden respecto a la protección anti-fórmula

El `sanitizeCsvCell` actual protege contra inyección de fórmulas CSV (`=`, `+`, `-`, `@`, tab, salto de línea al inicio). Esa protección se **conserva**, pero se aplica en dos pasos con un orden fijo:

1. Sanitización anti-fórmula (antigua): antepone `'` si el valor empieza por un carácter peligroso.
2. Escapado RFC 4180 (nuevo): entrecomilla y duplica comillas.

El orden importa: si se escapara primero, el `'` de la sanitización quedaría dentro de una celda ya cerrada y las dos transformaciones seguirían siendo correctas, pero invertirlo rompería la detección por prefijo. Se fija sanitize → escape y se cubre con test para que nadie lo invierta.

Una decisión deliberada: **una celda que empieza por `-` se sanitiza aunque sea un valor legítimo** (por ejemplo un título "- Revisar"). Es el precio de la protección contra fórmulas en hojas de cálculo y el criterio es conservador a propósito.

### D3. BOM UTF-8 en el archivo

El archivo se emite con `\uFEFF` al inicio. Sin BOM, Excel en Windows interpreta el CSV como ANSI y destroza las tildes y la `ñ` — precisamente el dato que el docente exporta para un informe oficial. El BOM no añade columnas ni altera el nombre del archivo.

Consecuencia asumida: el primer campo del archivo es el BOM seguido de `Sprint`. Los tests comparan la cabecera tras retirar el BOM, y el propio parser de los tests debe hacerlo. Se deja documentado en el spec para que un test futuro no falle por el byte extra.

### D4. Filtro por sprint como query param

`?sprintId=<id>` sobre la ruta existente, en lugar de un cuerpo POST o de rutas por recurso. Motivos:

- El endpoint ya es `GET` y ya devuelve `Content-Disposition: attachment`; un `POST` obligaría a la interfaz a hacer la descarga vía `fetch` + blob en lugar de una navegación directa, sin ganancia.
- Sin el parámetro, el comportamiento es byte a byte el actual: **no hay breaking change** para consumidores existentes.

Un `sprintId` que no pertenece al proyecto responde `400`, no `200` con un CSV vacío. Un `404` silencioso es indistinguible de "proyecto vacío" para quien exporta, y llevaría a entregar un informe incompleto creyendo que es el completo — el peor resultado posible en un uso de auditoría. La validación se hace en la consulta (`where: { id: sprintId, projectId }`) y se distingue `null` (no existe) de resultado sin filas.

### D5. `select` explícito en la consulta de exportación

La consulta pasa de `include` anidado a `select` de tres niveles: `sprints: { select: { name, tasks: { select: { title, status, priority, assignee: { select: { name } } } } } }`. Además de eliminar el hash bcrypt, fija el contrato: si mañana alguien añade una columna sensible a `User`, no entra en la exportación por accidente. Es el patrón que ya usa la ruta de contribución en `metrics.ts:64-67`.

### D6. Descarga por `fetch` + blob en lugar de `<a target="_blank">`

El enlace actual abre una pestaña nueva. Si el servidor responde 403, 404 o 500, el docente ve una pestaña en blanco o un JSON de error y no tiene ninguna señal de que la descarga falló. Con `fetch` + `blob` + `URL.createObjectURL` el error se puede mostrar en línea y el nombre de archivo se toma del `Content-Disposition`.

Coste: se pierde la descarga nativo del navegador sin JavaScript y el archivo pasa por memoria. Aceptable —el conjunto de datos es un proyecto con sprints y tareas, no un volcado de millones de filas— y el objeto `URL` se revoca en `finally` para no filtrar memoria.

El botón se deshabilita mientras no haya proyecto seleccionado, reflejando la condición que hoy ya gobierna su visibilidad.

### D7. Selector de sprint como mecanismo del criterio de aceptación

El criterio de HU-14 pide "filtrar y seleccionar qué datos específicos se desean exportar". Se implementa el filtro con un `<select>` de sprint con opción "Todos", alimentado por los sprints del proyecto que la página ya carga. Es la interpretación de menor coste que cumple el criterio: el docente puede acotar el informe a un sprint.

*Alternativa descartada:* checkboxes de columnas. Elegir libremente el esquema del CSV rompe la continuidad del entregable (la cabecera de la Tabla 28 es lo que el docente espera recibir) y haría que EXP-01 dependa de la selección. Se registra como posible evolución si HU-14 se reescribe.

### D8. `/reports` bajo `RequireSystemRole`, con reparación de enlaces

La ruta entra en el bloque `RequireSystemRole allowedRole="ADMIN"` que ya existe en `App.tsx:72-74`. Es coherente con el endpoint, que ya exige ADMIN, y con el requisito vigente de `role-dashboard`.

Consecuencia inevitable: los tres lugares que enlazan a `/reports` para roles no ADMIN pasan a ser enlaces muertos. Se reparan en el mismo change:

- `NavigationSidebar.tsx:45` — se elimina "Reportes" de `STUDENT_MENU`. El caso `DASH-01` de `e2e/dashboards.spec.ts:33` usa sesión ADMIN y sigue viendo el enlace, por lo que no requiere cambio.
- `ProductOwnerWelcomeOptions.tsx:95` — el enlace del docente deja de resolver; se reorienta hacia una vista que sí tenga.
- `full-lifecycle.spec.ts:263` — navega a `/reports` con **sesión de estudiante** y afirmará que la página carga. Es el único test que rompe, y la corrección es mover la aserción a sesión admin o devolverla a `/`.

### D9. Entorno DEV/PROD explícito en el arranque

Se deriva `const isProd = process.env.NODE_ENV === "production"` y se usa en tres puntos: el banner de arranque (identifica el modo), la validación de secretos y el comportamiento del rate limit. En producción el servidor **falla rápido** si `JWT_SECRET` es el valor de ejemplo o tiene menos de 32 caracteres, o si `CORS_ORIGINS` contiene `localhost`. Son exactamente las dos configuraciones que `.env.example` entrega y que nadie habría cambiado al desplegar, y las dos que convierten un despliegue mal hecho en un fallo ruidoso en vez de uno silencioso.

Lo que NO se hace: no se introduce un gestor de configuración con esquema (zod ya está en dependencias pero no se usa para esto), ni se differentiate CORS o cookies más allá de lo que el código ya hace con `NODE_ENV`. La bandera se limita a surfaced el estado y a validar.

### D10. Limpieza limitada a `console.log`, no a `console.error`

Se eliminan los 9 `console.log` de desarrollo. Los 104 `console.error` se conservan: son logging de errores de servidor, no deuda técnica. La línea de arranque de `index.ts:146` se conserva pero se transforma en el banner con entorno (D9), no se borra.

Los dos `onClick` de `AdminWelcomeOptions.tsx:18,53` (`console.log("Exportar usuarios")`, `console.log("Exportar reportes")`) son botones sin función. Se **eliminan** en lugar de dejar un `console.log` equivalente: un botón que no hace nada es peor que un botón ausente.

### D11. `npm run test`, `npm run e2e` y `npm run lint`

Se añaden como alias del runner ya instalado (`vitest run --exclude e2e`, `playwright test`, `biome check`). `test:unit` se conserva por compatibilidad. El objetivo es que la verificación completa de la iteración sea un comando documentado en el acta de cierre, no tres comandos que hay que recordar.

### D12. El efecto de carga de proyectos no pisa la selección vigente

`Reports.tsx` fijaba `selectedProject` al primer proyecto en cada respuesta de `GET /api/projects`. Bajo `StrictMode` el efecto se monta dos veces y la segunda respuesta llegaba después de que el usuario (o un test) eligiera otro proyecto, revirtiendo la selección. Se cambia por una actualización funcional que mantiene la selección anterior si sigue existiendo en la lista recargada.

Aparece durante la fase 4 y se corrige aquí, aunque exceda el flujo mínimo de HU-14, porque el criterio de aceptación de la exportación depende del proyecto seleccionado: sin esto, tanto la interfaz como los E2E de la fase 9 serían no deterministas. No cambia la lista blanca de la API ni la forma del CSV.


## Risks / Trade-offs

**[El BOM rompe aserciones ingenuas de EXP-01]** → El BOM se documenta en el spec de `data-export` y los tests usan un helper compartido que lo retira antes de comparar. Riesgo residual: un test futuro escrito fuera de ese helper.

**[El gate de `/reports` rompe regresiones no detectadas]** → Se identificaron tres consumidores (`NavigationSidebar`, `ProductOwnerWelcomeOptions`, `full-lifecycle.spec.ts`) y los tres se tocan en el mismo change. La mitigación real es correr la suite completa, no la confianza en el análisis: si `full-lifecycle` falla por el paso 4.3, es el gate funcionando, no un defecto nuevo.

**[El filtro por sprint cambia la ruta existente]** → Es un parámetro opcional y el caso sin parámetro conserva la salida actual salvo escapado y BOM. La suite E2E existente es la red de seguridad: si algún consumidor implícito depended de la forma exacta, aparece como fallo.

**[`fetch` + blob pierde la descarga sin JavaScript y consume memoria]** → Aceptado para el volumen de un proyecto. Mitigación: revocar `URL.createObjectURL` en `finally` y mostrar el error en línea en lugar de una pestaña en blanco.

**[La sanitización anti-fórmula altera títulos legítimos que empiezan por `-` o `=`]** → Criterio conservador deliberado. Se cubre con test explícito para que el comportamiento sea intencionado y no surprises, y se documenta como limitacion conocida en el informe de iteración.

**[Restringir `/reports` a ADMIN cierra el acceso del docente (PRODUCT_OWNER), que HU-14 nombra como usuario]** → Decisión tomada conscientemente: el endpoint ya era ADMIN-only y la coherencia de autorización vale más que la lectura literal de "Docente / Administrador". Se registra en el informe como discrepancia a resolver en una iteración posterior si se quiere abrir al rol PRODUCT_OWNER.

**[La validación de secretos en producción puede impedir un arranque legítimo]** → Solo dispara con `NODE_ENV=production`, y las condiciones (ejemplo por defecto, menos de 32 caracteres, `localhost` en Origins) son exactamente las de una configuración sin configurar. Mitigación: el mensaje de error enumera qué variable falta y cuál es su valor unsatisfactory.

**[Falta `test` en `package.json` y algún runner externo puede invocar `npm test` esperando otra cosa]** → Hoy no existe la clave `test`, así que ningún CI puede estar dependiendo de ella.

## Migration Plan

Sin migración de datos ni de esquema: no hay cambios en `prisma/schema.prisma`.

El orden de aplicación importa porque el gate de `/reports` depende de que la interfaz ya no ofrezca enlaces a roles sin acceso:

1. Módulo `csv` + tests unitarios + ruta de exportación (`select`, escapado, BOM, filtro). Verificable de forma aislada con `npm run test`.
2. Interfaz de descarga en `Reports.tsx`.
3. Reparación de enlaces y gate de `/reports`, en el mismo paso, con la suite E2E completa como verificación.
4. Limpieza de `console.log` + `biome check --write` + scripts de `package.json`.
5. Entorno DEV/PROD + `.env.example`.
6. Pruebas EXP-01/02/03 y documentación.

**Rollback:** el change no toca esquema ni datos, así que revertir es `git revert`. Los puntos de rollback naturales son el commit de la ruta de exportación (vuelve al CSV con el defecto de escapado, que es el estado actual) y el del gate de `/reports` (vuelve a abrir Reportes a todos los autenticados). No hay estado que reconciliar.

## Open Questions

- ¿Debe el BOM activarse por variable de entorno si algún consumidor del CSV (un script institucional de notas) no lo tolera? Se asume siempre activo; si aparece un consumidor real, se convierte en un parámetro.
- ¿El filtro por sprint debería ofrecer también un rango de fechas o un filtro por estado/prioridad? El criterio de HU-14 dice "qué datos específicos"; el sprint es el primer corte. Queda para una HU posterior.
- ¿Abrir la exportación al rol PRODUCT_OWNER? Depende de si la lectura de "Docente / Administrador" de HU-14 se resuelve como "el rol ADMIN es el docente" —que es lo que sugiere el seed y el resto del producto— o como dos roles distintos.
