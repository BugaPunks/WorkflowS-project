import { readFileSync } from "node:fs";
import type { APIRequestContext } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { createSessionViaApi, loginViaApi } from "./utils/api-auth";
import {
	PROJECT_REPORT_HEADER,
	parseProjectReport,
	stripBom,
} from "./utils/csv";

const API_ORIGIN = "http://localhost:5000";

/**
 * HU-14 · Exportación de datos a CSV (RNF7.2) — casos EXP-01/02/03 de
 * docs/Iteracion5.md §6.
 *
 * El endpoint es `GET /api/metrics/export/projects/:projectId` y exige ADMIN
 * tanto en la API como en la vista `/reports`. El archivo se construye en
 * src/server/lib/csv.ts: todas las celdas se entrecomillan y las comillas
 * dobles internas se duplican, de modo que cualquier contenido produce filas
 * de exactamente 6 columnas.
 *
 * Estos casos son la red que hace visible el defecto previo al cambio: sin el
 * escapado RFC 4180, un título como `Diseño "login", con ácentos` partía su
 * fila en más de 6 columnas.
 */

/** Contenido con el que el defecto de escapado se hacía visible. */
const TRICKY_TITLE = 'Diseño "login", con ácentos';
const TRICKY_SPRINT = 'Sprint Export, Fase "A"';
const TRICKY_ASSIGNEE = "Pérez, Jr";

const exportUrl = (projectId: string, sprintId?: string) =>
	`${API_ORIGIN}/api/metrics/export/projects/${projectId}${
		sprintId ? `?sprintId=${sprintId}` : ""
	}`;

const isoDay = (date: Date) => date.toISOString().split("T")[0];

const daysFromNow = (days: number) =>
	isoDay(new Date(Date.now() + days * 86_400_000));

async function createProject(
	request: APIRequestContext,
	auth: { Authorization: string },
	data: { name: string; description: string; ownerId: string },
) {
	const res = await request.post(`${API_ORIGIN}/api/projects`, {
		headers: auth,
		data,
	});
	expect(res.status(), "POST /api/projects debe devolver 201").toBe(201);
	const { data: project } = (await res.json()) as { data: { id: string } };
	return project;
}

async function createSprint(
	request: APIRequestContext,
	auth: { Authorization: string },
	projectId: string,
	name: string,
) {
	const res = await request.post(`${API_ORIGIN}/api/sprints`, {
		headers: auth,
		data: {
			name,
			projectId,
			startDate: daysFromNow(0),
			endDate: daysFromNow(10),
		},
	});
	expect(res.status(), "POST /api/sprints debe devolver 201").toBe(201);
	const { data: sprint } = (await res.json()) as { data: { id: string } };
	return sprint;
}

async function createTask(
	request: APIRequestContext,
	auth: { Authorization: string },
	data: {
		title: string;
		projectId: string;
		sprintId: string;
		assigneeId?: string;
		status?: string;
		priority?: string;
	},
) {
	const res = await request.post(`${API_ORIGIN}/api/tasks`, {
		headers: auth,
		data,
	});
	expect(res.status(), "POST /api/tasks debe devolver 201").toBe(201);
}

test.describe("HU-14 · Exportación de datos a CSV", () => {
	test("EXP-01 · un proyecto sin sprints devuelve solo la cabecera, con Content-Type text/csv", async ({
		page,
		request,
	}) => {
		const { id: userId, token } = await loginViaApi(
			page,
			request,
			"admin",
			"ADMIN",
		);
		const auth = { Authorization: `Bearer ${token}` };
		const ts = Date.now();

		const project = await createProject(request, auth, {
			name: `Export Vacio ${ts}`,
			description: "For EXP-01",
			ownerId: userId,
		});

		// --- Act ---
		const res = await request.get(exportUrl(project.id), { headers: auth });

		// --- Assert: cabecera de la respuesta ---
		expect(res.status()).toBe(200);
		expect(res.headers()["content-type"]).toContain("text/csv");

		// --- Assert: el archivo es exactamente la cabecera, sin filas de datos ---
		// El BOM se retira solo si sigue presente: `text()` ya lo consumió al
		// decodificar, y un slice(1) incondicional rompería la cabecera.
		const body = await res.text();
		expect(stripBom(body)).toBe(PROJECT_REPORT_HEADER);
		expect(body.endsWith("\n")).toBe(false);

		// --- Assert: los bytes iniciales son el BOM seguido de la cabecera ---
		const bytes = await res.body();
		expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
		expect(bytes.subarray(3).toString("utf8")).toBe(PROJECT_REPORT_HEADER);
	});

	test("EXP-02 · tildes, comillas dobles y comas vuelven intactas y cada fila tiene 6 columnas", async ({
		page,
		request,
	}) => {
		const { id: userId, token } = await loginViaApi(
			page,
			request,
			"admin",
			"ADMIN",
		);
		const auth = { Authorization: `Bearer ${token}` };
		const ts = Date.now();

		// --- Arrange: responsable cuyo nombre lleva coma (requiere usuario propio) ---
		const assignee = await createSessionViaApi(request, undefined, {
			name: TRICKY_ASSIGNEE,
			email: `export_asignado_${ts}@example.com`,
			role: "TEAM_DEVELOPER",
		});

		const sprintName = `${TRICKY_SPRINT} ${ts}`;
		const project = await createProject(request, auth, {
			name: `Export Especiales ${ts}`,
			description: "For EXP-02",
			ownerId: userId,
		});
		const sprint = await createSprint(request, auth, project.id, sprintName);

		// --- Arrange: una tarea con caracteres difíciles y otra sin responsable ---
		await createTask(request, auth, {
			title: TRICKY_TITLE,
			projectId: project.id,
			sprintId: sprint.id,
			assigneeId: assignee.id,
			status: "IN_PROGRESS",
			priority: "HIGH",
		});
		await createTask(request, auth, {
			title: "Tarea sin responsable",
			projectId: project.id,
			sprintId: sprint.id,
			status: "TODO",
		});

		// --- Act ---
		const res = await request.get(exportUrl(project.id), { headers: auth });
		expect(res.status()).toBe(200);

		// --- Assert: cabecera exacta y número de filas ---
		const { header, rows } = parseProjectReport(await res.text());
		expect(header.join(",")).toBe(PROJECT_REPORT_HEADER);
		expect(rows).toHaveLength(2);

		// --- Assert: el requisito central del escapado ---
		for (const row of rows) {
			expect(
				row,
				`la fila ${JSON.stringify(row)} debe tener 6 columnas`,
			).toHaveLength(6);
		}

		// --- Assert: los valores vuelven intactos ---
		const trickyRow = rows.find((row) => row[1] === TRICKY_TITLE);
		expect(
			trickyRow,
			"la tarea con caracteres difíciles debe aparecer en el archivo",
		).toBeTruthy();
		expect(trickyRow?.[0]).toBe(sprintName);
		expect(trickyRow?.[2]).toBe(TRICKY_ASSIGNEE);
		expect(trickyRow?.[3]).toBe("IN_PROGRESS");
		expect(trickyRow?.[4]).toBe("HIGH");
		expect(trickyRow?.[5]).toBe("N/A");

		// --- Assert: una tarea sin responsable reporta el literal acordado ---
		const unassignedRow = rows.find(
			(row) => row[1] === "Tarea sin responsable",
		);
		expect(unassignedRow?.[2]).toBe("Sin asignar");
	});

	test("EXP-03 · la descarga desde la interfaz usa el nombre project-{id}-report.csv", async ({
		page,
		request,
	}) => {
		const { id: userId, token } = await loginViaApi(
			page,
			request,
			"admin",
			"ADMIN",
		);
		const auth = { Authorization: `Bearer ${token}` };
		const ts = Date.now();
		const projectName = `Export UI ${ts}`;
		const taskTitle = `Tarea Descarga ${ts}`;

		// --- Arrange: proyecto con un sprint y una tarea ---
		const project = await createProject(request, auth, {
			name: projectName,
			description: "For EXP-03",
			ownerId: userId,
		});
		const sprint = await createSprint(
			request,
			auth,
			project.id,
			`Sprint Descarga ${ts}`,
		);
		await createTask(request, auth, {
			title: taskTitle,
			projectId: project.id,
			sprintId: sprint.id,
			assigneeId: userId,
			status: "TODO",
		});

		// --- Act: elegir el proyecto en la vista y pulsar exportar ---
		await page.goto("/reports");
		await expect(
			page.getByRole("heading", { name: "Reportes y Métricas" }),
		).toBeVisible();

		const projectSelect = page.locator("#project-select");
		await expect(projectSelect).toBeVisible();
		await projectSelect.selectOption({ label: projectName });

		// El control de exportación se habilita al haber proyecto (HU-14).
		const exportButton = page.getByRole("button", { name: /Exportar Datos/ });
		await expect(exportButton).toBeEnabled();

		const downloadPromise = page.waitForEvent("download");
		await exportButton.click();
		const download = await downloadPromise;

		// --- Assert: el nombre lo anuncia el servidor, no la interfaz ---
		expect(download.suggestedFilename()).toBe(
			`project-${project.id}-report.csv`,
		);

		// --- Assert: el archivo descargado tiene el contenido esperado ---
		const path = await download.path();
		expect(path).toBeTruthy();
		const { header, rows } = parseProjectReport(
			readFileSync(path as string, "utf8"),
		);
		expect(header.join(",")).toBe(PROJECT_REPORT_HEADER);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toHaveLength(6);
		expect(rows[0][1]).toBe(taskTitle);
	});

	test("EXP-04 · el filtro por sprint acota el archivo y un sprint ajeno se rechaza con 400", async ({
		page,
		request,
	}) => {
		const { id: userId, token } = await loginViaApi(
			page,
			request,
			"admin",
			"ADMIN",
		);
		const auth = { Authorization: `Bearer ${token}` };
		const ts = Date.now();

		const project = await createProject(request, auth, {
			name: `Export Filtro ${ts}`,
			description: "For EXP-04",
			ownerId: userId,
		});
		// Otro proyecto, para comprobar que un sprint ajeno no se acepta.
		const otherProject = await createProject(request, auth, {
			name: `Export Otro ${ts}`,
			description: "For EXP-04",
			ownerId: userId,
		});

		const sprintA = await createSprint(
			request,
			auth,
			project.id,
			`Sprint A ${ts}`,
		);
		const sprintB = await createSprint(
			request,
			auth,
			project.id,
			`Sprint B ${ts}`,
		);
		const foreignSprint = await createSprint(
			request,
			auth,
			otherProject.id,
			`Sprint Ajeno ${ts}`,
		);

		await createTask(request, auth, {
			title: "Tarea del sprint A",
			projectId: project.id,
			sprintId: sprintA.id,
		});
		await createTask(request, auth, {
			title: "Tarea del sprint B",
			projectId: project.id,
			sprintId: sprintB.id,
		});

		// --- Assert: sin filtro, el archivo trae los dos sprints ---
		const all = await request.get(exportUrl(project.id), { headers: auth });
		expect(parseProjectReport(await all.text()).rows).toHaveLength(2);

		// --- Assert: con filtro, solo las filas del sprint pedido ---
		const filtered = await request.get(exportUrl(project.id, sprintA.id), {
			headers: auth,
		});
		expect(filtered.status()).toBe(200);
		const parsed = parseProjectReport(await filtered.text());
		expect(parsed.header.join(",")).toBe(PROJECT_REPORT_HEADER);
		expect(parsed.rows).toHaveLength(1);
		expect(parsed.rows[0][1]).toBe("Tarea del sprint A");

		// --- Assert: un sprint de otro proyecto no se degrada a un CSV vacío ---
		const foreign = await request.get(exportUrl(project.id, foreignSprint.id), {
			headers: auth,
		});
		expect(foreign.status()).toBe(400);

		// --- Assert: un sprint inexistente tampoco ---
		const missing = await request.get(exportUrl(project.id, "no-existe"), {
			headers: auth,
		});
		expect(missing.status()).toBe(400);
	});

	test("EXP-05 · un rol no ADMIN recibe 403 y no le aparece el control de exportación", async ({
		page,
		request,
	}) => {
		const { id: userId, token } = await loginViaApi(
			page,
			request,
			"admin",
			"ADMIN",
		);
		const auth = { Authorization: `Bearer ${token}` };
		const ts = Date.now();

		const project = await createProject(request, auth, {
			name: `Export RBAC ${ts}`,
			description: "For EXP-05",
			ownerId: userId,
		});

		// --- Arrange: sesión de miembro no ADMIN ---
		const member = await loginViaApi(
			page,
			request,
			"student",
			"TEAM_DEVELOPER",
		);

		// --- Assert: la API deniega la exportación ---
		const res = await request.get(exportUrl(project.id), {
			headers: { Authorization: `Bearer ${member.token}` },
		});
		expect(res.status()).toBe(403);
		// requireSystemRole responde con sendStatus: no llega ningún CSV.
		expect(res.headers()["content-type"]).not.toContain("text/csv");
		expect(await res.text()).not.toContain(PROJECT_REPORT_HEADER);

		// --- Assert: la vista /reports redirige al rol no ADMIN ---
		await page.goto("/reports");
		await expect(page).toHaveURL(/.*\/$/);
		await expect(
			page.getByRole("button", { name: /Exportar Datos/ }),
		).toHaveCount(0);

		// --- Assert: el menú del estudiante no enlaza a la vista restringida ---
		await expect(page.locator("a[href='/reports']")).toHaveCount(0);
	});
});
