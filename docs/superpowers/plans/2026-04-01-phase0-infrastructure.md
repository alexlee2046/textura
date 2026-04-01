# Phase 0: 基础设施层 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 textura 建立组织级积分系统、API 鉴权守卫、三级回退存储、OpenRouter 客户端等基础设施，为后续 5 个功能模块迁入做准备。

**Architecture:** 在 textura 现有 Prisma schema 上新增 `credits`/`plan` 字段到 Organization，新建 `Transaction` 和 `Model3DGeneration` 表。新建 `api-guard.ts` 为 API Route 提供鉴权（与已有的 `dal.ts` 并存）。升级 `storage.ts` 为 Supabase → COS → Local 三级回退。

**Tech Stack:** Prisma 7.6, Supabase Auth (SSR), sharp, cos-nodejs-sdk-v5, Next.js 16 API Routes

**Source project:** `/Users/alex/Develop/Elastron/fabric-switcher/`
**Target project:** `/Users/alex/Develop/Elastron/textura/`

---

### Task 1: Prisma Schema — 扩展 Organization + Generation

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 在 Organization 模型中添加 credits 和 plan 字段**

在 `prisma/schema.prisma` 的 `Organization` 模型中，在 `settings` 行之后添加：

```prisma
  credits     Int      @default(20)
  plan        String   @default("free")
```

同时在 Organization 的 relations 块末尾（`inquiries` 之后）添加：

```prisma
  model3DGenerations Model3DGeneration[]
  transactions       Transaction[]
```

- [ ] **Step 2: 在 Generation 模型中添加 mode, groupId, sceneParams 字段**

在 `Generation` 模型中，`creditCost` 行之后添加：

```prisma
  mode             String?
```

在 `shareHash` 行之后添加：

```prisma
  groupId          String?  @map("group_id")
  sceneParams      Json?    @map("scene_params")
```

在最后一个 `@@index` 之后（`@@map` 之前）添加：

```prisma
  @@index([groupId], map: "idx_gen_group")
```

- [ ] **Step 3: 验证 schema 语法**

Run: `cd /Users/alex/Develop/Elastron/textura && npx prisma validate`
Expected: `✔ Your Prisma schema is valid`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: extend Organization with credits/plan, Generation with mode/groupId/sceneParams"
```

---

### Task 2: Prisma Schema — 新建 Transaction 表

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 在 schema.prisma 末尾（AuditLog 之前）添加 Transaction 模型**

```prisma
model Transaction {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid
  userId         String?  @map("user_id") @db.Uuid
  type           String
  credits        Int
  balanceAfter   Int      @map("balance_after")
  description    String?
  paymentId      String?  @map("payment_id")
  createdAt      DateTime @default(now()) @map("created_at")

  organization Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId, createdAt(sort: Desc)], map: "idx_tx_org")
  @@map("transactions")
}
```

- [ ] **Step 2: 验证 schema**

Run: `cd /Users/alex/Develop/Elastron/textura && npx prisma validate`
Expected: `✔ Your Prisma schema is valid`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Transaction model for org-level credit tracking"
```

---

### Task 3: Prisma Schema — 新建 Model3DGeneration 表

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 在 Transaction 模型之后添加 Model3DGeneration**

```prisma
model Model3DGeneration {
  id                String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId    String?   @map("organization_id") @db.Uuid
  userId            String    @map("user_id") @db.Uuid
  mode              String
  furnitureType     String    @map("furniture_type")
  dimensions        Json
  creditCost        Int       @map("credit_cost")
  inputImageUrl     String    @map("input_image_url")
  enhancedImageUrl  String?   @map("enhanced_image_url")
  enhancedImage2Url String?   @map("enhanced_image_2_url")
  enhanceCount      Int       @default(0) @map("enhance_count")
  feedback          String?
  tripoTaskId       String?   @unique @map("tripo_task_id")
  tripoResultUrl    String?   @map("tripo_result_url")
  tripoExpiresAt    DateTime? @map("tripo_expires_at")
  modelUrl          String?   @map("model_url")
  status            String    @default("enhancing")
  idempotencyKey    String?   @unique @map("idempotency_key")
  shareHash         String?   @unique @map("share_hash")
  submittedAt       DateTime? @map("submitted_at")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @default(now()) @updatedAt @map("updated_at")

  organization Organization? @relation(fields: [organizationId], references: [id])

  @@index([userId, createdAt(sort: Desc)], map: "idx_m3d_user")
  @@index([organizationId], map: "idx_m3d_org")
  @@index([status], map: "idx_m3d_status")
  @@index([shareHash], map: "idx_m3d_share")
  @@map("model_3d_generations")
}
```

- [ ] **Step 2: 验证 schema**

Run: `cd /Users/alex/Develop/Elastron/textura && npx prisma validate`
Expected: `✔ Your Prisma schema is valid`

- [ ] **Step 3: 运行迁移**

Run: `cd /Users/alex/Develop/Elastron/textura && npx prisma migrate dev --name add_credits_transactions_model3d`
Expected: Migration applied successfully, Prisma Client generated.

- [ ] **Step 4: 添加数据库级 credits 非负约束**

在刚生成的 migration 目录中找到 SQL 文件，然后创建一个新的 migration：

Run: `cd /Users/alex/Develop/Elastron/textura && mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_add_credits_check_constraint`

创建 `prisma/migrations/<timestamp>_add_credits_check_constraint/migration.sql`：

```sql
ALTER TABLE "organizations" ADD CONSTRAINT "chk_credits_non_negative" CHECK ("credits" >= 0);
```

然后运行：`npx prisma migrate dev --name add_credits_check_constraint`

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: add Model3DGeneration table, run migration for credits/transactions/model3d"
```

---

### Task 4: 扩展 constants.ts — 积分和生成类型常量

**Files:**
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: 在 constants.ts 末尾添加新常量**

在文件末尾（`MemberRole` type 之后）追加：

```typescript
export const GENERATION_TYPE = {
  RETEXTURE: "retexture",
  SCENE: "scene",
  MULTI_FABRIC: "multi_fabric",
  ORTHOGRAPHIC: "orthographic",
} as const;

export type GenerationType =
  (typeof GENERATION_TYPE)[keyof typeof GENERATION_TYPE];

export const GENERATION_MODE = {
  STANDARD: "standard",
  PRO: "pro",
  ULTRA: "ultra",
  GEMINI_DIRECT: "gemini-direct",
  GEMINI_31_DIRECT: "gemini-3.1-direct",
  FLUX_GEMINI: "flux-gemini",
} as const;

export const CREDIT_COST = {
  retexture_standard: 2,
  retexture_pro: 4,
  multi_fabric_pro: 4,
  multi_fabric_ultra: 8,
  scene_standard: 2,
  scene_pro: 4,
  scene_enhance: 5,
  orthographic_standard: 4,
  orthographic_pro: 8,
  model3d_quick: 18,
  model3d_precision: 28,
  model3d_enhance_retry: 3,
} as const;

export const AI_MODELS = {
  GEMINI_25_FLASH_IMAGE: "google/gemini-2.5-flash-image",
  GEMINI_31_FLASH_IMAGE: "google/gemini-3.1-flash-image-preview",
  GEMINI_3_PRO_IMAGE: "google/gemini-3-pro-image-preview",
  FLUX_2_PRO: "black-forest-labs/flux.2-pro",
} as const;

export const TRANSACTION_TYPE = {
  GENERATION_DEDUCT: "generation_deduct",
  GENERATION_REFUND: "generation_refund",
  PURCHASE: "purchase",
  ADMIN_ADJUST: "admin_adjust",
} as const;

export const ORG_PLAN = {
  FREE: "free",
  PRO: "pro",
  ENTERPRISE: "enterprise",
} as const;
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd /Users/alex/Develop/Elastron/textura && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to constants.ts

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat: add generation type, credit cost, AI model, and transaction constants"
```

---

### Task 5: 新建 api-guard.ts — API Route 鉴权守卫

**Files:**
- Create: `src/lib/api-guard.ts`

- [ ] **Step 1: 创建 api-guard.ts**

```typescript
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { MEMBER_STATUS, type MemberRole } from "@/lib/constants";

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const forbidden = () =>
  NextResponse.json({ error: "Forbidden" }, { status: 403 });

const insufficientCredits = () =>
  NextResponse.json({ error: "INSUFFICIENT_CREDITS" }, { status: 402 });

export type ApiAuthResult = { userId: string };

export type ApiOrgAuthResult = {
  userId: string;
  orgId: string;
  orgSlug: string;
  role: MemberRole;
};

export type ApiCreditResult = ApiOrgAuthResult & { orgCredits: number };

/** Require authenticated user (no org context). */
export async function requireAuth(): Promise<ApiAuthResult | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();
  return { userId: user.id };
}

/** Require authenticated user with active org membership. */
export async function requireOrgAuth(): Promise<
  ApiOrgAuthResult | NextResponse
> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const member = await prisma.organizationMember.findFirst({
    where: { userId: auth.userId, status: MEMBER_STATUS.ACTIVE },
    include: { organization: { select: { id: true, slug: true } } },
    orderBy: { joinedAt: "asc" },
  });

  if (!member) return forbidden();

  return {
    userId: auth.userId,
    orgId: member.organizationId,
    orgSlug: member.organization.slug,
    role: member.role as MemberRole,
  };
}

/** Require org auth + minimum credits. */
export async function requireOrgWithCredits(
  minCredits: number,
): Promise<ApiCreditResult | NextResponse> {
  const orgAuth = await requireOrgAuth();
  if (orgAuth instanceof NextResponse) return orgAuth;

  const org = await prisma.organization.findUnique({
    where: { id: orgAuth.orgId },
    select: { credits: true },
  });

  if (!org || org.credits < minCredits) return insufficientCredits();

  return { ...orgAuth, orgCredits: org.credits };
}

/** Require platform admin. */
export async function requireAdmin(): Promise<ApiAuthResult | NextResponse> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const admin = await prisma.adminUser.findUnique({
    where: { userId: auth.userId, isActive: true },
  });

  if (!admin) return forbidden();
  return auth;
}
```

- [ ] **Step 2: 验证 TypeScript**

Run: `cd /Users/alex/Develop/Elastron/textura && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to api-guard.ts

- [ ] **Step 3: Commit**

```bash
git add src/lib/api-guard.ts
git commit -m "feat: add API route auth guards (requireAuth, requireOrgAuth, requireOrgWithCredits, requireAdmin)"
```

---

### Task 6: 新建 credits.ts — 组织级积分操作

**Files:**
- Create: `src/lib/credits.ts`

- [ ] **Step 1: 创建 credits.ts**

```typescript
import { prisma } from "@/lib/prisma";
import { TRANSACTION_TYPE } from "@/lib/constants";

/**
 * Atomically deduct credits from an organization and write an audit Transaction row.
 * Returns the new balance, or `null` if insufficient credits.
 */
export async function deductOrgCredits(
  orgId: string,
  userId: string,
  cost: number,
  description: string,
): Promise<number | null> {
  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: orgId, credits: { gte: cost } },
        data: { credits: { decrement: cost } },
        select: { credits: true },
      });

      await tx.transaction.create({
        data: {
          organizationId: orgId,
          userId,
          type: TRANSACTION_TYPE.GENERATION_DEDUCT,
          credits: -cost,
          balanceAfter: updated.credits,
          description,
        },
      });

      return updated.credits;
    });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2025") return null;
    throw e;
  }
}

/**
 * Atomically refund credits to an organization and write an audit Transaction row.
 * Returns the new balance.
 */
export async function refundOrgCredits(
  orgId: string,
  userId: string,
  amount: number,
  reason: string,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.organization.update({
      where: { id: orgId },
      data: { credits: { increment: amount } },
      select: { credits: true },
    });

    await tx.transaction.create({
      data: {
        organizationId: orgId,
        userId,
        type: TRANSACTION_TYPE.GENERATION_REFUND,
        credits: amount,
        balanceAfter: updated.credits,
        description: reason,
      },
    });

    return updated.credits;
  });
}
```

- [ ] **Step 2: 验证 TypeScript**

Run: `cd /Users/alex/Develop/Elastron/textura && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/credits.ts
git commit -m "feat: add org-level credit deduction and refund with atomic transactions"
```

---

### Task 7: 新建 openrouter.ts — OpenRouter API 客户端

**Files:**
- Create: `src/lib/openrouter.ts`

- [ ] **Step 1: 创建 openrouter.ts**

```typescript
export const OPENROUTER_CHAT_URL =
  "https://openrouter.ai/api/v1/chat/completions";

export function openRouterHeaders(): HeadersInit {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  return {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://localhost:3000",
  };
}

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Call OpenRouter chat completions endpoint.
 * Returns the raw Response on success; throws on HTTP error or timeout.
 */
export async function callOpenRouter(
  body: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: openRouterHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`OpenRouter request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("OpenRouter API Error:", resp.status, errText);
    throw new Error(`OpenRouter error ${resp.status}: ${errText}`);
  }

  return resp;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/openrouter.ts
git commit -m "feat: add OpenRouter API client with timeout support"
```

---

### Task 8: 新建 rate-limit.ts — 内存限流器

**Files:**
- Create: `src/lib/rate-limit.ts`

- [ ] **Step 1: 创建 rate-limit.ts**

```typescript
const counters = new Map<string, { count: number; resetAt: number }>();

const CLEANUP_INTERVAL = 5 * 60_000;
let lastCleanup = Date.now();

function maybeCleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of counters) {
    if (now > entry.resetAt) counters.delete(key);
  }
}

/**
 * Simple in-memory per-key rate limiter.
 * Returns true if the request is allowed, false if rate-limited.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number = 60_000,
): boolean {
  const now = Date.now();
  maybeCleanup(now);

  const entry = counters.get(key);

  if (!entry || now > entry.resetAt) {
    counters.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/rate-limit.ts
git commit -m "feat: add in-memory rate limiter"
```

---

### Task 9: 新建 image-utils.ts — 图片验证和优化

**Files:**
- Create: `src/lib/image-utils.ts`

- [ ] **Step 1: 创建 image-utils.ts**

```typescript
import sharp from "sharp";

const ALLOWED_FORMATS = new Set([
  "jpeg",
  "png",
  "webp",
  "gif",
  "tiff",
  "avif",
  "heif",
]);

/**
 * Validate that a buffer contains an actual image via sharp metadata.
 * Throws if the buffer is not a recognized image format.
 */
export async function validateImageBuffer(buffer: Buffer): Promise<void> {
  const metadata = await sharp(buffer).metadata();
  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new Error(`Invalid image format: ${metadata.format ?? "unknown"}`);
  }
}

/**
 * Resize and compress an image for OpenRouter API payloads.
 * Max 2048x2048, JPEG quality 85. Prevents ECONNRESET on large base64 inputs.
 */
export async function optimizeForOpenRouter(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/image-utils.ts
git commit -m "feat: add image validation and OpenRouter optimization utils"
```

---

### Task 10: 升级 storage.ts — 三级回退存储

**Files:**
- Modify: `src/lib/storage.ts`
- Create: `src/lib/supabase-storage.ts`
- Create: `src/lib/cos-storage.ts`

- [ ] **Step 1: 创建 supabase-storage.ts**

```typescript
import { createAdminClient } from "@/lib/supabase/admin";

export const isSupabaseStorageConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = "textura";

export async function uploadToSupabase(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const supabase = createAdminClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, buffer, { contentType, upsert: false });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return data.publicUrl;
}
```

- [ ] **Step 2: 创建 cos-storage.ts**

```typescript
import COS from "cos-nodejs-sdk-v5";

const SECRET_ID = process.env.COS_SECRET_ID;
const SECRET_KEY = process.env.COS_SECRET_KEY;
const BUCKET = process.env.COS_BUCKET;
const REGION = process.env.COS_REGION ?? "ap-guangzhou";
const CDN_DOMAIN = process.env.COS_CDN_DOMAIN;

export const isCosConfigured = !!(SECRET_ID && SECRET_KEY && BUCKET);

let client: COS | null = null;

function getCos(): COS {
  if (!client) {
    client = new COS({ SecretId: SECRET_ID!, SecretKey: SECRET_KEY! });
  }
  return client;
}

function cosUrl(key: string): string {
  return CDN_DOMAIN
    ? `https://${CDN_DOMAIN}/${key}`
    : `https://${BUCKET}.cos.${REGION}.myqcloud.com/${key}`;
}

export async function uploadToCos(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  if (!isCosConfigured) {
    throw new Error("COS not configured");
  }

  await new Promise<void>((resolve, reject) => {
    getCos().putObject(
      {
        Bucket: BUCKET!,
        Region: REGION,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      },
      (err) =>
        err
          ? reject(new Error(`COS upload failed: ${err.message}`))
          : resolve(),
    );
  });

  return cosUrl(key);
}
```

- [ ] **Step 3: 替换 storage.ts 内容为三级回退版本**

将 `src/lib/storage.ts` 的全部内容替换为：

```typescript
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { nanoid } from "nanoid";
import sharp from "sharp";
import {
  isSupabaseStorageConfigured,
  uploadToSupabase,
} from "./supabase-storage";
import { isCosConfigured, uploadToCos } from "./cos-storage";

const GENERATED_DIR = join(process.cwd(), "public", "generated");

const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "avif",
  "svg",
]);
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

/**
 * Save a base64 data URL image. Converts to WebP, quality 85.
 * Storage priority: Supabase → COS → Local filesystem.
 */
export async function saveBase64Image(base64Url: string): Promise<string> {
  const commaIdx = base64Url.indexOf(",");
  const rawBuffer = Buffer.from(
    commaIdx === -1 ? base64Url : base64Url.slice(commaIdx + 1),
    "base64",
  );
  const webpBuffer = await sharp(rawBuffer).webp({ quality: 85 }).toBuffer();
  const filename = `${nanoid(12)}.webp`;

  if (isSupabaseStorageConfigured) {
    return uploadToSupabase(`results/${filename}`, webpBuffer, "image/webp");
  }
  if (isCosConfigured) {
    return uploadToCos(`results/${filename}`, webpBuffer, "image/webp");
  }

  const dir = join(GENERATED_DIR, "results");
  await ensureDir(dir);
  await writeFile(join(dir, filename), webpBuffer);
  return `/generated/results/${filename}`;
}

/**
 * Save an uploaded File preserving original format.
 * Validates extension and file size. Used for logos, QR codes, material swatches.
 * Storage priority: Supabase → COS → Local filesystem.
 */
export async function saveUploadedFile(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error("File too large (max 10 MB)");
  }

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File type .${ext} not allowed`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${nanoid(12)}.${ext}`;
  const contentType = file.type || "application/octet-stream";

  if (isSupabaseStorageConfigured) {
    return uploadToSupabase(`uploads/${filename}`, buffer, contentType);
  }
  if (isCosConfigured) {
    return uploadToCos(`uploads/${filename}`, buffer, contentType);
  }

  const dir = join(GENERATED_DIR, "uploads");
  await ensureDir(dir);
  await writeFile(join(dir, filename), buffer);
  return `/generated/uploads/${filename}`;
}

/**
 * Save an image buffer as WebP (quality 85). Used for AI generation inputs/outputs.
 * Storage priority: Supabase → COS → Local filesystem.
 */
export async function saveImageAsWebp(buffer: Buffer, subdir = "uploads"): Promise<string> {
  const webpBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
  const filename = `${nanoid(12)}.webp`;

  if (isSupabaseStorageConfigured) {
    return uploadToSupabase(`${subdir}/${filename}`, webpBuffer, "image/webp");
  }
  if (isCosConfigured) {
    return uploadToCos(`${subdir}/${filename}`, webpBuffer, "image/webp");
  }

  const dir = join(GENERATED_DIR, subdir);
  await ensureDir(dir);
  await writeFile(join(dir, filename), webpBuffer);
  return `/generated/${subdir}/${filename}`;
}

```

- [ ] **Step 4: 安装 cos-nodejs-sdk-v5 依赖**

Run: `cd /Users/alex/Develop/Elastron/textura && npm install cos-nodejs-sdk-v5`
Expected: added 1 package

- [ ] **Step 5: 验证 TypeScript**

Run: `cd /Users/alex/Develop/Elastron/textura && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage.ts src/lib/supabase-storage.ts src/lib/cos-storage.ts package.json package-lock.json
git commit -m "feat: upgrade storage to Supabase → COS → Local three-tier fallback"
```

---

### Task 11: 更新 /api/generate — 支持 quality 模式和组织积分

**Files:**
- Modify: `src/app/api/generate/route.ts`

- [ ] **Step 1: 重写 /api/generate/route.ts 支持 quality 参数和组织积分扣费**

将 `src/app/api/generate/route.ts` 的全部内容替换为：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { getOptionalUser } from "@/lib/dal";
import { requireOrgWithCredits, type ApiCreditResult } from "@/lib/api-guard";
import { saveBase64Image, saveImageAsWebp } from "@/lib/storage";
import { callOpenRouter } from "@/lib/openrouter";
import { deductOrgCredits, refundOrgCredits } from "@/lib/credits";
import { optimizeForOpenRouter } from "@/lib/image-utils";
import { getImageBuffer } from "@/lib/image-fetch";
import {
  MATERIAL_STATUS,
  AI_MODELS,
  CREDIT_COST,
  GENERATION_TYPE,
} from "@/lib/constants";

// Anonymous rate-limit: 1 generation per IP per 24 hours
const anonTracker = new Map<string, number>();
const ANON_WINDOW_MS = 24 * 60 * 60 * 1000;

function canAnonymousGenerate(ip: string): boolean {
  const lastTime = anonTracker.get(ip);
  if (!lastTime) return true;
  return Date.now() - lastTime > ANON_WINDOW_MS;
}

function recordAnonymousGeneration(ip: string) {
  anonTracker.set(ip, Date.now());
  if (anonTracker.size > 10_000) {
    const cutoff = Date.now() - ANON_WINDOW_MS;
    for (const [key, ts] of anonTracker) {
      if (ts < cutoff) anonTracker.delete(key);
    }
  }
}

async function addWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const svg = Buffer.from(`
    <svg width="200" height="40">
      <text x="0" y="30" font-size="24" font-family="sans-serif"
            fill="rgba(255,255,255,0.4)">Textura</text>
    </svg>
  `);
  return sharp(imageBuffer)
    .composite([{ input: svg, gravity: "southeast" }])
    .toBuffer();
}

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const clientIp =
      headersList.get("x-forwarded-for")?.split(",")[0].trim() ||
      headersList.get("x-real-ip") ||
      "unknown";

    const user = await getOptionalUser();
    const isAnonymous = !user;

    // Quality mode: standard (default, free for anon) or pro (requires auth + credits)
    const formData = await request.formData();
    let quality = (formData.get("quality") as string) || "standard";

    // Anonymous users are forced to standard mode (Pro uses expensive models)
    if (isAnonymous && quality === "pro") {
      quality = "standard";
    }
    const imageFile = formData.get("image") as File | null;
    const materialId = formData.get("material_id") as string | null;

    if (!imageFile || !materialId) {
      return NextResponse.json(
        { error: "Missing required fields: image and material_id" },
        { status: 400 },
      );
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (imageFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10 MB." },
        { status: 400 },
      );
    }

    // Determine model and cost
    const isPro = quality === "pro";
    const model = isPro
      ? AI_MODELS.GEMINI_31_FLASH_IMAGE
      : AI_MODELS.GEMINI_25_FLASH_IMAGE;
    const creditCost = isPro
      ? CREDIT_COST.retexture_pro
      : CREDIT_COST.retexture_standard;

    // Auth + credit check for logged-in users; anonymous rate-limit
    let orgAuth: ApiCreditResult | null = null;
    if (isAnonymous) {
      if (!canAnonymousGenerate(clientIp)) {
        return NextResponse.json(
          {
            error:
              "Anonymous users are limited to 1 generation per 24 hours. Please sign in for unlimited access.",
          },
          { status: 429 },
        );
      }
    } else {
      const result = await requireOrgWithCredits(creditCost);
      if (result instanceof NextResponse) return result;
      orgAuth = result;
    }

    // Look up material
    const material = await prisma.material.findUnique({
      where: {
        id: materialId,
        status: MATERIAL_STATUS.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        category: true,
        color: true,
        colorCode: true,
        seriesCode: true,
        promptModifier: true,
        organizationId: true,
        organization: { select: { slug: true } },
        images: { where: { isPrimary: true }, take: 1, select: { url: true } },
      },
    });

    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    const swatchUrl = material.images[0]?.url;
    if (!swatchUrl) {
      return NextResponse.json(
        { error: "Material has no primary image" },
        { status: 400 },
      );
    }

    // Convert images to base64
    const furnitureBuffer = await optimizeForOpenRouter(
      Buffer.from(await imageFile.arrayBuffer()),
    );
    const furnitureBase64 = furnitureBuffer.toString("base64");

    let swatchBuffer: Buffer;
    try {
      swatchBuffer = await getImageBuffer(swatchUrl);
    } catch {
      return NextResponse.json(
        { error: "Failed to fetch material swatch image" },
        { status: 502 },
      );
    }
    const swatchBase64 = swatchBuffer.toString("base64");
    const swatchMime = swatchUrl.endsWith(".png") ? "image/png" : "image/webp";

    // Build prompt
    const prompt = [
      "Image 1: furniture photo. Image 2: material swatch.",
      "Replace the main upholstery/surface material of the furniture with the material shown in Image 2.",
      "Scale the material's pattern to the furniture's real-world size.",
      "Adapt to scene lighting and viewing angle.",
      "Keep everything else unchanged.",
      "",
      `Material description: ${material.promptModifier}`,
    ].join("\n");

    // Deduct credits before API call (logged-in only)
    let creditsRemaining: number | null = null;
    if (orgAuth) {
      creditsRemaining = await deductOrgCredits(
        orgAuth.orgId,
        orgAuth.userId,
        creditCost,
        `Retexture ${quality}: ${material.name}`,
      );
      if (creditsRemaining === null) {
        return NextResponse.json(
          { error: "INSUFFICIENT_CREDITS" },
          { status: 402 },
        );
      }
    }

    // Call OpenRouter
    let data: Record<string, unknown>;
    try {
      const resp = await callOpenRouter({
        model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${furnitureBase64}`,
                },
              },
              {
                type: "image_url",
                image_url: { url: `data:${swatchMime};base64,${swatchBase64}` },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
        modalities: ["image", "text"],
      });
      data = (await resp.json()) as Record<string, unknown>;
    } catch (err) {
      console.error("OpenRouter API call failed:", err);
      // Refund on API failure
      if (orgAuth && creditsRemaining !== null) {
        await refundOrgCredits(
          orgAuth.orgId,
          orgAuth.userId,
          creditCost,
          `Refund: retexture API error`,
        );
      }
      throw new Error("AI generation failed. Please try again.");
    }

    const images = (
      data as {
        choices?: {
          message?: { images?: { image_url: { url: string } }[] };
        }[];
      }
    )?.choices?.[0]?.message?.images;

    if (!images || images.length === 0) {
      if (orgAuth && creditsRemaining !== null) {
        await refundOrgCredits(
          orgAuth.orgId,
          orgAuth.userId,
          creditCost,
          `Refund: no image returned`,
        );
      }
      throw new Error("No image returned from model");
    }

    // Post-process & save
    const resultBase64 = images[0].image_url.url;
    let resultBuffer = Buffer.from(
      resultBase64.includes(",") ? resultBase64.split(",")[1] : resultBase64,
      "base64",
    );

    if (isAnonymous) {
      resultBuffer = (await addWatermark(resultBuffer)) as Buffer<ArrayBuffer>;
    }

    const [inputImageUrl, resultImageUrl] = await Promise.all([
      saveImageAsWebp(Buffer.from(await imageFile.arrayBuffer())),
      saveBase64Image(
        `data:image/png;base64,${resultBuffer.toString("base64")}`,
      ),
    ]);

    const shareHash = nanoid(8);

    const materialSnapshot = {
      id: material.id,
      name: material.name,
      category: material.category,
      color: material.color,
      colorCode: material.colorCode,
      seriesCode: material.seriesCode,
      promptModifier: material.promptModifier,
      organizationId: material.organizationId,
      vendorSlug: material.organization.slug,
      swatchUrl,
    };

    await prisma.generation.create({
      data: {
        organizationId: orgAuth?.orgId ?? material.organizationId,
        userId: user?.userId ?? null,
        materialId: material.id,
        materialSnapshot,
        type: GENERATION_TYPE.RETEXTURE,
        mode: quality,
        creditCost: orgAuth ? creditCost : 0,
        modelUsed: model,
        inputImageUrl,
        resultImageUrl,
        shareHash,
      },
    });

    if (isAnonymous) {
      recordAnonymousGeneration(clientIp);
    }

    return NextResponse.json({
      success: true,
      imageUrl: resultImageUrl,
      shareHash,
      materialName: material.name,
      vendorSlug: material.organization.slug,
      creditsRemaining: creditsRemaining ?? undefined,
    });
  } catch (error: unknown) {
    console.error("Error in /api/generate:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: 验证 TypeScript**

Run: `cd /Users/alex/Develop/Elastron/textura && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/generate/route.ts
git commit -m "feat: upgrade /api/generate with quality modes (standard/pro), org-level credit deduction, and refund on failure"
```

---

### Task 12: 新建 /api/credits — 组织积分查询

**Files:**
- Create: `src/app/api/credits/route.ts`

- [ ] **Step 1: 创建积分查询 API**

```bash
mkdir -p /Users/alex/Develop/Elastron/textura/src/app/api/credits
```

创建 `src/app/api/credits/route.ts`：

```typescript
import { NextResponse } from "next/server";
import { requireOrgAuth } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireOrgAuth();
  if (auth instanceof NextResponse) return auth;

  const org = await prisma.organization.findUnique({
    where: { id: auth.orgId },
    select: { credits: true, plan: true },
  });

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  return NextResponse.json({
    credits: org.credits,
    plan: org.plan,
    orgId: auth.orgId,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/credits/route.ts
git commit -m "feat: add GET /api/credits for org credit balance"
```

---

### Task 13: 验证全量构建

**Files:** none (verification only)

- [ ] **Step 1: 运行 lint**

Run: `cd /Users/alex/Develop/Elastron/textura && npm run lint`
Expected: No errors

- [ ] **Step 2: 运行 build**

Run: `cd /Users/alex/Develop/Elastron/textura && npm run build`
Expected: Build succeeds. Watch for type errors or missing imports.

- [ ] **Step 3: 如果有错误，修复并 commit**

修复所有 lint/build 错误后：

```bash
git add -A
git commit -m "fix: resolve build errors from Phase 0 infrastructure"
```
