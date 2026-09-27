import { test, expect } from '@playwright/test';
import { TEST_PASSWORD } from './utils/api-auth';

test.describe('Login Race Condition', () => {
  test('should redirect to dashboard immediately after login', async ({ page, request }) => {
    // Create user via API
    const email = `race_${Date.now()}@test.com`;
    const password = TEST_PASSWORD;
    await request.post('http://localhost:5000/api/auth/register', {
      data: { name: 'Race User', email, password }
    });

    // Go to login
    await page.goto('/login');

    // Fill form
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Expect redirect to root (Dashboard) without reload
    // We expect URL to change.
    await expect(page).toHaveURL("http://localhost:3000/");

    // Verify we are authenticated (e.g. welcome header visible)
    // The exact text depends on the new Dashboard logic, usually "Bienvenido Race User"
    await expect(page.getByText('Bienvenido, Race User')).toBeVisible();
  });
});
