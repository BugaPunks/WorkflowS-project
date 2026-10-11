import { expect, test } from "@playwright/test";
import { loginViaApi } from "./utils/api-auth";

test.describe("Módulo 4: Gestión del Backlog (User Stories)", () => {
	const uniqueId = Date.now().toString();
	const userEmail = `admin${uniqueId}@workflow.com`;

	test.beforeEach(async ({ page, request }) => {
		// Crear usuario ADMIN vía loginViaApi (promociona rol automáticamente)
		await loginViaApi(page, request, userEmail, "ADMIN", "Admin User");

		// Bypass UI Login (cookie ya inyectada por loginViaApi)
		await page.goto("/");
		await page.reload();
	});

	test("Debe permitir crear una historia de usuario con criterios de aceptación", async ({
		page,
	}) => {
		const timestamp = Date.now();
		const storyTitle = `Historia Test ${timestamp}`;
		const projectName = `Project For Backlog ${timestamp}`;

		// 1. Create a project to host the user story, then open its backlog
		await page.goto("/projects");
		await page.getByRole("button", { name: "Nuevo Proyecto" }).click();
		await page.fill('input[name="name"]', projectName);
		await page.fill('textarea[name="description"]', "Desc");
		await page
			.getByRole("button", { name: "Crear Proyecto", exact: true })
			.click();

		await page
			.locator(".bg-white")
			.filter({ hasText: projectName })
			.first()
			.getByRole("button", { name: "Ver Proyecto" })
			.click();
		const projectId = page.url().split("/projects/")[1];
		await page.goto(`/projects/${projectId}/user-stories`);
		await expect(page).toHaveURL(
			new RegExp(`/projects/${projectId}/user-stories`),
		);

		// Open Create Modal (project is implicit from the route)
		await page.getByRole("button", { name: "+ Nueva Historia" }).click();
		await expect(
			page.getByRole("heading", { name: "Crear Nueva Historia" }),
		).toBeVisible();

		// Fill Form
		await page.fill("#story-title", storyTitle);
		await page.fill(
			"#story-desc",
			"Descripción de prueba para la historia de usuario",
		);
		await page.fill(
			"#story-acceptance",
			"Dado que tengo permisos, cuando creo una historia, entonces se guarda correctamente.",
		);
		await page.selectOption("#story-priority", "HIGH");

		// 4. Submit
		await page.getByRole("button", { name: "Crear", exact: true }).click();

		// Wait for modal to close
		await expect(
			page.getByRole("heading", { name: "Crear Nueva Historia" }),
		).not.toBeVisible();

		// 5. Verify it appears in the list
		// Reload to ensure data is fetched
		await page.reload();
		await expect(page.locator(`text=${storyTitle}`)).toBeVisible();

		// 6. Verify Acceptance Criteria is visible
		await expect(
			page
				.locator(
					"text=Dado que tengo permisos, cuando creo una historia, entonces se guarda correctamente.",
				)
				.first(),
		).toBeVisible();
	});
});
