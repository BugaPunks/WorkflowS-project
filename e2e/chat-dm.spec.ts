import { test, expect } from '@playwright/test';

test.describe('Direct Messages', () => {
  test('should allow direct messaging between teacher and student', async ({ page, request }) => {
    // 1. Setup Users
    const timestamp = Date.now();
    // Create Teacher
    const teacherRes = await request.post('http://localhost:5000/api/auth/register', {
      data: { name: `Teacher Chat ${timestamp}`, email: `teacher_chat_${timestamp}@test.com`, password: 'password123', role: 'ADMIN' }
    });
    const teacherData = await teacherRes.json();
    const teacher = teacherData.user;
    const teacherToken = teacherData.token;

    // Create Student
    const studentRes = await request.post('http://localhost:5000/api/auth/register', {
      data: { name: `Student Chat ${timestamp}`, email: `student_chat_${timestamp}@test.com`, password: 'password123', role: 'TEAM_DEVELOPER' }
    });
    const studentData = await studentRes.json();
    const student = studentData.user;
    const studentToken = studentData.token;

    // 2. Teacher sends message
    // Login Teacher
    await page.goto('/'); // Load context
    await page.evaluate(({ user, token }) => { localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('token', token); }, { user: teacher, token: teacherToken });
    await page.goto('/projects');

    // Open Chat Widget
    await page.locator('button:has(svg.lucide-message-circle)').click();

    // Start DM
    await page.click('button[title="Nuevo Chat"]');
    await expect(page.getByText('Nuevo Mensaje')).toBeVisible();

    // Select Student
    // Wait for list
    await expect(page.getByText(student.name)).toBeVisible();
    await page.click(`text=${student.name}`);

    // Verify chat opened
    // Check header has Student Name
    await expect(page.getByRole('heading', { name: student.name })).toBeVisible();

    // Send Message
    await page.fill('input[placeholder="Mensaje..."]', 'Hello Student');
    await page.click('button[type="submit"]');

    await expect(page.getByText('Hello Student').last()).toBeVisible();

    // 3. Student replies
    // Login Student
    await page.evaluate(({ user, token }) => { localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('token', token); }, { user: student, token: studentToken });
    await page.reload();

    // Open chat widget again as it closes on reload
    await page.locator('button:has(svg.lucide-message-circle)').click();

    // Should see chat in list with Teacher Name
    await expect(page.getByText(teacher.name)).toBeVisible();
    await page.click(`text=${teacher.name}`);

    // See message
    await expect(page.getByText('Hello Student').last()).toBeVisible();

    // Reply
    await page.fill('input[placeholder="Mensaje..."]', 'Hello Teacher');
    await page.click('button[type="submit"]');
    await expect(page.getByText('Hello Teacher')).toBeVisible();
  });
});
