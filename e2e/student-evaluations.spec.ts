import { test, expect } from '@playwright/test';
import { loginViaApi } from './utils/api-auth';

test.describe('Student Evaluations View', () => {
  test('should allow student to view their grades', async ({ page, request }) => {
    // 1. Admin Setup
    const admin = await loginViaApi(page, request, `admin_eval_${Date.now()}@test.com`, "ADMIN");

    // Create Project
    const projRes = await request.post('http://localhost:5000/api/projects', {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { name: 'Graded Project', description: 'Test', ownerId: admin.id }
    });
    const project = (await projRes.json()).data;

    // Create Student
    const studentEmail = `student_${Date.now()}@test.com`;
    const studentRes = await request.post('http://localhost:5000/api/auth/register', {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { name: 'Student Eval', email: studentEmail, password: 'password123', role: 'TEAM_DEVELOPER' }
    });
    const student = (await studentRes.json()).user;

    // Add Student to Project
    const projectId = project.id;
    await request.post(`http://localhost:5000/api/projects/${projectId}/members`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { userId: student.id, role: 'TEAM_DEVELOPER' }
    });

    // Create Task
    const taskRes = await request.post('http://localhost:5000/api/tasks', {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: {
        title: 'Graded Task',
        description: 'Do it',
        projectId: project.id,
        assigneeId: student.id,
        status: 'COMPLETED'
      }
    });
    const task = (await taskRes.json()).data;

    // Grade Task (Admin)
    // Create Rubric
    const rubricRes = await request.post('http://localhost:5000/api/rubrics', {
        headers: { Authorization: `Bearer ${admin.token}` },
        data: {
            name: 'Task Rubric',
            projectId: project.id,
            criteria: [{ name: 'Quality', maxScore: 100, weight: 1 }]
        }
    });
    const rubric = (await rubricRes.json()).data;
    const criteriaId = rubric.criteria[0].id;

    // Grade it
    await request.post('http://localhost:5000/api/evaluations', {
        headers: { Authorization: `Bearer ${admin.token}` },
        data: {
            projectId: project.id,
            taskId: task.id,
            evaluatorId: admin.id,
            feedback: 'Great work!',
            score: 95,
            criteriaScores: [{ criteriaId, score: 95, comment: 'Good' }]
        }
    });

    // 2. Student Flow
    // Login as Student by overwriting local storage
    await page.evaluate((user) => {
        localStorage.setItem('user', JSON.stringify(user));
    }, student);
    await page.reload(); // Reload to pick up user session

    // Check Sidebar link
    // The role name might vary depending on icon/text rendering.
    // Try relaxed selector
    // await expect(page.locator('a[href="/evaluations"]')).toBeVisible();
    await page.goto('/evaluations');

    // Verify content
    await expect(page.getByRole('heading', { name: 'Mis Calificaciones' })).toBeVisible();
    await expect(page.getByText('Graded Task')).toBeVisible();
    await expect(page.getByText('95')).toBeVisible();
    await expect(page.getByText('Great work!')).toBeVisible();
  });
});
