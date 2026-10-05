## 1. Línea base

- [x] 1.1 Ejecutar `npm run test:unit` y `npx playwright test` sobre el estado actual y anotar los fallos preexistentes, para distinguir regresiones de este change
- [x] 1.2 Ejecutar `npm run check` y anotar el número de archivos y warnings de Biome como referencia
- [x] 1.3 Confirmar que el defecto de escapado es reproducible: una tarea titulada `Diseño "login", con ácentos` en un sprint produce hoy una fila que no parsea en 6 columnas

## 2. Módulo de generación de CSV

- [x] 2.1 Crear `src/server/lib/csv.ts` con `escapeCsvCell(value)`: entrecomilla todo valor y duplica las comillas dobles internas, conservando la sanitización anti-fórmula (`=`, `+`, `-`, `@`, tab, salto de línea) y aplicando primero la sanitización y después el escapado
- [x] 2.2 Añadir en el mismo módulo `buildProjectReportCsv(rows)`, que recibe filas planas `{ sprint, title, assignee, status, priority }` y devuelve el archivo con la cabecera `Sprint,Tarea,Asignado,Estado,Prioridad,Puntos` y el BOM UTF-8 al inicio
- [x] 2.3 Exportar una constante con la cabecera y otra con el nombre de archivo `project-{projectId}-report.csv`, para que la ruta y los tests no dupliquen literales
- [x] 2.4 Añadir `src/server/lib/csv.test.ts` con tests unitarios: tildes y `ñ` intactas, comas en nombre de sprint y responsable, comillas dobles embebidas, salto de línea dentro del título, valor que empieza por `=`, y proyecto vacío que produce solo la cabecera
- [x] 2.5 Verificar que `npm run test:unit` pasa y que el test de caracteres especiales falla si se revierte el escapado a entrecomillado parcial

## 3. Ruta de exportación

- [x] 3.1 Sustituir en `src/server/routes/metrics.ts:132-142` el armado manual por `buildProjectReportCsv`, y eliminar el `sanitizeCsvCell` local de las líneas 13-19
- [x] 3.2 Aplanar sprints y tareas a filas planas en la ruta, aplicando `Sin asignar` cuando no hay responsable y `N/A` en la columna de puntos
- [x] 3.3 Sustituir el `include` anidado de las líneas 113-126 por `select` de `sprints.name`, `tasks.title/status/priority` y `assignee.name`, y verificar que el hash bcrypt deja de cargarse
- [x] 3.4 Leer el `sprintId` opcional de la query, filtrar por él en la misma consulta y responder `400` cuando el sprint no existe o no pertenece al proyecto, distinguiendo `null` de un resultado sin filas
- [x] 3.5 Confirmar que sin `sprintId` el contenido es el mismo que antes, y que se conservan `Content-Type: text/csv` y el `Content-Disposition: attachment` con el nombre `project-{id}-report.csv`

## 4. Interfaz de descarga

- [x] 4.1 Añadir en `src/pages/Reports.tsx` un selector de sprint con opción "Todos", alimentado por los sprints del proyecto ya cargados
- [x] 4.2 Sustituir el `<a target="_blank">` de las líneas 139-148 por una descarga con `fetch` + `blob` + `URL.createObjectURL`, que tome el nombre del `Content-Disposition` y revoque la URL en `finally`
- [x] 4.3 Mostrar el error de la API en la interfaz cuando la respuesta no sea un CSV, en lugar de dejar el resultado en silencio
- [x] 4.4 Deshabilitar el control de exportación mientras no haya proyecto seleccionado y propagar el `sprintId` elegido a la URL de descarga
- [x] 4.5 Corregir la carrera del efecto que carga proyectos: la segunda respuesta de `StrictMode` volvía a fijar `selectedProject` al primero y pisaba la elección del usuario (evidencia en las notas)

## 5. Control de acceso de la vista de reportes

- [x] 5.1 Mover la ruta `/reports` de `src/App.tsx:63` dentro del bloque `RequireSystemRole allowedRole="ADMIN"` de las líneas 72-74
- [x] 5.2 Quitar la entrada "Reportes" de `STUDENT_MENU` en `src/components/NavigationSidebar.tsx:45`
- [x] 5.3 Reorientar o retirar el enlace a `/reports` de `src/islands/ProductOwnerWelcomeOptions.tsx:95`, que queda sin destino para el rol docente
- [x] 5.4 Revisar `src/islands/AdminWelcomeOptions.tsx` y `src/components/DashboardLayout.tsx` por si eluden el guard de rol en la navegación hacia reportes
- [x] 5.5 Corregir `e2e/full-lifecycle.spec.ts:263`, que navega a `/reports` con sesión de estudiante, moviendo la comprobación a sesión admin o devoliéndola a `/`
- [x] 5.6 Ejecutar la suite E2E completa y confirmar que `e2e/dashboards.spec.ts` sigue verde con su caso DASH-01 de sesión ADMIN

## 6. Limpieza de deuda técnica

- [x] 6.1 Eliminar los `console.log` residuales de `src/server/index.ts:146`, `src/server/routes/notifications.ts:34`, `src/pages/SprintDetail.tsx:50-51`, `src/components/NotificationBell.tsx:40`, `src/islands/SidebarProvider.tsx:85` y `src/components/ui/sidebar.tsx:136`
- [x] 6.2 Eliminar los dos `onClick` stub de `src/islands/AdminWelcomeOptions.tsx:18,53`, que solo registran "Exportar usuarios" y "Exportar reportes", en lugar de dejar un equivalente sin efecto
- [x] 6.3 Ejecutar `npm run check:fix` y revisar el diff, sin revertir correcciones de formato ajenas a este change
- [x] 6.4 Comprobar con `rg -n "console\.log" src/` que no queda ninguna ocurrencia

## 7. Entornos DEV y PROD

- [x] 7.1 Derivar en `src/server/index.ts` una bandera `isProd` desde `NODE_ENV` y usarla en el banner de arranque, junto con el entorno en el mensaje
- [x] 7.2 Añadir la validación de producción: `JWT_SECRET` ausente, con el valor de ejemplo o de menos de 32 caracteres, y `CORS_ORIGINS` con origen `localhost`, con error que nombre la variable y salida antes de escuchar
- [x] 7.3 Verificar que en desarrollo la validación de producción no se aplica y que la ausencia de `JWT_SECRET` sigue siendo fatal en cualquier entorno
- [x] 7.4 Documentar `NODE_ENV` en `.env.example` y confirmar que todas las variables leídas por el servidor aparecen en la plantilla
- [x] 7.5 Comprobar el arranque en los cuatro casos: producción válida, producción con secreto débil, producción con origen local y desarrollo

## 8. Puertas de calidad

- [x] 8.1 Añadir a `package.json` los scripts `test` (`vitest run --exclude e2e`), `e2e` (`playwright test`) y `lint` (`biome check`), conservando `test:unit`
- [x] 8.2 Ejecutar `npm run lint && npm run test` y confirmar que la cadena completa pasa

## 9. Pruebas de aceptación de la iteración

- [x] 9.1 Crear `e2e/export.spec.ts` siguiendo el patrón de `e2e/metrics.spec.ts`, con `loginViaApi(page, request, "admin", "ADMIN")` y `API_ORIGIN`
- [x] 9.2 Implementar EXP-01: proyecto sin sprints devuelve un cuerpo que, tras retirar el BOM si el cliente lo conserva, es exactamente la cabecera, con `Content-Type: text/csv`
- [x] 9.3 Implementar EXP-02: tarea con tildes, comillas dobles y comas, más sprint y responsable con comas; parsear el CSV y comprobar que toda fila de datos tiene 6 columnas y que los valores vuelven intactos
- [x] 9.4 Implementar EXP-03: la descarga desde la interfaz emite el evento `download` con `suggestedFilename()` igual a `project-{id}-report.csv`
- [x] 9.5 Añadir el caso del filtro por sprint y el del rechazo con `403` a un rol no ADMIN
- [x] 9.6 Añadir un helper compartido en `e2e/` que retire el BOM solo si está presente y parsee el CSV, y usarlo en todos los casos de exportación
- [x] 9.7 Extender `e2e/full-lifecycle.spec.ts` con el paso final de descarga, desde el mismo flujo que crea el proyecto, y afirmar sobre el contenido del archivo descargado
- [x] 9.8 Ejecutar la suite E2E completa y registrar el número de tests y el resultado

## 10. Cierre documental

- [x] 10.1 Actualizar la fila de Iteración 5 de `docs/TESTING_REPORT.md:40`, sustituyendo "N/A / Pendiente" por el archivo `e2e/export.spec.ts` y el estado real
- [x] 10.2 Crear `docs/INFORME_ITERACION_5.md` con el alcance de HU-14, las decisiones de diseño (CSV sobre PDF/Excel, filtro por sprint), la tabla EXP-01/02/03 con resultado real y las discrepancias registradas, incluida la del acceso del rol PRODUCT_OWNER
- [x] 10.3 Crear `docs/CIERRE_PROYECTO.md` con el acta de cierre, los entregables de la iteración, el alcance excluido (despliegue), las métricas de calidad obtenidas en los pasos 1.2 y 9.8, y el trabajo futuro
- [x] 10.4 Verificar que ninguna afirmación de los documentos nuevos contradice el estado real del repositorio

## Notas de la línea base (tasks 1.1–1.3)

Medido antes de tocar código, para que las fases 10.2 y 10.3 no inventen cifras:

- `npm run test:unit`: 1 archivo, **6 tests, todos en verde**.
- `npx playwright test`: **47 tests en verde (3.4 min)**, sin fallos preexistentes.
- `npm run check` (Biome): **144 archivos, 50 warnings, 0 errores**. Tras añadir `csv.ts` y `csv.test.ts`: 146 archivos, **los mismos 50 warnings** — el módulo nuevo no introduce deuda de lint.
- Defecto de escapado reproducido con la lógica de `metrics.ts:137`: una fila con sprint `Sprint 1, Fase A`, título `Diseño "login", con ácentos` y responsable `José Pérez, Jr` produce **9 columnas en lugar de 6**, porque el nombre de sprint y el de responsable se escriben sin entrecomillar y las comillas del título no se duplican.

Hallazgo colateral para una fase posterior: `.gitignore:20` ignora `tests-results/`, pero Playwright genera `test-results/`. La ejecución de la línea base dejó el directorio sin ignorar en el árbol de trabajo.

### Fase 3 — ruta de exportación (tasks 3.1–3.5)

Comprobado contra la API en ejecución, no solo por inspección:

- Sin filtro: 3 filas de datos, **todas de 6 columnas**, con `Sprint 1, Fase "A"` y `Diseño "login", con ácentos` devolviendo los valores intactos; `Sin asignar` y `N/A` literales.
- `?sprintId=` de un sprint del proyecto: 2 filas, todas del sprint pedido. De un sprint de **otro** proyecto: `400`. Inexistente: `400`. Proyecto inexistente: `404`. Rol no ADMIN: `403`.
- Cabeceras: `text/csv; charset=utf-8` y `attachment; filename="project-{id}-report.csv"` con el nombre exacto esperado.
- **SQL de la consulta de exportación** (log de Prisma): ``SELECT `users`.`id`, `users`.`name` FROM `users` `` y ``SELECT `tasks`.`id`, `tasks`.`title`, `tasks`.`status`, `tasks`.`priority`, `tasks`.`assigneeId`, `tasks`.`sprintId` ``. El hash de contraseña ya no se carga. Prisma añade `id` para resolver la relación, lo que es esperado.
- **BOM verificado a nivel de bytes**: los tres primeros bytes de la respuesta son `EF BB BF` y el resto es la cabecera exacta. Corregido el matiz de 9.2 y 9.6: `TextDecoder` (y por tanto `response.text()`) **consume** el BOM al decodificar, así que el helper debe retirarlo solo si está presente, nunca hacer un `slice(1)` incondicional.
- Regresión tras el cambio: `npm run test:unit` 23/23, `metrics.spec.ts` + `rbac.spec.ts` + `retrospectives.spec.ts` 5/5, Biome sin cambios en el número de warnings.

### Fase 4 — interfaz de descarga (tasks 4.1–4.5)

Verificado en un navegador real (Chromium) con un spec temporal, ya eliminado:

- Cabecera observada en el CSV descargado: `Sprint,Tarea,Asignado,Estado,Prioridad,Puntos`; con "Todos los sprints" **3 filas**, con un sprint concreto **2 filas**, todas de 6 columnas.
- Valores difíciles de ida y vuelta intactos desde la interfaz: `Diseñar "login", con ácentos`, `Sin asignar` y `N/A`.
- El evento `download` llega con `suggestedFilename()` = `project-{id}-report.csv`; el botón deshabilitado sin proyecto; un `400` simulado del servidor se pinta en un `role="alert"` con el mensaje de la API.
- **Carrera encontrada y corregida (4.5)**: `StrictMode` monta dos veces el efecto de carga y se registran **2 peticiones `GET /api/projects?memberId=`**. La segunda respuesta ejecutaba `setSelectedProject(projectsData[0].id)` y revertía la elección recién hecha: con el selector ya mostrando mi proyecto, a los pocos milisegundos volvía al primero (traza: a +0 ms valía mi id, a +50 ms ya no). Afecta también al burndown, así que es un fallo real de la página, no del test. Se sustituyó por una actualización funcional que **conserva la selección si sigue existiendo** en la lista recargada. Tras el arreglo, una única `selectOption` se mantiene estable.
- Efecto colateral documentado para la fase 9: los E2E de exportación pueden seleccionar el proyecto sin esperas ni reselecciones gracias a 4.5.


