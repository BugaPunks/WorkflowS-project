import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { loginViaApi, TEST_PASSWORD } from "./utils/api-auth";

test.describe("User Management", () => {
	test.beforeEach(async ({ page }) => {
		await loginViaApi(
			page,
			`admin_um_${Date.now()}@test.com`,
			TEST_PASSWORD,
			"Admin UM",
			"ADMIN",
		);
	});

	test("should create, edit (including password reset) and delete a user", async ({
		page,
	}) => {
		// 1. Go to User Management
		await page.goto("/user-management");

		// 2. Create User
		const newUserEmail = `testuser_${randomUUID()}@example.com`;
		const newUserName = "Test User E2E";

		// Wait for the button
		const createButton = page.getByRole("button", { name: "+ Nuevo Usuario" });
		await createButton.waitFor({ state: "visible" });
		await createButton.click();

		await page.fill("#edit-name", newUserName);
		await page.fill("#edit-email", newUserEmail);
		await page.fill("#edit-password", TEST_PASSWORD);
		await page.selectOption("#edit-role", "TEAM_DEVELOPER");

		// Use exact text match for button or role
		await page.click('button:has-text("Crear")');

		// Verify creation
		await expect(page.locator(`text=${newUserEmail}`)).toBeVisible();

		// 3. Edit User
		// Find the row with the user
		const userRow = page.locator("tr", { hasText: newUserEmail });
		await userRow.getByRole("button", { name: "Editar" }).click();

		// Update name and role
		await page.fill("#edit-name", "Test User Updated");
		await page.selectOption("#edit-role", "SCRUM_MASTER");

		// Update Password (Optional test)
		await page.fill("#edit-password", "N3wPassword!2026");

		await page.click('button:has-text("Guardar")');

		// Verify update
		await expect(page.locator("text=Test User Updated")).toBeVisible();
		// "Scrum Master" text might appear in role column
		// We need to be specific to avoid strict mode violation if multiple "Scrum Master" texts exist
		// Check within the row
		await expect(
			page
				.locator("tr", { hasText: "Test User Updated" })
				.locator("text=Scrum Master"),
		).toBeVisible();

		// 4. Delete User
		page.on("dialog", (dialog) => dialog.accept());
		// Re-locate row as it might have re-rendered
		const updatedRow = page.locator("tr", { hasText: "Test User Updated" });
		await updatedRow.getByRole("button", { name: "Eliminar" }).click();

		// Verify deletion
		await expect(page.locator("text=Test User Updated")).not.toBeVisible();
	});
});
