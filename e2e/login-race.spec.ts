import { expect, test } from "@playwright/test";
import { TEST_PASSWORD } from "./utils/api-auth";

test.describe("Login Race Condition", () => {
	test("should redirect to dashboard immediately after login", async ({
		page,
		request,
	}) => {
		// Create user via API
		const email = `race_${Date.now()}@test.com`;
		const password = TEST_PASSWORD;
		await request.post("http://localhost:5000/api/auth/register", {
			data: { name: "Race User", email, password },
		});

		// Go to login
		await page.goto("/login");

		// Fill form
		await page.fill('input[name="email"]', email);
		await page.fill('input[name="password"]', password);
		await page.click('button[type="submit"]');

		// Expect redirect to root (Dashboard) without reload
		// We expect URL to change.
		await expect(page).toHaveURL("http://localhost:3000/");

		// Verify we are authenticated: the role-specific panel heading is rendered.
		// Use the module list heading to avoid matching the role panel too.
		await expect(
			page.getByRole("heading", { name: /^Módulos del panel$/ }),
		).toBeVisible();
		await expect(page.getByTestId("panel-desarrollador")).toBeVisible();
	});
});
