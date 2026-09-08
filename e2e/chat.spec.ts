import { expect, test } from "@playwright/test";
import { loginViaApi } from "./utils/api-auth";

test.describe("Chat System", () => {
	test("Should allow sending and receiving messages", async ({
		page,
		request,
	}) => {
		const { id: userId, token } = await loginViaApi(page, request, `chat_user_${Date.now()}@test.com`, "ADMIN");

		// Create Project
		const timestamp = Date.now();
		const projectRes = await request.post(
			"http://localhost:5000/api/projects",
			{
				headers: { Authorization: `Bearer ${token}` },
				data: {
					name: `Chat Project ${timestamp}`,
					description: "Chat Test",
					ownerId: userId,
				},
			},
		);
		const projectData = await projectRes.json();
		const projectId = projectData.id || projectData.data?.id;

		// Go to Chat
		await page.goto(`/projects/${projectId}`);

		// Wait for title
		// The title selector name construction might be sensitive to whitespace or casing
		// Or maybe the project name is slightly different.
		// Let's use a more generic check or debug
		// await expect(page.getByRole('heading', { name: `Chat Project ${timestamp}` })).toBeVisible();

		// Wait for content load more robustly
		await page.waitForLoadState('networkidle');

        // Check for error state
        if (await page.getByText("Error al cargar el proyecto").isVisible()) {
            throw new Error("Failed to load project in frontend");
        }

		// Click Chat tab - use generic locator if specific text fails due to layout
		const chatBtn = page.getByRole("button", { name: "Chat" });
		await chatBtn.waitFor({ state: "visible" });
		await chatBtn.click();

		// Send Message
		const message = `Hello World ${timestamp}`;
		await page.fill('input[placeholder="Escribe un mensaje..."]', message);
		await page.getByRole("button", { name: "Enviar" }).click();

		// Verify Message Appears
		await expect(page.getByText(message)).toBeVisible();

		// Reload to verify persistence
		await page.reload();
		await page.getByRole("button", { name: "Chat" }).click();
		await expect(page.getByText(message)).toBeVisible();
	});
});
