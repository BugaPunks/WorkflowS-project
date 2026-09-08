import { expect, test } from "@playwright/test";
import { loginViaApi } from "./utils/api-auth";

test.describe("Retrospective Board", () => {
	let projectId: string;
	let _sprintId: string;

	test.beforeEach(async ({ page, request }) => {
		// 1. Login as Admin to setup
		const { id: retroId, token: retroToken } = await loginViaApi(page, request, `admin_retro_${Date.now()}@test.com`, "ADMIN");

		// 2. Create Project
		const timestamp = Date.now();
		const _projectRes = await request.post(
			"http://localhost:5000/api/projects",
			{
				headers: { Authorization: `Bearer ${retroToken}` },
				data: {
					name: `Retro Project ${timestamp}`,
					description: "Test for Retrospectives",
					ownerId: retroId,
				},
			},
		);
	});

	// Refined setup using the returned userId
	test("Should allow adding and deleting retrospective items", async ({
		page,
		request,
	}) => {
		const { id: userId, token } = await loginViaApi(
			page,
			request,
			`scrum_master_${Date.now()}@test.com`,
			"ADMIN",
		);

		// Create Project
		const timestamp = Date.now();
		const projectRes = await request.post(
			"http://localhost:5000/api/projects",
			{
				headers: { Authorization: `Bearer ${token}` },
				data: {
					name: `Retro Project ${timestamp}`,
					description: "Test",
					ownerId: userId,
				},
			},
		);
		const projectData = await projectRes.json();
		projectId = projectData.id || projectData.data?.id;

		// Create Sprint (Required for Retro)
		const sprintRes = await request.post("http://localhost:5000/api/sprints", {
			headers: { Authorization: `Bearer ${token}` },
			data: {
				projectId,
				name: "Sprint 1",
				startDate: new Date().toISOString(),
				endDate: new Date(Date.now() + 86400000).toISOString(),
			},
		});
		const sprintData = await sprintRes.json();
		_sprintId = sprintData.id || sprintData.data?.id;

		// Navigate to Project -> Retro
		await page.goto(`/projects/${projectId}`);
		await page.waitForLoadState('networkidle');

		// Wait for button with timeout
		const retroBtn = page.getByRole("button", { name: "Retrospectiva" });
		await expect(retroBtn).toBeVisible({ timeout: 10000 });
		await retroBtn.click();

		// 1. Add "Good" Item
		await page.getByRole("button", { name: "+ Añadir Nota" }).first().click();
		await page.fill("textarea", "Great Teamwork");
		const postGood = page.waitForResponse(
			(resp) => resp.url().includes("/api/retrospectives") && resp.request().method() === "POST",
		);
		await page.getByRole("button", { name: "Añadir", exact: true }).click();
		await postGood;
		await expect(page.getByText("Great Teamwork")).toBeVisible();

		// 2. Add "Bad" Item (Second column)
		await page.getByRole("button", { name: "+ Añadir Nota" }).nth(1).click();
		await page.fill("textarea", "Server Downtime");
		const postBad = page.waitForResponse(
			(resp) => resp.url().includes("/api/retrospectives") && resp.request().method() === "POST",
		);
		await page.getByRole("button", { name: "Añadir", exact: true }).click();
		await postBad;
		await expect(page.getByText("Server Downtime")).toBeVisible();

		// 3. Reload to verify persistence
		await page.reload();
		await page.getByRole("button", { name: "Retrospectiva" }).click();

		await expect(page.getByText("Great Teamwork")).toBeVisible();
		await expect(page.getByText("Server Downtime")).toBeVisible();

		// 4. Delete Item
		page.on("dialog", (dialog) => dialog.accept()); // Handle confirm alert
		// Use specific class to avoid matching parent containers
		await page
			.locator(".bg-white.shadow-sm")
			.filter({ hasText: "Great Teamwork" })
			.getByRole("button", { name: "×" })
			.click();
		await expect(page.getByText("Great Teamwork")).not.toBeVisible();
	});
});
