import { expect, test } from "@playwright/test";
import { loginViaApi, TEST_PASSWORD } from "./utils/api-auth";

test.describe("Rubrics Management", () => {
	test.beforeEach(async ({ page }) => {
		const { id: userId, token } = await loginViaApi(
			page,
			`rubric_admin_${Date.now()}@test.com`,
			TEST_PASSWORD,
			"Rubric Admin",
			"ADMIN",
		);

		// Ensure there is at least one project
		const response = await page.request.post("/api/projects", {
			headers: { Authorization: `Bearer ${token}` },
			data: {
				name: "E2E Test Project Rubrics",
				description: "Project for E2E tests",
				startDate: new Date().toISOString(),
				endDate: new Date().toISOString(),
				ownerId: userId,
			},
		});
	});

	test("should create, edit and delete a rubric", async ({ page }) => {
		// 1. Go to Rubrics page
		await page.goto("/rubrics");

		// Wait for page load
		await page.waitForLoadState("networkidle");

		// 2. Select a project
		// Wait for the select to appear
		const projectSelect = page.locator("#project-select");
		await projectSelect.waitFor({ state: "visible", timeout: 10000 });

		// Wait for options to be populated
		await expect(async () => {
			const options = await projectSelect.locator("option").count();
			expect(options).toBeGreaterThan(1);
		}).toPass({ timeout: 10000 });

		await projectSelect.selectOption({ index: 1 });

		// 3. Create a new Rubric
		// In the new UI, the button is dynamic: "+ Rúbrica para {ProjectName}"
		const createButton = page.locator('button:has-text("+ Rúbrica para")');
		await createButton.waitFor({ state: "visible" });
		await createButton.click();

		await page.fill("#rubric-name", "Test Rubric E2E");
		await page.fill("#rubric-desc", "Description for E2E Test");

		// Fill first criterion
		const firstCriterionName = page
			.locator('input[id^="criterion-name-"]')
			.first();
		await firstCriterionName.fill("Criterion 1");

		// Add another criterion
		await page.click("text=+ Agregar Criterio");
		const secondCriterionName = page
			.locator('input[id^="criterion-name-"]')
			.nth(1);
		await secondCriterionName.fill("Criterion 2");

		await page.click('button:has-text("Crear Rúbrica")');

		// Wait for modal to close
		await expect(page.locator("text=Crear Nueva Rúbrica")).not.toBeVisible();

		// Verify creation
		// Use first() to avoid strict mode violation if previous tests didn't clean up
		await expect(page.locator("text=Test Rubric E2E").first()).toBeVisible();
		await expect(page.locator("text=Criterion 1").first()).toBeVisible();
		await expect(page.locator("text=Criterion 2").first()).toBeVisible();

		// 4. Edit the Rubric
		// Find the edit button for the created rubric
		const rubricCard = page
			.locator(".bg-white")
			.filter({ hasText: "Test Rubric E2E" })
			.first();
		await rubricCard.getByRole("button", { name: "Editar" }).click();

		await expect(page.locator("#rubric-name")).toHaveValue("Test Rubric E2E");
		await page.fill("#rubric-name", "Test Rubric E2E Updated");
		await page.click('button:has-text("Guardar Cambios")');

		await expect(page.locator("text=Editar Rúbrica")).not.toBeVisible();

		// Verify update
		await expect(page.locator("text=Test Rubric E2E Updated")).toBeVisible();

		// 5. Delete the Rubric
		page.on("dialog", (dialog) => dialog.accept());
		// Use the updated card locator
		const updatedRubricCard = page
			.locator(".bg-white")
			.filter({ hasText: "Test Rubric E2E Updated" })
			.first();
		await updatedRubricCard.getByRole("button", { name: "Eliminar" }).click();

		// Verify deletion
		await expect(
			page.locator("text=Test Rubric E2E Updated"),
		).not.toBeVisible();
	});
});
