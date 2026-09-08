import { test, expect } from "@playwright/test";
import { loginViaApi } from "./utils/api-auth";

test.describe("Task Creation with Assignment", () => {
  let project: any;
  let sprint: any;
  let userStory: any;

  test.beforeEach(async ({ page }) => {
    // 1. API Auth
    const request = page.request;
    const user = await loginViaApi(request, `user-${Date.now()}@example.com`, "password123", "Task User", "ADMIN");

    // 2. Set Session in Browser
    await page.goto("/");
    await page.evaluate((u) => {
      localStorage.setItem("user", JSON.stringify(u));
      localStorage.setItem("token", u.token!);
    }, user);
    // Reload to apply session
    await page.reload();

    // 3. Setup Data via API
    // Create Project
    const pRes = await request.post("http://localhost:5000/api/projects", {
      headers: { Authorization: `Bearer ${user.token}` },
      data: { name: `Project-${Date.now()}`, description: "Test Project", ownerId: user.id }
    });
    const pData = await pRes.json();
    project = pData.data;

    // Create Sprint
    const sRes = await request.post("http://localhost:5000/api/sprints", {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        name: "Sprint 1",
        projectId: project.id,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString()
      }
    });
    const sData = await sRes.json();
    sprint = sData.data;

    // Create User Story
    const usRes = await request.post("http://localhost:5000/api/user-stories", {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        title: "Test User Story",
        description: "As a user...",
        projectId: project.id,
        priority: "MEDIUM"
      }
    });
    const usData = await usRes.json();
    userStory = usData.data;
  });

  test("should create a task assigned to a Sprint and User Story", async ({ page }) => {
    // Navigate to Tasks page
    await page.goto("/tasks");

    // Open Modal
    await page.getByRole("button", { name: "+ Nueva Tarea" }).click();

    // Fill Form
    await page.fill('input[placeholder="Título de la tarea"]', "Integrated Task");

    // Select Project
    await page.selectOption("#task-project", project.id);

    // Wait for dynamic fields (Sprint and Story) to appear
    await expect(page.locator("#task-sprint")).toBeVisible();
    await expect(page.locator("#task-story")).toBeVisible();

    // Select Sprint and Story
    await page.selectOption("#task-sprint", sprint.id);
    await page.selectOption("#task-story", userStory.id);

    await page.fill('textarea[placeholder="Descripción de la tarea"]', "This task is linked.");

    // Submit
    await page.getByRole("button", { name: "Crear" }).click();

    // Verify it appears in "Mis Tareas"
    await expect(page.getByText("Integrated Task")).toBeVisible();

    // Verify it appears in the Sprint Board
    await page.goto(`/sprints/${sprint.id}`);

    // Check if task is visible in Sprint Board
    await expect(page.getByText("Integrated Task")).toBeVisible();
  });
});
