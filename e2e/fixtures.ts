export const TEST_USER = {
  email: process.env.TEST_EMAIL ?? 'test@textura.dev',
  password: process.env.TEST_PASSWORD ?? 'TestPass2026!',
};

export async function loginAs(
  page: import('@playwright/test').Page,
  email: string,
  password: string
) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /login|登录/i }).click();
  // Wait for redirect to /my/* or /onboarding
  await page.waitForURL(/\/(my|onboarding)/, { timeout: 10000 });
}
