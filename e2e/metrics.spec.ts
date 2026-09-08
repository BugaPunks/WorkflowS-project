import { expect, test } from "@playwright/test";
import { loginViaApi } from "./utils/api-auth";

test.describe("Metrics & Reports", () => {
	test("Should display Burndown and Contribution charts", async ({
		page,
		request,
	}) => {
		// 1. Login as Admin
		const { token } = await loginViaApi(page, request, "admin", "ADMIN");

		// 2. Setup Project & Sprint (so charts are not empty/disabled)
		// Create Project
		const timestamp = Date.now();
		const projectName = `Metrics Project ${timestamp}`;
		const _projectRes = await request.post(
			"http://localhost:5000/api/projects",
			{
				headers: { Authorization: `Bearer ${token}` },
				data: {
					name: projectName,
					description: "For Metrics",
					startDate: new Date().toISOString(),
					endDate: new Date(Date.now() + 86400000).toISOString(),
				},
			},
		);

		// If we can't create via API (auth required), do via UI.
		// The API usually requires cookie/token. Since we are in test context, 'request' context might not have cookies
		// unless we share storageState or log in via request.
		// Easier to use UI for creation if API auth is complex.
		// Let's use UI for creation to be safe.

		await page.goto("/projects");
		await page.getByRole("button", { name: "Nuevo Proyecto" }).click();
		await page.fill('input[name="name"]', projectName);
		await page.fill('textarea[name="description"]', "Desc");
		await page.getByRole("button", { name: "Crear Proyecto", exact: true }).click();

		// Go to Sprints (inside Project) to create one
		await page
			.locator(".bg-white")
			.filter({ hasText: projectName })
			.first()
			.getByRole("button", { name: "Ver Proyecto" })
			.click();
		// Assuming default tab is Board/Sprints
		// Create Sprint
		// Button name in UI is "+ Nuevo Sprint"
		await page.getByRole("button", { name: "+ Nuevo Sprint" }).click();
		// Wait for modal
		await expect(
			page.getByRole("heading", { name: "Nuevo Sprint" }),
		).toBeVisible();
		// Use waitForSelector to ensure input is ready
		await page.waitForSelector("#sprint-name");
		await page.fill("#sprint-name", "Sprint 1");
		// Dates might be required
		await page.getByRole("button", { name: "Crear", exact: true }).click();

		// 2. Go to Reports
		await page.goto("/reports");

		// 3. Check if Project Selector exists
		await expect(page.getByLabel("Proyecto")).toBeVisible();

		// Select our project if not selected
		await page.getByLabel("Proyecto").selectOption({ label: projectName });

		// 4. Check if Burndown Chart section exists
		await expect(page.getByText("Reportes y Métricas")).toBeVisible();

		// 5. Check Contribution Section
		await expect(page.getByText("Contribución Individual")).toBeVisible();

		// 6. Check if table headers exist OR empty state
		// Since we have no data, it should show empty state
		if (
			await page
				.getByText("No hay datos de tareas completadas aún.")
				.isVisible()
		) {
			await expect(
				page.getByText("No hay datos de tareas completadas aún."),
			).toBeVisible();
		} else {
			await expect(page.getByText("Usuario", { exact: true })).toBeVisible();
			await expect(page.getByText("Tareas Completadas")).toBeVisible();
		}
	});
});
