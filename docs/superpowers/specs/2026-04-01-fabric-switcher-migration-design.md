# Fabric-Switcher → Textura 融合设计文档

**日期:** 2026-04-01
**目标:** 将 fabric-switcher 的全部 5 个功能模块迁移到 textura（多商户版）

---

## 核心定位

Textura = Fabric-Switcher 的多商户版。所有资源组织化，积分组织级钱包，材料库组织私有。

## 关键架构决策

| 决策项 | 方案 | 理由 |
|--------|------|------|
| 资源归属 | 全部组织化 | Generation/Credits/3D Model 全挂 Organization + userId（审计追踪） |
| 积分体系 | 组织级钱包 | 老板/财务统一购买，成员共用。原子扣费 `WHERE credits >= cost` |
| 材料库 | 组织私有库 | textura 已有 Material 模型，不做跨组织共享（材料是商户核心 IP） |
| 平台演示库 | 特殊组织 `textura-demo` | 匿名用户演示面料来源 |
| Auth | 以 textura 为准（Supabase SSR middleware） | 淘汰 client-side AuthProvider/AuthModal |
| State | Zustand 仅限 3D Viewer | 其他模块 useState 足够 |
| 存储 | Supabase Storage → COS → Local 三级回退 | 升级 textura 现有本地存储 |
| 分享 URL | 统一 `/s/[shareHash]` | 按 Generation.type 切换渲染 |
| 管理后台 | `/admin/*` 平台级 + `/dashboard/*` 组织级 | 两层分治 |

## 数据模型变更

### Organization 表扩展

```diff
 model Organization {
   ...
+  credits      Int      @default(20)
+  plan         String   @default("free")  // free | pro | enterprise
   ...
+  model3DGenerations Model3DGeneration[]
+  transactions      Transaction[]
 }
```

### Generation 表扩展

```diff
 model Generation {
   ...
+  mode             String?
+  groupId          String?  @map("group_id")
+  sceneParams      Json?    @map("scene_params")
   ...
+  @@index([groupId], map: "idx_gen_group")
 }
```

### 新建 Model3DGeneration 表

```prisma
model Model3DGeneration {
  id                String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId    String?   @map("organization_id") @db.Uuid
  userId            String    @map("user_id") @db.Uuid
  mode              String    // quick | precision
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

### 新建 Transaction 表

```prisma
model Transaction {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid
  userId         String?  @map("user_id") @db.Uuid
  type           String   // generation_deduct | generation_refund | purchase | admin_adjust
  credits        Int      // positive = add, negative = deduct
  balanceAfter   Int      @map("balance_after")
  description    String?
  paymentId      String?  @map("payment_id")
  createdAt      DateTime @default(now()) @map("created_at")

  organization Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId, createdAt(sort: Desc)], map: "idx_tx_org")
  @@map("transactions")
}
```

## API 鉴权

两层守卫并存：

- `dal.ts`（已有）— Server Components / Server Actions，redirect on failure
- `api-guard.ts`（新建）— API Routes，返回 NextResponse error

`api-guard.ts` 提供：`requireAuth()` → `requireOrgAuth()` → `requireOrgWithCredits(cost)` → `requireAdmin()`

## 目录结构

```
src/
├── app/
│   ├── (admin)/admin/           # 平台管理
│   ├── (app)/my/                # 用户工具区
│   │   ├── retexture/           # 面料换装
│   │   ├── multi-fabric/        # 多区域换装
│   │   ├── scene/               # 场景合成
│   │   ├── orthographic/        # 正射图
│   │   ├── viewer/              # 3D 查看器
│   │   └── generations/         # 历史记录
│   ├── (dashboard)/dashboard/   # 组织后台
│   │   ├── credits/             # 积分管理
│   │   ├── generations/         # 生成记录
│   │   └── tools/               # 工具入口
│   ├── (public)/
│   │   ├── s/[shareHash]/       # 统一分享页
│   │   └── v/[slug]/            # 商户展示页
│   └── api/                     # 按功能模块分
├── components/                  # 可复用 UI 组件
├── features/                    # 自包含功能模块
│   ├── scene/
│   ├── multi-fabric/
│   ├── orthographic/
│   └── viewer/                  # 40+ 组件 + drawing + shaders + worker
├── stores/viewer/               # Zustand（仅 viewer）
└── lib/                         # 工具函数
```

## 迁移路线图

```
Phase 0 — 基础设施（1-2天）
  Schema + api-guard + credits + storage + openrouter + rate-limit

Phase 1a — 面料换装增强（0.5天）
  Pro模式 + 组织级积分扣费

Phase 1b — 场景合成（1-2天）
  gemini-direct 模式 + 多步向导

Phase 1c — 正射图生成（1天）
  多图上传 + 技术图纸生成

Phase 2 — 多面料对比（1天）
  区域检测 + 批量换装

Phase 3 — 3D Viewer（2-3天）
  完整 viewer + stores + model3d API

Phase 4 — 辅助系统（1-2天）
  支付 + 分享 + Dashboard增强
```

## 成本分析

| 功能 | 模型 | API成本/次 | 积分 | 毛利率(最低档) |
|------|------|-----------|------|--------------|
| 换装-标准 | Gemini 2.5 Flash Image | ~$0.034 | 2 | 76% |
| 换装-Pro | Gemini 3.1 Flash Image | ~$0.067 | 4 | 76% |
| 多面料-Pro | Gemini 3.1 Flash Image | ~$0.067 | 4 | 76% |
| 多面料-Ultra | Gemini 3 Pro Image | ~$0.136 | 8 | 75% |
| 正射图-标准 | Gemini 3.1 Flash Image | ~$0.067 | 4 | 76% |
| 正射图-Pro | Gemini 3 Pro Image | ~$0.136 | 8 | 75% |
| 场景-基础 | Gemini 2.5 Flash Image | ~$0.034 | 2 | 76% |
| 场景-增强 | Gemini 2.5 Flash Image | ~$0.034 | 5 | 79% |
| 3D-Quick | Tripo API | ~$0.30 | 18 | 76% |
| 3D-Precision | Tripo API | ~$0.50 | 28 | 74% |

## 商业模式

SaaS 订阅（含基础额度）+ 按量补充包

| 计划 | 月费 | 含积分 | 成员 | 材料 |
|------|------|--------|------|------|
| 免费 | 0 | 20/月 | 2 | 50 |
| 专业版 | 299元 | 200/月 | 10 | 500 |
| 企业版 | 799元 | 800/月 | 不限 | 不限 |

补充包：50积分/49元、200积分/149元、1000积分/499元

## 用户旅程

| 角色 | 核心旅程 |
|------|---------|
| 商户管理员 | 注册→创建组织→上传材料→购买积分→分享展示页 |
| 商户成员 | 登录→Dashboard 工具中心→换装/场景/3D→分享结果 |
| 终端客户 | 收到链接→浏览材料→免费试用（水印）→提交询盘 |
