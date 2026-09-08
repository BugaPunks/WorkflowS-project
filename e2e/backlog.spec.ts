import { expect, test } from "@playwright/test";

test.describe("Módulo 4: Gestión del Backlog (User Stories)", () => {
	const uniqueId = Date.now().toString();
	const userEmail = `admin${uniqueId}@workflow.com`;

	test.beforeEach(async ({ page, request }) => {
		// Register via API to avoid UI flakiness/timeouts
		const registerRes = await request.post(
			"http://localhost:5000/api/auth/register",
			{
				data: {
					name: "Admin User",
					email: userEmail,
					password: "password123",
					role: "ADMIN",
				},
			},
		);

		let userId = "";
		let userName = "Admin User";
		let token = "";

		if (!registerRes.ok()) {
			// Login if already exists
			const loginRes = await request.post(
				"http://localhost:5000/api/auth/login",
				{
					data: { email: userEmail, password: "password123" },
				},
			);
			const loginData = await loginRes.json();
			userId = loginData.user.id;
			userName = loginData.user.name;
			token = loginData.token;
		} else {
			const body = await registerRes.json();
			userId = body.user.id;
			userName = body.user.name;
			token = body.token;
		}

		// Bypass UI Login
		await page.goto("/");
		await page.evaluate(
			({ id, name, email, role, token }) => {
				localStorage.setItem("user", JSON.stringify({ id, name, email, role }));
				localStorage.setItem("token", token);
			},
			{ id: userId, name: userName, email: userEmail, role: "ADMIN", token },
		);

		// Reload to pick up session
		await page.reload();
	});

	test("Debe permitir crear una historia de usuario con criterios de aceptación", async ({
		page,
	}) => {
		// 1. Navigate to User Stories (Already logged in via beforeEach)
		await page.goto("/user-stories");
		await expect(page).toHaveURL(/\/user-stories/);

		// 2. Open Create Modal
		await page.getByRole("button", { name: "+ Nueva Historia" }).click();
		await expect(
			page.getByRole("heading", { name: "Crear Nueva Historia" }),
		).toBeVisible();

		// 3. Fill Form
		const timestamp = Date.now();
		const storyTitle = `Historia Test ${timestamp}`;

		// Select Project (assuming at least one exists, or we create one)
		// We might need to ensure a project exists first.
		// If the dropdown is empty, this will fail.
		// Let's create a project via API or UI if needed.
		// For robustness, let's assume we need to create one if none exist?
		// But for now, let's try to select option 1.
		const projectSelect = page.locator("#story-project");
		// Wait for options to be populated
		// await page.waitForTimeout(1000); // Basic wait, better to wait for selector

		// Check if there are options. If not, we might need to create a project.
		// Since we use a fresh user, they might not have projects!
		// ADMINs see all projects? Or only theirs?
		// If new user, we must create a project first.

		await page.goto("/projects");
		await page.getByRole("button", { name: "Nuevo Proyecto" }).click();
		await page.fill('input[name="name"]', `Project For Backlog ${timestamp}`);
		await page.fill('textarea[name="description"]', "Desc");
		await page.getByRole("button", { name: "Crear Proyecto", exact: true }).click();

		// Now go back to stories
		await page.goto("/user-stories");
		await page.getByRole("button", { name: "+ Nueva Historia" }).click();

		await projectSelect.waitFor({ state: "visible" });
		// Ensure options are loaded
		await expect(projectSelect.locator("option")).not.toHaveCount(1); // Should have at least default + 1 project
		await projectSelect.selectOption({ index: 1 }); // Select first actual project

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
