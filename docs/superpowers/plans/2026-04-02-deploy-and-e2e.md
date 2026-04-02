# Deploy & E2E Smoke Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将本地所有未推送的提交部署到 https://textura.dev.canbee.cn，运行 DB 迁移补齐缺失的 migration，修复 Dockerfile `.next/cache` 权限问题，然后在 r730xd 上对关键页面写 Playwright E2E smoke tests。

**Architecture:**
1. **DB Migration** — 通过 r730xd 上的 Supabase Postgres 容器直接执行两条 pending migration SQL
2. **Dockerfile Fix** — 在 runner stage 添加 `.next/cache` 目录并设置正确 owner，消除 `EACCES` 错误
3. **Deploy** — `git push origin main` 触发 Coolify webhook 自动构建部署，轮询直到 finished
4. **E2E Tests** — 在 r730xd 上安装 Playwright，针对 `https://textura.dev.canbee.cn` 编写登录 + 四个功能页面的 smoke tests

**Tech Stack:** Next.js 16, Playwright, Coolify API (MCP), Prisma migrations, Docker

**Test environment:** r730xd (100.66.51.75), 测试目标 https://textura.dev.canbee.cn

---

### Task 1: 补齐 DB Migrations

**Problem:** 生产 DB `_prisma_migrations` 只有 `20260330231304_init`，本地有两条 pending migration 未执行：
- `20260401120000_add_credits_transactions_model3d`
- `20260401120001_add_credits_check_constraint`

**Files:**
- Read: `prisma/migrations/20260401120000_add_credits_transactions_model3d/migration.sql`
- Read: `prisma/migrations/20260401120001_add_credits_check_constraint/migration.sql`

- [ ] **Step 1: 执行完整第一条 migration（ALTER + CREATE TABLE + INDEX + FK）**

通过 heredoc 将完整 SQL 传入 r730xd 的 postgres 容器。注意 `model_3d_generations` 列定义需与实际 schema 完全一致：

```bash
ssh dev-r730xd "docker exec -i supabase-db-g897l1hkypcjd5ed2unqf87l psql -U supabase_admin -d postgres" << 'EOSQL'
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "credits" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "generations" ADD COLUMN IF NOT EXISTS "group_id" TEXT;
ALTER TABLE "generations" ADD COLUMN IF NOT EXISTS "mode" TEXT;
ALTER TABLE "generations" ADD COLUMN IF NOT EXISTS "scene_params" JSONB;

CREATE TABLE IF NOT EXISTS "transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "type" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "description" TEXT,
    "payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "model_3d_generations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "user_id" UUID NOT NULL,
    "mode" TEXT NOT NULL,
    "furniture_type" TEXT NOT NULL,
    "dimensions" JSONB NOT NULL,
    "credit_cost" INTEGER NOT NULL,
    "input_image_url" TEXT NOT NULL,
    "enhanced_image_url" TEXT,
    "enhanced_image_2_url" TEXT,
    "enhance_count" INTEGER NOT NULL DEFAULT 0,
    "feedback" TEXT,
    "tripo_task_id" TEXT,
    "tripo_result_url" TEXT,
    "tripo_expires_at" TIMESTAMP(3),
    "model_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'enhancing',
    "idempotency_key" TEXT,
    "share_hash" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "model_3d_generations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_tx_org" ON "transactions"("organization_id", "created_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "model_3d_generations_tripo_task_id_key" ON "model_3d_generations"("tripo_task_id");
CREATE UNIQUE INDEX IF NOT EXISTS "model_3d_generations_idempotency_key_key" ON "model_3d_generations"("idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "model_3d_generations_share_hash_key" ON "model_3d_generations"("share_hash");
CREATE INDEX IF NOT EXISTS "idx_m3d_user" ON "model_3d_generations"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_m3d_org" ON "model_3d_generations"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_m3d_status" ON "model_3d_generations"("status");
CREATE INDEX IF NOT EXISTS "idx_m3d_share" ON "model_3d_generations"("share_hash");
CREATE INDEX IF NOT EXISTS "idx_gen_group" ON "generations"("group_id");

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "model_3d_generations" ADD CONSTRAINT "model_3d_generations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EOSQL
```

Expected: `ALTER TABLE` × 5, `CREATE TABLE` × 2, `CREATE INDEX` × 9, `ALTER TABLE` × 2（全部无 ERROR）

- [ ] **Step 2: 验证表已创建**

```bash
ssh dev-r730xd "docker exec supabase-db-g897l1hkypcjd5ed2unqf87l psql -U supabase_admin -d postgres -c \"\\dt transactions model_3d_generations\" 2>&1"
```

Expected: 两张表都列出

- [ ] **Step 3: 添加 credits 非负约束**

- [ ] **Step 4: 添加 credits 非负约束（第二条 migration）**

```bash
ssh dev-r730xd "docker exec supabase-db-g897l1hkypcjd5ed2unqf87l psql -U supabase_admin -d postgres -c \"ALTER TABLE organizations ADD CONSTRAINT chk_credits_non_negative CHECK (credits >= 0);\" 2>&1"
```

Expected: `ALTER TABLE`（若约束已存在会报错 `already exists`，可忽略）

- [ ] **Step 5: 在 _prisma_migrations 中登记两条 migration 记录**

```bash
ssh dev-r730xd "docker exec supabase-db-g897l1hkypcjd5ed2unqf87l psql -U supabase_admin -d postgres -c \"
INSERT INTO _prisma_migrations (id, checksum, started_at, finished_at, migration_name, logs, rolled_back_at, applied_steps_count)
VALUES
  (gen_random_uuid(), 'manual', NOW(), NOW(), '20260401120000_add_credits_transactions_model3d', NULL, NULL, 1),
  (gen_random_uuid(), 'manual', NOW(), NOW(), '20260401120001_add_credits_check_constraint', NULL, NULL, 1)
ON CONFLICT (migration_name) DO NOTHING;
\" 2>&1"
```

Expected: `INSERT 0 2` 或 `INSERT 0 0`（已存在时）

- [ ] **Step 6: 验证**

```bash
ssh dev-r730xd "docker exec supabase-db-g897l1hkypcjd5ed2unqf87l psql -U supabase_admin -d postgres -c \"SELECT migration_name FROM _prisma_migrations ORDER BY finished_at;\""
```

Expected: 3 行（init + 2 新增）

---

### Task 2: 修复 Dockerfile `.next/cache` 权限

**Problem:** 生产日志显示 `EACCES: permission denied, mkdir '/app/.next/cache'`。Dockerfile runner stage 未为 `nextjs` 用户创建 `.next/cache` 目录。

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: 在 Dockerfile runner stage 添加 .next/cache 目录创建**

在 `RUN mkdir -p /app/public/generated && chown nextjs:nodejs /app/public/generated` 这行之后，`USER nextjs` 之前，添加：

```dockerfile
RUN mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app/.next
```

完整修改后的 Dockerfile runner stage 末尾应为：

```dockerfile
# Create directory for generated images
RUN mkdir -p /app/public/generated && chown nextjs:nodejs /app/public/generated

# Fix .next/cache permissions for nextjs user
RUN mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app/.next

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

- [ ] **Step 2: Commit**

```bash
git add Dockerfile
git commit -m "fix: create .next/cache dir with correct owner in Docker runner stage"
```

---

### Task 3: Push & 触发 Coolify 部署

**Files:** none (git push only)

- [ ] **Step 1: Push 到 main**

```bash
git push origin main
```

Expected: `Branch 'main' set up to track remote branch 'main'` 或 `Everything up-to-date`，push 成功

- [ ] **Step 2: 触发 Coolify 部署**

通过 Coolify MCP 触发 deploy：

```
mcp__coolify__deploy: { tag_or_uuid: "my35aqyvoe8divxtt9d5bnft" }
```

Expected: 返回 deployment UUID

- [ ] **Step 3: 轮询部署状态直到终态**

每 15 秒查一次，最多等 10 分钟：

```
mcp__coolify__deployment: { action: "list_for_app", uuid: "my35aqyvoe8divxtt9d5bnft" }
```

取最新部署的 `status`，期望值为 `finished`。若 `failed` 或 `cancelled` 则查 logs 排查。

- [ ] **Step 4: 验证部署**

```bash
curl -s -o /dev/null -w "%{http_code}" https://textura.dev.canbee.cn/
```

Expected: `200`

---

### Task 4: 在 r730xd 上搭建 Playwright 测试环境

**Files:**
- Create: `e2e/smoke.spec.ts`
- Create: `playwright.config.ts`
- Modify: `package.json` (add test script)

- [ ] **Step 1: 安装 Playwright**

```bash
npm install --save-dev @playwright/test
```

- [ ] **Step 2: 创建 playwright.config.ts**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.TEST_BASE_URL ?? 'https://textura.dev.canbee.cn',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

- [ ] **Step 3: 添加 test script 到 package.json**

在 `"scripts"` 中添加：

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 4: Commit placeholder**

```bash
git add playwright.config.ts package.json
git commit -m "chore: add playwright config for e2e tests"
```

---

### Task 5: E2E Smoke Tests — 登录流程

**Files:**
- Create: `e2e/smoke.spec.ts`
- Create: `e2e/fixtures.ts`

测试凭证使用测试账号（需要提前在 https://textura.dev.canbee.cn 注册）。测试账号：`test@textura.dev` / `TestPass2026!`

- [ ] **Step 1: 创建 e2e/fixtures.ts**

```typescript
export const TEST_USER = {
  email: process.env.TEST_EMAIL ?? 'test@textura.dev',
  password: process.env.TEST_PASSWORD ?? 'TestPass2026!',
};

export async function loginAs(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|登录/i }).click();
  // Wait for redirect to /my/retexture or /onboarding
  await page.waitForURL(/\/(my|onboarding)/, { timeout: 10000 });
}
```

- [ ] **Step 2: 创建 e2e/smoke.spec.ts — 登录**

```typescript
import { test, expect } from '@playwright/test';
import { loginAs, TEST_USER } from './fixtures';

test.describe('Auth', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('login with valid credentials', async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    // Should be on /my/ page after login
    await expect(page).toHaveURL(/\/my\//);
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill('wrong-password-xyz');
    await page.getByRole('button', { name: /sign in|登录/i }).click();
    await expect(page.getByText(/invalid|error|incorrect|密码/i)).toBeVisible({ timeout: 5000 });
  });
});
```

- [ ] **Step 3: 在 r730xd 上运行单个测试验证环境**

在 r730xd 上：

```bash
ssh dev-r730xd "cd <textura-repo-path> && npx playwright install chromium --with-deps && TEST_BASE_URL=https://textura.dev.canbee.cn npx playwright test e2e/smoke.spec.ts -g 'login page loads' --reporter=list 2>&1"
```

Expected: `1 passed`

- [ ] **Step 4: 若无本地 repo，在 r730xd 上 clone**

```bash
ssh dev-r730xd "git clone git@github.com:alexlee2046/textura.git /home/alex/textura-tests && cd /home/alex/textura-tests && npm ci && npx playwright install chromium --with-deps"
```

若 repo 已存在则 `git pull`

---

### Task 6: E2E Smoke Tests — 四个功能页面

**Files:**
- Modify: `e2e/smoke.spec.ts`

- [ ] **Step 1: 添加 retexture 页面 smoke test**

在 `e2e/smoke.spec.ts` 末尾添加：

```typescript
test.describe('Retexture page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    await page.goto('/my/retexture');
  });

  test('page loads with upload area', async ({ page }) => {
    await expect(page).toHaveURL(/\/my\/retexture/);
    // Upload area or fabric selector should be visible
    await expect(page.locator('[data-testid="image-upload"], input[type="file"], .upload-area').first()).toBeVisible({ timeout: 8000 });
  });

  test('fabric selector loads materials', async ({ page }) => {
    // FabricSelector fetches from /api/my/materials/series - wait for it to load
    await expect(page.getByRole('button', { name: /fabric|material|面料/i }).first()).toBeVisible({ timeout: 10000 });
  });
});
```

- [ ] **Step 2: 添加 scene 页面 smoke test**

```typescript
test.describe('Scene composition page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    await page.goto('/my/scene');
  });

  test('page loads with step 1 product upload', async ({ page }) => {
    await expect(page).toHaveURL(/\/my\/scene/);
    // Step 1 should show product upload UI
    await expect(page.locator('input[type="file"], [data-testid="product-upload"]').first()).toBeVisible({ timeout: 8000 });
  });
});
```

- [ ] **Step 3: 添加 orthographic 页面 smoke test**

```typescript
test.describe('Orthographic drawing page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    await page.goto('/my/orthographic');
  });

  test('page loads', async ({ page }) => {
    await expect(page).toHaveURL(/\/my\/orthographic/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 8000 });
  });
});
```

- [ ] **Step 4: 添加 multi-fabric 页面 smoke test**

```typescript
test.describe('Multi-fabric comparison page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    await page.goto('/my/multi-fabric');
  });

  test('page loads with upload area', async ({ page }) => {
    await expect(page).toHaveURL(/\/my\/multi-fabric/);
    await expect(page.locator('input[type="file"], [data-testid="image-upload"]').first()).toBeVisible({ timeout: 8000 });
  });
});
```

- [ ] **Step 5: 添加 credits API smoke test**

```typescript
test.describe('Credits API', () => {
  test('credits endpoint returns balance after login', async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    const response = await page.request.get('/api/credits');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(typeof body.credits).toBe('number');
  });
});
```

- [ ] **Step 6: Commit all e2e tests**

```bash
git add e2e/ playwright.config.ts package.json
git commit -m "test: add Playwright e2e smoke tests for auth and 4 feature pages"
```

---

### Task 7: 在 r730xd 上运行全量 E2E Tests

- [ ] **Step 1: 在 r730xd 上 pull 最新代码**

```bash
ssh dev-r730xd "cd /home/alex/textura-tests && git pull origin main"
```

- [ ] **Step 2: 创建测试账号（若不存在）**

登录 https://textura.dev.canbee.cn 手动注册 `test@textura.dev` / `TestPass2026!`，或通过 Supabase 直接创建：

```bash
ssh dev-r730xd "docker exec supabase-auth-g897l1hkypcjd5ed2unqf87l \
  sh -c \"curl -s -X POST http://localhost:9999/admin/users \
    -H 'Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3NDkxMTY2MCwiZXhwIjo0OTMwNTg1MjYwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.CJrb_mAlnJZAbmsTmG3a3b7PxNiZf_5EkrSqNTUuy04' \
    -H 'Content-Type: application/json' \
    -d '{\\\"email\\\":\\\"test@textura.dev\\\",\\\"password\\\":\\\"TestPass2026!\\\",\\\"email_confirm\\\":true}' 2>&1\""
```

Expected: user created JSON 或 `already exists`

- [ ] **Step 3: 运行全量 E2E tests**

```bash
ssh dev-r730xd "cd /home/alex/textura-tests && TEST_BASE_URL=https://textura.dev.canbee.cn npx playwright test --reporter=list 2>&1"
```

Expected: 所有测试 `passed`，无 `failed`

- [ ] **Step 4: 处理失败（若有）**

若页面选择器不匹配，查看 screenshot：

```bash
ssh dev-r730xd "ls /home/alex/textura-tests/test-results/" 2>/dev/null
```

根据截图调整选择器，不得使用永久 `test.skip()`

- [ ] **Step 5: Push 修复后的 tests**

```bash
git add e2e/
git commit -m "fix: adjust e2e selectors based on actual UI"
git push origin main
```

---

## 总结

执行完成后：
- ✅ DB 已有所有 3 条 migrations
- ✅ Dockerfile 无 `.next/cache` 权限错误
- ✅ https://textura.dev.canbee.cn 运行最新代码
- ✅ r730xd 上 E2E smoke tests 全部通过，覆盖 login + 4 功能页面
