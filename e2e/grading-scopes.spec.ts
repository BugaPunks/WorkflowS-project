import { test, expect } from '@playwright/test';
import { loginViaApi } from './utils/api-auth';

test.describe('Grading Scopes (Project & Sprint)', () => {
  let project: any;
  let sprint: any;
  let rubric: any;
  let adminUser: any;

  test.beforeEach(async ({ page, request }) => {
    // 1. Login
    adminUser = await loginViaApi(page, request, `grade_admin_${Date.now()}@test.com`, "ADMIN");

    // 2. Create Project
    const projRes = await request.post('http://localhost:5000/api/projects', {
      headers: { Authorization: `Bearer ${adminUser.token}` },
      data: {
        name: `Grading Project ${Date.now()}`,
        description: 'Testing grading scopes',
        ownerId: adminUser.id // Corrected from adminUser.userId to adminUser.id
      }
    });
    const projData = await projRes.json();
    project = projData.data || projData; // Handle both wrapped and unwrapped

    // 3. Create Sprint
    const sprintRes = await request.post('http://localhost:5000/api/sprints', {
      headers: { Authorization: `Bearer ${adminUser.token}` },
      data: {
        projectId: project.id,
        name: 'Sprint 1',
        description: 'First Sprint',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000 * 14).toISOString()
      }
    });
    const sprintData = await sprintRes.json();
    sprint = sprintData.data;

    // 4. Create Rubric (Project Specific)
    const rubricRes = await request.post('http://localhost:5000/api/rubrics', {
      headers: { Authorization: `Bearer ${adminUser.token}` },
      data: {
        name: 'General Grading Rubric',
        description: 'For testing',
        projectId: project.id,
        criteria: [
            { name: 'Quality', maxScore: 50, weight: 0.5 },
            { name: 'Timeliness', maxScore: 50, weight: 0.5 }
        ]
      }
    });
    rubric = (await rubricRes.json()).data;

    // Accept dialogs (alerts)
    page.on('dialog', dialog => dialog.accept());
  });

  test('should allow grading a Project', async ({ page }) => {
    await page.goto(`/projects/${project.id}`);

    // Find "Calificar Proyecto" button
    const gradeBtn = page.getByText('Calificar Proyecto');
    await expect(gradeBtn).toBeVisible();
    await gradeBtn.click();

    // Verify Grading View
    await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/grade`));
    await expect(page.getByRole('heading', { name: 'Calificar Proyecto Final' })).toBeVisible();
    await expect(page.getByText(project.name)).toBeVisible();

    // Select Rubric
    await page.selectOption('select#rubric-select', { label: rubric.name });

    // Fill scores
    const inputs = page.locator('input[type="number"]');
    await expect(inputs).toHaveCount(2);
    await inputs.first().fill('40');
    await inputs.last().fill('45');

    // Use getByLabel because there is a label "Feedback:" associated
    await page.getByLabel('Feedback:').first().fill('Good job');

    // Submit
    await page.click('button:has-text("Guardar Calificación")');

    // Expect redirection back to project
    await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
  });

  test('should allow grading a Sprint', async ({ page }) => {
    // Navigate to Project Detail (Sprints list)
    await page.goto(`/projects/${project.id}`);

    // Click "Calificar Sprint"
    // Since we created one sprint, we can look for the button inside the sprint section
    const sprintGradeBtn = page.getByText('Calificar Sprint');
    await expect(sprintGradeBtn).toBeVisible();
    await sprintGradeBtn.click();

    // Verify Grading View
    await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/sprints/${sprint.id}/grade`));
    await expect(page.getByRole('heading', { name: 'Calificar Sprint' })).toBeVisible();
    await expect(page.getByText(sprint.name)).toBeVisible();

    // Grade
    await page.selectOption('select#rubric-select', { label: rubric.name });
     // Fill scores
    const inputs = page.locator('input[type="number"]');
    await expect(inputs).toHaveCount(2);
    await inputs.first().fill('50');
    await inputs.last().fill('50');

    await page.click('button:has-text("Guardar Calificación")');

    // Check we are back
    await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
  });
});
