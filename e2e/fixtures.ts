export const TEST_USER = {
  email: process.env.TEST_EMAIL ?? 'test@textura.dev',
  password: process.env.TEST_PASSWORD ?? 'TestPass2026!',
};

export async function loginAs(
  page: import('@playwright/test').Page,
  email: string,
  password: string
) {
  // Clear cookies to ensure fresh login state
  await page.context().clearCookies();
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /login|登录/i }).click();
  // Wait for navigation away from /login
  let loginPageUrl = page.url();
  // Poll until URL changes from /login or timeout
  let maxAttempts = 40; // 40 * 500ms = 20s
  while (maxAttempts > 0) {
    await page.waitForTimeout(500);
    if (!page.url().includes('/login')) {
      return; // Successfully navigated away from login
    }
    maxAttempts--;
  }
  throw new Error(`Login timeout: still on /login after 20s`);
}
