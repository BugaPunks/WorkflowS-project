import { expect, test } from "@playwright/test";
import {
	injectBrowserSession,
	loginViaApi,
	TEST_PASSWORD,
} from "./utils/api-auth";

test.describe("Chat Widget - Non-Admin User", () => {
	test("TEAM_DEVELOPER can start a DM and send a message", async ({
		page,
		request,
	}) => {
		const timestamp = Date.now();

		const teamDev = await loginViaApi(
			request,
			`dev_chat_${timestamp}@test.com`,
			TEST_PASSWORD,
			`Dev Chat ${timestamp}`,
			"TEAM_DEVELOPER",
		);

		const otherUser = await loginViaApi(
			request,
			`other_chat_${timestamp}@test.com`,
			TEST_PASSWORD,
			`Other Chat ${timestamp}`,
			"TEAM_DEVELOPER",
		);

		await page.goto("/");
		await injectBrowserSession(page, teamDev, teamDev.token);
		await page.goto("/projects");

		await page.locator("button:has(svg.lucide-message-circle)").click();

		await page.click('button[title="Nuevo Chat"]');
		await expect(page.getByText("Nuevo Mensaje")).toBeVisible();

		await expect(page.getByText(otherUser.name)).toBeVisible();
		await page.click(`text=${otherUser.name}`);

		await expect(
			page.getByRole("heading", { name: otherUser.name }),
		).toBeVisible();

		await page.fill('input[placeholder="Mensaje..."]', "Hello from non-admin");
		await page.click('button[type="submit"]');

		await expect(page.getByText("Hello from non-admin").last()).toBeVisible();
	});
});
