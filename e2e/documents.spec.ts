import { test, expect } from "@playwright/test";
import { loginViaApi, injectBrowserSession, TEST_PASSWORD } from "./utils/api-auth";

test.describe("Document Management", () => {
	let projectId: string;
	let docToken: string | null;

	test.beforeAll(async ({ request }) => {
		// 1. Create a project to attach documents to
		// Login as Admin to ensure permissions
		const { id: userId, token } = await loginViaApi(
			request,
			`admin_docs_${Date.now()}@test.com`,
			TEST_PASSWORD,
			"AdminDocs",
			"ADMIN",
		);

		const projectRes = await request.post("/api/projects", {
			headers: { Authorization: `Bearer ${token}` },
			data: {
				name: "Document Test Project",
				description: "Testing docs",
				ownerId: userId,
			},
		});
		const projectData = await projectRes.json();
		projectId = projectData.id || projectData.data?.id;
	});

	test.beforeEach(async ({ page, request }) => {
		const user = await loginViaApi(
			request,
			`admin_docs_${Date.now()}@test.com`,
			TEST_PASSWORD,
			"AdminDocs",
			"ADMIN",
		);
		docToken = user.token;

		// Set cookie + localStorage (sesión real)
		await injectBrowserSession(
			page,
			{ id: user.id, email: user.email, name: user.name, role: user.role },
			user.token,
		);

		await page.goto(`/projects/${projectId}`);
		// Navigate to Documents tab
		await page.click("text=Documentos");
	});

	test("should upload a new document", async ({ page }) => {
		// Click upload button
		await page.click("text=+ Subir Archivo");

		// Upload file in modal
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: "test-doc.txt",
			mimeType: "text/plain",
			buffer: Buffer.from("Hello World"),
		});

		// Wait for modal to be visible and stable
		const modal = page.locator('.fixed.inset-0.z-50');
		await expect(modal).toBeVisible();

		// Click the submit button specifically inside the modal
		// The button text is "Subir" (or "Subiendo..." if clicked)
		// We use a strict selector to avoid matching the "+ Subir Archivo" button behind
		await modal.locator('button:has-text("Subir")').click();

		// Verify document appears in list
		await expect(page.locator("text=test-doc.txt")).toBeVisible();
	});

	test("should upload a new version of an existing document", async ({ page }) => {
		// 1. Ensure a doc exists (reuse flow or create via API)
		// The API requires multipart form for uploads, which Playwright request can handle but it's cleaner to simulate upload or skip strict check if test fails.
		// However, we can use the UI to upload first if API is tricky without file.
		// Or construct multipart request.

		const buffer = Buffer.from('test content');
		await page.request.post(`/api/documents/${projectId}`, {
			headers: { Authorization: `Bearer ${docToken}` },
			multipart: {
				file: {
					name: 'version-test.txt',
					mimeType: 'text/plain',
					buffer: buffer
				}
			}
		});

		await page.reload();
		await page.click("text=Documentos");

		// Find the document card
		const docCard = page.locator(".border.rounded-lg").filter({ hasText: "version-test.txt" });
		await expect(docCard).toBeVisible();

		// Click "Nueva Versión"
		await docCard.locator("text=+ Nueva Versión").click();

		// Upload new version file
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: "version-test-v2.txt",
			mimeType: "text/plain",
			buffer: Buffer.from("Version 2 Content"),
		});

		// Wait for modal
		const modal = page.locator('.fixed.inset-0.z-50');
		await expect(modal).toBeVisible();

		// Click the submit button specifically inside the modal
		await modal.locator('button:has-text("Subir")').click();

		// Verify V2 badge
		const badge = docCard.locator("text=V2");
		await expect(badge).toBeVisible();
	});

	test("should view version history", async ({ page }) => {
		// 1. Create doc and version 2 via API
		const buffer1 = Buffer.from('v1');
		const res = await page.request.post(`/api/documents/${projectId}`, {
			headers: { Authorization: `Bearer ${docToken}` },
			multipart: {
				file: {
					name: 'history-test.txt',
					mimeType: 'text/plain',
					buffer: buffer1
				}
			}
		});
		const doc = await res.json();
		const docId = doc.id;

		const buffer2 = Buffer.from('v2');
		await page.request.post(`/api/documents/${docId}/versions`, {
			headers: { Authorization: `Bearer ${docToken}` },
			multipart: {
				file: {
					name: 'history-test.txt',
					mimeType: 'text/plain',
					buffer: buffer2
				}
			}
		});

		await page.reload();
		await page.click("text=Documentos");

		const docCard = page.locator(".border.rounded-lg").filter({ hasText: "history-test.txt" });

		// Click History
		await docCard.locator("text=Historial").click();

		// Verify History Panel
		await expect(page.locator("text=Historial de Versiones")).toBeVisible();
		await expect(page.locator("text=Versión 2")).toBeVisible();
		await expect(page.locator("text=Versión 1")).toBeVisible();
	});
});
