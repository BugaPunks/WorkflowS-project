## Why

La Iteración 5 es la última del proyecto y su entregable central, HU-14, está a medias: el endpoint de exportación existe desde la Iteración 3 pero **genera CSV malformado**. `sanitizeCsvCell` (`src/server/routes/metrics.ts:13-19`) solo protege contra fórmulas (`=`, `+`, `-`, `@`) y no implementa el escapado RFC 4180, así que una tarea titulada `Diseño "login", con ácentos` produce una fila de 8 columnas en lugar de 6 y una hoja de cálculo interpreta el texto partido en columnas equivocadas. Para una función cuyo propósito es alimentar auditorías externas, un CSV que no se puede parsear es un fallo funcional, no un detalle de formato.

Sobre ese defecto se acumulan cinco huecos que el documento de la iteración (§9, "Resumen de pendientes funcionales") deja explícitos y que el repositorio no cubre:

1. **Cero pruebas de exportación.** No existen EXP-01, EXP-02 ni EXP-03 (§6, Tabla 29); `docs/TESTING_REPORT.md:40` declara la fila de Iteración 5 como "Pendiente". El E2E de ciclo de vida completo (`e2e/full-lifecycle.spec.ts:263`) navega a `/reports` pero **nunca dispara la descarga**, de modo que el defecto de escapado es invisible para la suite.
2. **Fuga de datos sensibles en la consulta de exportación.** `metrics.ts:120` usa `include: { assignee: true }`, que arrastra **todas** las columnas de `User` — incluido el hash bcrypt — a memoria para construir un CSV que solo necesita `name`. Es exactamente lo que §5.e del documento prohíbe ("optimización de consultas Prisma usando `select`... excluir passwords").
3. **El criterio de aceptación de HU-14 no está cubierto.** "La funcionalidad debe permitir filtrar y seleccionar qué datos específicos se desean exportar" no tiene contraparte: el CSV sale siempre completo, sin ninguna opción de filtrado en la interfaz.
4. **`/reports` no está restringida por rol.** El endpoint exige `requireSystemRole("ADMIN")` pero la ruta es pública para cualquier autenticado (`src/App.tsx:63`), y el menú lateral ofrece el enlace a todos los roles (`NavigationSidebar.tsx:45`). Un estudiante ve un botón de descarga que le responde 403.
5. **No existe arranque diferenciado DEV/PROD.** `NODE_ENV` aparece en tres sitios del servidor pero ninguno bifurca comportamiento: no hay bandera de entorno, ni validación de secretos en producción, ni banner que identifique el modo. §5.f del documento lo pide junto con un `.env.example` (que sí existe, pero no documenta `NODE_ENV`).

Además, la "Refactorización final y limpieza" de §5.e está a medias: quedan **9 `console.log` residuales** de desarrollo en 7 archivos (incluidos dos `onClick` que solo hacen `console.log("Exportar usuarios")` y `console.log("Exportar reportes")`, es decir botones sin función), y `package.json` no expone script `test` ni `e2e` pese a tener Vitest y Playwright instalados, así que la suite completa no se puede lanzar con un comando documentado.

El despliegue (Nginx + estáticos + Node + DB, §5.c) queda **fuera de alcance** de este change.

## What Changes

- **CSV conforme a RFC 4180 (defecto crítico)**: nuevo módulo puro `src/server/lib/csv.ts` con `escapeCsvCell` (duplica `"`, entrecomilla cuando el valor contiene `,` `"` `\n` `\r`, y conserva la protección anti-fórmula) y `buildProjectReportCsv`. Se elimina el `sanitizeCsvCell` local de la ruta. Toda celda —no solo el título— queda entrecomillada y escapada, de modo que **toda fila tiene exactamente 6 columnas** con cualquier entrada.
- **Codificación UTF-8 con BOM** para que Excel abra los acentos correctamente sin intervención manual del docente.
- **`select` en la consulta de exportación**: se sustituye `include` por `select` (`sprints.name`, `tasks.title/status/priority`, `assignee.name`), eliminando la carga del hash bcrypt y reduciendo el payload.
- **Filtro por sprint (criterio de aceptación de HU-14)**: `GET /api/metrics/export/projects/:projectId?sprintId=...` exporta un único sprint; sin el parámetro se comporta exactamente como hoy. Un `sprintId` que no pertenece al proyecto se rechaza con `400`, no se ignora en silencio.
- **Descarga real en la interfaz**: `Reports.tsx` deja de usar un `<a target="_blank">` (que abre una pestaña vacía si el servidor responde 403/404) y pasa a `fetch` + `blob` + `URL.createObjectURL`, conservando el nombre de archivo que envía `Content-Disposition` y mostrando el error de la API. Se añade el selector de sprint que alimenta el filtro.
- **`/reports` restringida a ADMIN**: la ruta entra en el bloque `RequireSystemRole`, se quita el enlace del menú de estudiantes y se reorienta el enlace del panel del docente. Se adjusts el paso 4.3 de `e2e/full-lifecycle.spec.ts`, que hoy visita `/reports` con sesión de estudiante.
- **Arranque DEV/PROD**: bandera `isProd` en el servidor, banner de arranque que identifica el entorno, y validación de secretos en producción (`JWT_SECRET` con longitud mínima y `CORS_ORIGINS` sin `localhost`) con fallo rápido. `.env.example` documenta `NODE_ENV`.
- **Limpieza de deuda técnica**: eliminación de los 9 `console.log` residuales y de los dos `onClick` stub de `AdminWelcomeOptions.tsx`; `biome check --write` sobre el árbol.
- **Puertas de calidad verificables**: scripts `test`, `e2e` y `lint` en `package.json`, para que la suite completa se lanzable con un comando documentado (§5.e "ejecución de los scripts de calidad definidos en el proyecto").
- **Pruebas de la iteración**: nuevo `e2e/export.spec.ts` con EXP-01 (proyecto vacío → solo cabecera), EXP-02 (tildes, comas y comillas se escapan y la fila conserva 6 columnas) y EXP-03 (el navegador descarga con el nombre `project-{projectId}-report.csv`), más el filtro por sprint y el rechazo a roles no ADMIN. `full-lifecycle.spec.ts` incorpora el paso final de descarga. Tests unitarios de `src/server/lib/csv.ts`.
- **Cierre documental**: `docs/TESTING_REPORT.md` deja de estar en "Pendiente", y se añade el informe de la iteración y el acta de cierre de proyecto (§4, entregables "Reporte final de pruebas" y "documento de cierre de proyecto").
- **Fuera de alcance**: la arquitectura de despliegue de §5.c (Nginx, archivos estáticos, PM2/systemd, Docker, `.env.production`) y los enlaces muertos a `/reports/dashboard`, `/reports/performance` y `/reports/sprints` de `AdminWelcomeOptions.tsx`, que no existen como rutas.

## Capabilities

### New Capabilities

- `data-export`: exportación de los datos de un proyecto a CSV downloadable — estructura de columnas, escapado y codificación del archivo, generación por Sprint y Tarea, filtrado por sprint, descarga desde la interfaz y autorización del docente. Cubre HU-14, RNF7.2 y el criterio de aceptación de filtrado.
- `runtime-configuration`: arranque del servidor diferenciado por entorno DEV y PROD, validación de secretos y Origins en producción, y `.env.example` como contrato de variables. Cubre §5.f y RNF4.1 en su vertiente de configuración.
- `quality-gates`: puertas de calidad ejecutables del proyecto — scripts de `test`, `e2e` y `lint`, ausencia de `console.log` residuales, y cobertura de la suite E2E con las capacidades del producto. Cubre RNF6.1 y el entregable "Reporte final de pruebas".

### Modified Capabilities

- `role-dashboard`: el requisito que restringe las vistas de evaluación y rendimiento al docente se amplía para cubrir la vista de reportes y la exportación CSV, que hoy son alcanzables por cualquier rol autenticado.

## Impact

- **Backend**: `src/server/routes/metrics.ts` (ruta de exportación: `select`, filtro `sprintId`, uso del módulo `csv`), nuevo `src/server/lib/csv.ts`, `src/server/index.ts` (bandera de entorno, banner, validación de secretos), `src/server/lib/csv.test.ts` (nuevo).
- **Frontend**: `src/pages/Reports.tsx` (selector de sprint, descarga por `fetch`/`blob`, manejo de error), `src/App.tsx` (ruta `/reports` bajo `RequireSystemRole`), `src/components/NavigationSidebar.tsx` (enlace "Reportes" solo para ADMIN), `src/islands/ProductOwnerWelcomeOptions.tsx` (enlace a `/reports`), `src/islands/AdminWelcomeOptions.tsx` y `src/pages/SprintDetail.tsx`, `src/components/NotificationBell.tsx`, `src/islands/SidebarProvider.tsx`, `src/components/ui/sidebar.tsx`, `src/server/routes/notifications.ts` (limpieza de `console.log`).
- **API**: `GET /api/metrics/export/projects/:projectId` gana el parámetro opcional `?sprintId=` y un nuevo `400` para sprint ajeno al proyecto. No hay cambios de breaking: sin `sprintId` la respuesta es idéntica salvo por el escapado y el BOM.
- **Dependencias**: ninguna nueva. La suite usa Vitest y Playwright ya instalados; el CSV se genera a mano, sin librería de CSV, para no añadir superficie a un build que se quiere cerrar.
- **Tests**: `e2e/export.spec.ts` (nuevo), `e2e/full-lifecycle.spec.ts` (paso 4.3 y paso de descarga), `e2e/dashboards.spec.ts` (verificar que el caso DASH-01 sigue viendo el enlace con sesión ADMIN), `src/server/lib/csv.test.ts` (nuevo), `package.json` (scripts `test`, `e2e`, `lint`).
- **Documentación**: `docs/TESTING_REPORT.md` (fila de Iteración 5), `docs/INFORME_ITERACION_5.md` (nuevo), `docs/CIERRE_PROYECTO.md` (nuevo).
