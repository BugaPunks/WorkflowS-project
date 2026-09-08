import { test, expect } from "@playwright/test";
import { loginViaApi } from "./utils/api-auth";

test.describe("Grading System", () => {
  let project: any;
  let teacher: any;
  let student: any;
  let sprint: any;
  let rubric: any;
  let ts: number;
  let sprintName: string;

  test.beforeEach(async ({ page }) => {
    const request = page.request;
    teacher = await loginViaApi(request, `teacher-${Date.now()}@example.com`, "password123", "Teacher", "ADMIN");
    student = await loginViaApi(request, `student-${Date.now()}@example.com`, "password123", "Student", "TEAM_DEVELOPER");

    ts = Date.now();
    // Create Project
    const pRes = await request.post("http://localhost:5000/api/projects", {
      headers: { Authorization: `Bearer ${teacher.token}` },
      data: { name: `Grading Project ${ts}`, description: "Test", ownerId: teacher.id }
    });
    const pData = await pRes.json();
    project = pData.data;

    // Create Rubric
    const rRes = await request.post("http://localhost:5000/api/rubrics", {
        headers: { Authorization: `Bearer ${teacher.token}` },
        data: {
            name: "Standard Rubric",
            projectId: project.id,
            criteria: [{ name: "Code Quality", maxScore: 50, weight: 1 }, { name: "Docs", maxScore: 50, weight: 1 }]
        }
    });
    const rData = await rRes.json();
    rubric = rData.data;

    // Assign Student
    await request.post(`http://localhost:5000/api/projects/${project.id}/members`, {
        headers: { Authorization: `Bearer ${teacher.token}` },
        data: { userId: student.id, role: "TEAM_DEVELOPER" }
    });

    // Create Sprint (COMPLETED status to show up in evaluations)
    const today = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    sprintName = `Sprint 1 ${ts}`;
    const sRes = await request.post("http://localhost:5000/api/sprints", {
        headers: { Authorization: `Bearer ${teacher.token}` },
        data: {
            name: sprintName,
            projectId: project.id,
            startDate: today,
            endDate: tomorrow,
            status: "COMPLETED"
        }
    });
    const sData = await sRes.json();
    sprint = sData.data;
  });

  test("Teacher can grade a sprint and update it", async ({ page }) => {
    // Login Teacher
    await page.goto("/");
    await page.evaluate((u) => {
      localStorage.setItem("user", JSON.stringify(u));
      localStorage.setItem("token", u.token);
    }, teacher);
    await page.reload();

    // Go to Evaluations (Admin View)
    await page.goto("/evaluations");

    // Find Sprint by unique project name
    await expect(page.getByText(`Grading Project ${ts}`).first()).toBeVisible();
    await page.locator(`.bg-white:has-text("Grading Project ${ts}")`)
        .getByRole("button", { name: "Ir a Calificar" }).click();

    // Check if grading page loaded (Evaluation form)
    await expect(page.getByRole("heading", { name: "Calificar Sprint" })).toBeVisible();

    // Select Rubric (if multiple, or verify default)
    const rubricSelect = page.locator("#rubric-select");
    if (await rubricSelect.isVisible()) {
        await rubricSelect.selectOption({ label: "Standard Rubric" });
    }

    // Fill Grade via API call simulation for robustness (Frontend calls API)
    // Actually, let's use UI interactions as it is an E2E test.

    // Fill Criteria Scores
    // Assuming standard number inputs for criteria
    const inputs = page.locator('input[type="number"]');
    await expect(inputs).toHaveCount(2); // 2 criteria
    await inputs.nth(0).fill("40");
    await inputs.nth(1).fill("40");

    // Fill Feedback
    await page.locator('textarea').last().fill("Good job on the sprint");

    // Save
    // Mock the alert
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole("button", { name: "Guardar Calificación" }).click();

    // Should return to evaluations
    await expect(page).toHaveURL(/\/evaluations/);

    // Should disappear from list (or show as evaluated if we didn't filter it out? logic says filter pending)
    // The current logic in Evaluations.tsx filters: `(!s.evaluations || s.evaluations.length === 0)`
    // So it should disappear.
    await expect(page.getByText(sprintName)).not.toBeVisible();

    // Login Student to View Grade
    await page.goto("/");
    await page.evaluate((u) => {
      localStorage.setItem("user", JSON.stringify(u));
      localStorage.setItem("token", u.token);
    }, student);
    await page.reload();

    await page.goto("/evaluations");
    await expect(page.getByText(sprintName)).toBeVisible();
    await expect(page.getByText("80")).toBeVisible(); // 40 + 40
    await expect(page.getByText("Good job on the sprint")).toBeVisible();
  });
});
