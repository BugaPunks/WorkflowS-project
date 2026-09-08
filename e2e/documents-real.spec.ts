import { test, expect } from "@playwright/test";
import { loginViaApi } from "./utils/api-auth";
import fs from "node:fs";
import path from "node:path";

test.describe("Document Management", () => {
  let project: any;
  let user: any;

  test.beforeEach(async ({ page }) => {
    // 1. Create User & Project
    const request = page.request;
    user = await loginViaApi(request, `doc-user-${Date.now()}@example.com`, "password123", "Doc Admin", "ADMIN");

    // Auth session
    await page.goto("/");
    await page.evaluate((u) => {
      localStorage.setItem("user", JSON.stringify(u));
      localStorage.setItem("token", u.token);
    }, user);
    await page.reload();

    const pRes = await request.post("http://localhost:5000/api/projects", {
      headers: { Authorization: `Bearer ${user.token}` },
      data: { name: "Docs Project", description: "Testing uploads", ownerId: user.id }
    });
    const pData = await pRes.json();
    project = pData.data;
  });

  test("should upload a file and see it in the list", async ({ page }) => {
    await page.goto(`/projects/${project.id}`);

    // Switch to Docs tab
    await page.getByRole("button", { name: "Documentos" }).click();

    // Create a dummy file
    const filePath = path.resolve("test-doc.txt");
    fs.writeFileSync(filePath, "This is a test document content.");

    // Click upload
    await page.getByText("+ Subir Archivo").click();

    // Fill file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    // Submit
    await page.getByRole("button", { name: "Subir", exact: true }).click();

    // Verify it appears (auto-retry)
    await expect(page.getByText("test-doc.txt")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("TXT")).toBeVisible(); // Type inferred

    // Clean up
    fs.unlinkSync(filePath);
  });
});
