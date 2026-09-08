import { test, expect } from "@playwright/test";
import { loginViaApi } from "./utils/api-auth";

test.describe("Extended Notifications", () => {
  let project: any;
  let userA: any;
  let userB: any;

  test.beforeEach(async ({ page }) => {
    // 1. Create User A (Admin/Owner)
    const request = page.request;
    userA = await loginViaApi(request, `admin-${Date.now()}@example.com`, "password123", "Admin User", "ADMIN");

    // 2. Create User B (Target)
    // Create User B
    const bEmail = `target-${Date.now()}@example.com`;
    const bRes = await request.post("http://localhost:5000/api/auth/register", {
        headers: { Authorization: `Bearer ${userA.token}` },
        data: { name: "Target User", email: bEmail, password: "password123", role: "TEAM_DEVELOPER" }
    });
    const bData = await bRes.json();
    userB = bData.user;

    // 3. Create Project by User A
    // We need to set up the request context to be authenticated as User A?
    // The backend currently DOES NOT enforce auth on routes (no middleware yet), it just trusts input/logic.
    // Except it might need IDs.

    const pRes = await request.post("http://localhost:5000/api/projects", {
      headers: { Authorization: `Bearer ${userA.token}` },
      data: { name: `Project-Notif-${Date.now()}`, description: "Test Notif", ownerId: userA.id }
    });
    const pData = await pRes.json();
    project = pData.data;
  });

  test("should receive notification when assigned to a project", async ({ page }) => {
    // 1. Assign User B to Project (Action by Admin)
    await page.request.post(`http://localhost:5000/api/projects/${project.id}/members`, {
        headers: { Authorization: `Bearer ${userA.token}` },
        data: { userId: userB.id, role: "TEAM_DEVELOPER" }
    });

    // 2. Login as User B to check notifications
    await page.goto("/");
    await page.evaluate((u) => {
      localStorage.setItem("user", JSON.stringify(u));
    }, userB);
    await page.reload();

    // 3. Check Notification
    // Open bell
    // await page.getByRole("button", { name: /notifications/i }).click(); // Selector might need adjustment
    // Or check endpoint
    const notifRes = await page.request.get(`http://localhost:5000/api/notifications?userId=${userB.id}`, {
        headers: { Authorization: `Bearer ${userA.token}` }
    });
    const notifData = await notifRes.json();
    const hasProjectNotif = notifData.data.some((n: any) => n.title === "Nuevo Proyecto Asignado");

    expect(hasProjectNotif).toBeTruthy();
  });
});
