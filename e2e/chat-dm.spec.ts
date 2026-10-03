import { expect, test } from "@playwright/test";
import {
	injectBrowserSession,
	loginViaApi,
	TEST_PASSWORD,
} from "./utils/api-auth";

test.describe("Direct Messages", () => {
	test("should allow direct messaging between teacher and student", async ({
		page,
		request,
	}) => {
		// 1. Setup Users
		const timestamp = Date.now();
		// Create Teacher (register siempre crea TEAM_DEVELOPER; promover vía API admin)
		const teacher = await loginViaApi(
			request,
			`teacher_chat_${timestamp}@test.com`,
			TEST_PASSWORD,
			`Teacher Chat ${timestamp}`,
			"ADMIN",
		);
		const student = await loginViaApi(
			request,
			`student_chat_${timestamp}@test.com`,
			TEST_PASSWORD,
			`Student Chat ${timestamp}`,
			"TEAM_DEVELOPER",
		);

		// 2. Teacher sends message
		// Login Teacher
		await page.goto("/"); // Load context
		await injectBrowserSession(page, teacher, teacher.token);
		await page.goto("/projects");

		// Open Chat Widget
		await page.locator("button:has(svg.lucide-message-circle)").click();

		// Start DM
		await page.click('button[title="Nuevo Chat"]');
		await expect(page.getByText("Nuevo Mensaje")).toBeVisible();

		// Select Student
		// Wait for list
		await expect(page.getByText(student.name)).toBeVisible();
		await page.click(`text=${student.name}`);

		// Verify chat opened
		// Check header has Student Name
		await expect(
			page.getByRole("heading", { name: student.name }),
		).toBeVisible();

		// Send Message
		await page.fill('input[placeholder="Mensaje..."]', "Hello Student");
		await page.click('button[type="submit"]');

		await expect(page.getByText("Hello Student").last()).toBeVisible();

		// 3. Student replies
		// Login Student
		await injectBrowserSession(page, student, student.token);
		await page.reload();

		// Open chat widget again as it closes on reload
		await page.locator("button:has(svg.lucide-message-circle)").click();

		// Should see chat in list with Teacher Name
		await expect(page.getByText(teacher.name)).toBeVisible();
		await page.click(`text=${teacher.name}`);

		// See message
		await expect(page.getByText("Hello Student").last()).toBeVisible();

		// Reply
		await page.fill('input[placeholder="Mensaje..."]', "Hello Teacher");
		await page.click('button[type="submit"]');
		await expect(page.getByText("Hello Teacher")).toBeVisible();
	});
});
