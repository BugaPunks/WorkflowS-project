import { expect, test } from "@playwright/test";
import { createSessionViaApi } from "./utils/api-auth";

test.describe("Project Details", () => {
	// Use a unique suffix to avoid conflicts if tests run in parallel or repeatedly
	const uniqueId = Date.now().toString();
	const projectName = `Test Project ${uniqueId}`;
	const userEmail = `user${uniqueId}@test.com`;

	test.beforeEach(async ({ page, request }) => {
		page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
		page.on("pageerror", (exception) =>
			console.log(`PAGE ERROR: "${exception}"`),
		);

		// Registrar vía API (siempre TEAM_DEVELOPER), promover a ADMIN e iniciar
		// sesión. La sesión viaja en la cookie httpOnly, no en localStorage.
		await page.goto("/");
		await createSessionViaApi(request, page, {
			name: "Test User",
			email: userEmail,
			role: "ADMIN",
		});

		// Reload to pick up session
		await page.reload();
	});

	test("should create a project and view its details", async ({ page }) => {
		// Create Project
		await page.goto("/projects");
		// Debug: check user role in local storage
		const userStr = await page.evaluate(() => localStorage.getItem("user"));
		console.log("LocalStorage User:", userStr);

		await page.getByRole("button", { name: "Nuevo Proyecto" }).click();
		await page.fill('input[name="name"]', projectName);
		await page.fill('textarea[name="description"]', "Project Description");
		await page
			.getByRole("button", { name: "Crear Proyecto", exact: true })
			.click();

		// Should appear in list
		await expect(page.getByText(projectName)).toBeVisible();

		// Navigate to Details
		// Find the card containing the text and click the "Ver" button inside it
		// We use locator chaining carefully
		await page
			.locator(".bg-white") // Card class
			.filter({ hasText: projectName })
			.first() // Use first match which should be the card (or refine if multiple cards match)
			.getByRole("button", { name: "Ver Proyecto" })
			.click();

		// Check Header
		await expect(
			page.getByRole("heading", { name: projectName }),
		).toBeVisible();
		await expect(page.getByText("Project Description")).toBeVisible();

		// Check Tabs existence
		await expect(
			page.getByRole("button", { name: "Tablero & Sprints" }),
		).toBeVisible();
		await expect(page.getByRole("button", { name: "Miembros" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Chat" })).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Documentos" }),
		).toBeVisible();

		// Check Default Tab (Board) content
		await expect(page.getByText("Backlog (Historias)")).toBeVisible();
		await expect(page.getByRole("heading", { name: "Sprints" })).toBeVisible();
	});

	test("should navigate through tabs in project details", async ({ page }) => {
		// Reuse project creation or assume state?
		// For robustness, let's create another one or handle it.
		// Since we are in a new test/context (default playwright behavior), we need to create again or seed.
		// Doing creation again for isolation.

		await page.goto("/projects");
		await page.getByRole("button", { name: "Nuevo Proyecto" }).click();
		const pName = `${projectName} Tabs`;
		await page.fill('input[name="name"]', pName);
		await page.fill('textarea[name="description"]', "Desc");
		await page
			.getByRole("button", { name: "Crear Proyecto", exact: true })
			.click();

		// Navigate
		await page
			.locator(".bg-white")
			.filter({ hasText: pName })
			.first()
			.getByRole("button", { name: "Ver Proyecto" })
			.click();

		// Click Chat Tab
		await page.getByRole("button", { name: "Chat" }).click();
		await expect(page.getByText("Chat del Equipo")).toBeVisible();
		await expect(page.getByPlaceholder("Escribe un mensaje...")).toBeVisible();

		// Click Docs Tab
		await page.getByRole("button", { name: "Documentos" }).click();
		await expect(
			page.getByRole("heading", { name: "Documentos" }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Subir Archivo" }),
		).toBeVisible();

		// Click Members Tab
		await page.getByRole("button", { name: "Miembros" }).click();
		await expect(page.getByText("Miembros del Equipo")).toBeVisible();
		// Current user should be there
		await expect(page.getByText("Test User")).toBeVisible(); // Name used in registration
	});
});
