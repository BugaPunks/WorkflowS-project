import { test, expect } from "@playwright/test";
import { loginViaApi, TEST_PASSWORD } from "./utils/api-auth";

test.describe("Rubrics and Grading Flow", () => {
	test("should create a global rubric and grade a task", async ({ page }) => {
		// 1. Login as Admin (Docente)
		const { id: userId, token } = await loginViaApi(page, `rubric_admin_${Date.now()}@test.com`, TEST_PASSWORD, "Rubric Admin", "ADMIN");
		console.log('Logged in user:', userId);

		// 2. Create a Global Rubric
		await page.goto("/rubrics");

		// Wait for button and click
		await page.click("text=Nueva Rúbrica Global");

		const rubricName = `Rubrica Global ${Date.now()}`;
		await page.fill("#rubric-name", rubricName);
		await page.fill("#rubric-desc", "Rúbrica de prueba creada por E2E");

		// Fill criteria 1
		await page.locator('input[id^="criterion-name-"]').first().fill("Calidad de Código");

		await page.click("text=Crear Rúbrica");

		// Wait for modal to close
		await expect(page.locator("text=Crear Nueva Rúbrica")).not.toBeVisible();

		// Verify it appears. reload if needed?
		// It should appear automatically.
		await expect(page.locator(`text=${rubricName}`)).toBeVisible();

		// 3. Create a Project (to have tasks)
		const projectName = `Project For Grading ${Date.now()}`;
		console.log('Creating project with owner:', userId);
		const projectRes = await page.request.post("/api/projects", {
			headers: { Authorization: `Bearer ${token}` },
			data: {
				name: projectName,
				description: "Testing grading flow",
				ownerId: userId
			}
		});
		const projectData = await projectRes.json();
		if (!projectRes.ok()) {
			console.log('Create Project Failed:', projectData);
		}
		const projectId = projectData.id || projectData.data?.id;
		// If project creation fails or structure is different, log it
		if (!projectId) console.log("Project ID missing in", projectData);

		// 4. Create a Task via API
		const taskTitle = `Task to Grade ${Date.now()}`;
		const taskRes = await page.request.post("/api/tasks", {
			headers: { Authorization: `Bearer ${token}` },
			data: {
				projectId,
				title: taskTitle,
				description: "This needs grading",
				priority: "HIGH"
			}
		});
		if (!taskRes.ok()) {
			console.log("Create Task Failed:", await taskRes.json());
		}
		expect(taskRes.ok()).toBeTruthy();
		const taskData = await taskRes.json();
		// Tasks endpoint returns the object directly, not wrapped in data
		const taskId = taskData.id || taskData.data?.id;

		// 5. Navigate to Task Grading directly
		await page.goto(`/projects/${projectId}/tasks/${taskId}/grade`);

		// 6. Grade the task
		// Check if rubric is selected (Global rubric should be available)
		await expect(page.locator("text=Rúbrica de Evaluación")).toBeVisible();

		// Wait for select to populate
		const rubricSelect = page.locator("select");
		await expect(async () => {
			const count = await rubricSelect.locator("option").count();
			expect(count).toBeGreaterThan(0);
		}).toPass();

		// Select our rubric if not selected
		// We select by label text matching our rubric name
		const option = rubricSelect.locator(`option:has-text("${rubricName}")`);
		if (await option.count() > 0) {
			const val = await option.getAttribute("value");
			if (val) await rubricSelect.selectOption(val);
		}

		await expect(page.locator("text=Calidad de Código")).toBeVisible();

		// Enter score
		const scoreInput = page.locator('input[type="number"]').first();
		await scoreInput.fill("8");

		// Enter feedback
		// Use specific selectors to avoid ambiguity or strict mode issues
		// Assuming first textarea is for the criterion
		const feedbackInput = page.locator('textarea').first();
		await feedbackInput.fill("Good job");

		// Enter overall feedback (last textarea)
		const overallFeedback = page.locator('textarea').last();
		await overallFeedback.fill("Overall good");

		// Save
		page.on('dialog', dialog => dialog.accept());
		await page.click('button:has-text("Guardar Calificación")');

		// Verify redirection
		// Since we used direct navigation (history push), navigate(-1) should go back to the previous page (/rubrics)
		// This confirms the grading was successful and navigation occurred.
		await page.waitForURL(/\/rubrics$/);
	});
});
