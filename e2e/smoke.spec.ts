import { test, expect } from '@playwright/test';
import { loginAs, TEST_USER } from './fixtures';

test.describe('Auth', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('login with valid credentials', async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    await expect(page).toHaveURL(/\/my\//);
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(TEST_USER.email);
    await page.locator('input[type="password"]').fill('wrong-password-xyz');
    await page.getByRole('button', { name: /login|登录/i }).click();
    await expect(
      page.getByText(/invalid|error|incorrect|密码|邮箱/i)
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Retexture page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    await page.goto('/my/retexture');
  });

  test('page loads with upload area', async ({ page }) => {
    await expect(page).toHaveURL(/\/my\/retexture/);
    await expect(
      page
        .locator(
          '[data-testid="image-upload"], input[type="file"], .upload-area'
        )
        .first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('fabric selector loads materials', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /fabric|material|面料/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Scene composition page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    await page.goto('/my/scene');
  });

  test('page loads with step 1 product upload', async ({ page }) => {
    await expect(page).toHaveURL(/\/my\/scene/);
    await expect(
      page
        .locator('input[type="file"], [data-testid="product-upload"]')
        .first()
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Orthographic drawing page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    await page.goto('/my/orthographic');
  });

  test('page loads', async ({ page }) => {
    await expect(page).toHaveURL(/\/my\/orthographic/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({
      timeout: 8000,
    });
  });
});

test.describe('Multi-fabric comparison page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    await page.goto('/my/multi-fabric');
  });

  test('page loads with upload area', async ({ page }) => {
    await expect(page).toHaveURL(/\/my\/multi-fabric/);
    await expect(
      page.locator('input[type="file"], [data-testid="image-upload"]').first()
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Credits API', () => {
  test('credits endpoint returns balance after login', async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    const response = await page.request.get('/api/credits');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(typeof body.credits).toBe('number');
  });
});
