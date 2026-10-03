import { expect, test } from "@playwright/test";
import { loginViaApi } from "./utils/api-auth";

/**
 * HU-10 · Dashboard personalizado por rol.
 *
 * El split por rol vive en src/pages/Dashboard.tsx:21-25: ADMIN renderiza
 * TeacherDashboard ("Panel de Docente") y cualquier otro rol renderiza
 * StudentDashboard, que a su vez elige el panel según el rol del estudiante.
 *
 * NOTA DE ALCANCE: este test cubre la diferenciación visual por rol. El
 * dashboard todavía NO consume datos del backend ni es configurable por el
 * usuario (ver docs/INFORME_ITERACION_3.md §2.3), así que aquí no se puede
 * afirmar nada sobre proyectos activos, tareas pendientes o vencimientos.
 */
test.describe("HU-10 — Dashboard por rol", () => {
	test("DASH-01 · el ADMIN ve el Panel de Docente y no el de Desarrollador", async ({
		page,
		request,
	}) => {
		await loginViaApi(page, request, "admin", "ADMIN");

		await page.goto("/");

		await expect(
			page.getByRole("heading", { name: "Panel de Docente" }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Panel de Desarrollador" }),
		).toHaveCount(0);

		// El sidebar del docente incluye Reportes y Evaluaciones
		await expect(page.locator("a[href='/reports']").first()).toBeVisible();
		await expect(page.locator("a[href='/evaluations']").first()).toBeVisible();
	});

	test("DASH-02 · un TEAM_DEVELOPER ve el Panel de Desarrollador y no el de Docente", async ({
		page,
		request,
	}) => {
		await loginViaApi(page, request, "student", "TEAM_DEVELOPER");

		await page.goto("/");

		await expect(
			page.getByRole("heading", { name: "Panel de Desarrollador" }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Panel de Docente" }),
		).toHaveCount(0);

		// Enlaces propios del rol desarrollador
		await expect(page.locator("a[href='/tasks']").first()).toBeVisible();
		await expect(page.locator("a[href='/projects']").first()).toBeVisible();
	});

	test("DASH-03 · un SCRUM_MASTER obtiene un panel distinto al del desarrollador", async ({
		page,
		request,
	}) => {
		await loginViaApi(page, request, "scrum", "SCRUM_MASTER");

		await page.goto("/");

		await expect(
			page.getByRole("heading", { name: "Panel de Docente" }),
		).toHaveCount(0);
		await expect(
			page.getByRole("heading", { name: "Panel de Desarrollador" }),
		).toHaveCount(0);
	});

	test("DASH-04 · el estudiante no puede acceder a /evaluations (redirección a inicio)", async ({
		page,
		request,
	}) => {
		await loginViaApi(page, request, "student", "TEAM_DEVELOPER");

		await page.goto("/evaluations");

		// The RequireSystemRole component redirects to /
		await expect(page).toHaveURL(/.*\/$/);
	});
});
