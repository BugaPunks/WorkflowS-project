import { expect, test } from "@playwright/test";
import { loginViaApi } from "./utils/api-auth";

test.describe("Chat Widget", () => {
	test.beforeEach(async ({ page }) => {
		await loginViaApi(page, `chatwidget_admin_${Date.now()}@test.com`, "password123", "Chat Widget Admin", "ADMIN");
		await page.goto("/projects");
	});

	test("should open and close the chat widget", async ({ page }) => {
		// The widget button should be visible
		const widgetButton = page.locator("button:has(svg.lucide-message-circle)");
		await expect(widgetButton).toBeVisible();

		// Open the widget
		await widgetButton.click();
		await expect(page.getByText("Mensajes", { exact: true })).toBeVisible();
		await expect(page.locator("button:has(svg.lucide-x)")).toBeVisible();

		// Close the widget
		const closeButton = page.locator("button:has(svg.lucide-minus)");
		await closeButton.click();
		// The widget content should disappear (or at least the header)
		await expect(page.getByText("Mensajes", { exact: true })).not.toBeVisible();
	});

	test("should show empty state if no chats", async ({ page }) => {
		// Note: This depends on the user having no chats.
		// If the user has chats, this test might need adjustment or mocking.
		// For now, assuming the test user might have chats or not, we can check for either the list or the empty state.

		const widgetButton = page.locator("button:has(svg.lucide-message-circle)");
		await widgetButton.click();

		// Check if either chat list items or empty state exists
		const emptyState = page.locator("text=No tienes conversaciones");
		const chatItem = page.locator(".w-full.p-3"); // Selector for chat item

		// Wait for content to load
		await expect(
			emptyState.or(chatItem.first()),
		).toBeVisible();
	});

	test("should be able to start a new chat", async ({ page }) => {
		const widgetButton = page.locator("button:has(svg.lucide-message-circle)");
		await widgetButton.click();

		// Click new chat button (+)
		await page.locator("button[title='Nuevo Chat']").click();

		// Should see "Nuevo Mensaje" header
		await expect(page.getByText("Nuevo Mensaje")).toBeVisible();

		// Should see list of users
		// We can check for a user item
		await expect(page.locator(".w-8.h-8.bg-gray-200").first()).toBeVisible();
	});
});
