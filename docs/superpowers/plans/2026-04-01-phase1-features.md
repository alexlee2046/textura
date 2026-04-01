# Phase 1-2: 功能模块迁入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将面料换装增强、场景合成、正射图、多面料对比 4 个功能模块从 fabric-switcher 迁入 textura。

**Architecture:** 纯 UI 组件直接复制，API routes 用 textura 的 api-guard + credits 模式重写 auth/credits 部分，业务逻辑保持不变。Fabric→Material 命名统一。

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Shadcn, next-intl, Prisma, OpenRouter

**Source:** `/Users/alex/Develop/Elastron/fabric-switcher/src/`
**Target:** `/Users/alex/Develop/Elastron/textura/src/`

---

## Batch 1: 安装依赖 + 复制纯文件（无需改动）

### Task 1: 安装新依赖

- [ ] 安装 scene 模块依赖: `npm install konva react-konva react-easy-crop framer-motion`
- [ ] 安装 orthographic 导出依赖: `npm install jspdf @tarikjabiri/dxf`
- [ ] 验证: `npx tsc --noEmit`
- [ ] Commit: `git add package.json package-lock.json && git commit -m "feat: add scene, orthographic, and animation dependencies"`

### Task 2: 复制纯工具库文件（COPY, 0改动）

从 fabric-switcher 复制到 textura，路径不变：

| 源文件 | 目标文件 | 说明 |
|--------|---------|------|
| `src/lib/scenePromptMaps.ts` | `src/lib/scenePromptMaps.ts` | 房间/风格/灯光→prompt 映射 |
| `src/lib/sceneComposite.ts` | `src/lib/sceneComposite.ts` | Canvas 合成逻辑 |
| `src/lib/multi-fabric-schemas.ts` | `src/lib/multi-fabric-schemas.ts` | Zod schema |
| `src/lib/compressImage.ts` | `src/lib/compressImage.ts` | 浏览器端图片压缩 |
| `src/lib/download.ts` | `src/lib/download.ts` | 客户端下载工具 |
| `src/lib/downloadBlob.ts` | `src/lib/downloadBlob.ts` | Blob 下载工具 |

- [ ] 复制上述文件
- [ ] 检查 import 路径是否都用 `@/` 别名
- [ ] 如果 `compressImage.ts` 与现有 `compress-image.ts` 冲突，保留 textura 版本，从 fabric-switcher 版本补充缺失的导出
- [ ] `npx tsc --noEmit`
- [ ] Commit: `git add src/lib/ && git commit -m "feat: copy scene, multi-fabric, and utility libs from fabric-switcher"`

### Task 3: 复制纯 UI 组件（COPY, 0改动或仅改 import）

从 fabric-switcher 复制到 textura `src/features/` 或 `src/components/`：

| 源文件 | 目标文件 | 说明 |
|--------|---------|------|
| `src/components/scene/SceneSetup.tsx` | `src/features/scene/SceneSetup.tsx` | 房间参数选择 |
| `src/components/scene/ProductUploader.tsx` | `src/features/scene/ProductUploader.tsx` | 产品上传 |
| `src/components/scene/LayoutEditor.tsx` | `src/features/scene/LayoutEditor.tsx` | 布局编辑器 |
| `src/components/ImageUploader.tsx` | `src/components/ImageUploader.tsx` | 通用图片上传 |
| `src/components/ImageCropper.tsx` | `src/components/ImageCropper.tsx` | 图片裁剪 |
| `src/components/MagicButton.tsx` | `src/components/MagicButton.tsx` | 生成按钮 |

- [ ] 创建 `src/features/scene/` 目录
- [ ] 复制上述文件
- [ ] 修复 import：如果引用了 fabric-switcher 特有的路径（如 `@/data/fabrics`），改为 textura 的对应模块
- [ ] 检查 next-intl 翻译键是否存在，缺失的先加空字符串占位到 `src/messages/zh.json` 和 `en.json`
- [ ] `npx tsc --noEmit`
- [ ] Commit: `git add src/features/ src/components/ src/messages/ && git commit -m "feat: copy scene UI components, image uploader/cropper from fabric-switcher"`

---

## Batch 2: 场景合成 API + 页面

### Task 4: 迁入 Scene API routes

从 fabric-switcher 复制 3 个 API route 到 textura，替换 auth/credits 部分：

**`src/app/api/scene/direct/route.ts`** — 改动点：
- `requireAuthWithCredits(cost)` → `requireOrgWithCredits(cost)` from `@/lib/api-guard`
- `deductCredits(userId, cost, desc)` → `deductOrgCredits(orgId, userId, cost, desc)` from `@/lib/credits`
- `refundCredits(userId, amount, reason)` → `refundOrgCredits(orgId, userId, amount, reason)`
- `prisma.generation.create` 的 data 中加 `organizationId: orgAuth.orgId`
- model 字符串改用 `AI_MODELS.*` 常量
- credit cost 改用 `CREDIT_COST.*` 常量

**`src/app/api/scene/enhance/route.ts`** — 同上改动模式

**`src/app/api/scene/background/route.ts`** — 同上改动模式

- [ ] 创建目录 `src/app/api/scene/direct/`, `src/app/api/scene/enhance/`, `src/app/api/scene/background/`
- [ ] 复制 3 个 route.ts，按上述模式替换 auth/credits/model imports
- [ ] `npx tsc --noEmit`
- [ ] Commit: `git add src/app/api/scene/ && git commit -m "feat: add scene generation API routes (direct, enhance, background)"`

### Task 5: 迁入 Scene 页面

从 fabric-switcher 复制 `src/app/app/scene/page.tsx` 到 textura `src/app/(app)/my/scene/page.tsx`。

改动点：
- `useAuth()` → 使用 textura 的 auth pattern（Supabase client-side `useUser()`，或直接 fetch `/api/credits`）
- `fabricId` 引用 → `materialId`
- 翻译键补充到 messages
- 移除 miniProgramShare 相关代码（textura 暂不需要微信小程序分享）

- [ ] 创建 `src/app/(app)/my/scene/page.tsx`
- [ ] 补充 i18n 翻译键
- [ ] `npx tsc --noEmit`
- [ ] Commit: `git add src/app/\(app\)/my/scene/ src/messages/ && git commit -m "feat: add scene composition page"`

---

## Batch 3: 正射图 API + 页面

### Task 6: 迁入 Orthographic API routes

**`src/app/api/orthographic/route.ts`** — 同 Scene 的 auth/credits 改动模式
**`src/app/api/orthographic/export/route.ts`** — 同上

- [ ] 创建目录 `src/app/api/orthographic/`、`src/app/api/orthographic/export/`
- [ ] 复制并适配 auth/credits
- [ ] `npx tsc --noEmit`
- [ ] Commit: `git add src/app/api/orthographic/ && git commit -m "feat: add orthographic drawing API routes"`

### Task 7: 迁入 Orthographic 页面

从 fabric-switcher 复制 `src/app/app/orthographic/page.tsx` 到 `src/app/(app)/my/orthographic/page.tsx`。

- [ ] 创建页面文件
- [ ] 适配 auth + import 路径
- [ ] 补充 i18n 翻译键
- [ ] `npx tsc --noEmit`
- [ ] Commit: `git add src/app/\(app\)/my/orthographic/ src/messages/ && git commit -m "feat: add orthographic drawing page"`

---

## Batch 4: 多面料对比 API + 页面

### Task 8: 迁入 Multi-fabric API routes

**`src/app/api/multi-fabric/detect/route.ts`** — auth/credits 改动
**`src/app/api/multi-fabric/generate/route.ts`** — auth/credits 改动 + `fabricId` → `materialId`

- [ ] 创建目录 `src/app/api/multi-fabric/detect/`、`src/app/api/multi-fabric/generate/`
- [ ] 复制并适配
- [ ] `npx tsc --noEmit`
- [ ] Commit: `git add src/app/api/multi-fabric/ && git commit -m "feat: add multi-fabric detection and generation API routes"`

### Task 9: 迁入 Multi-fabric 页面

从 fabric-switcher 复制到 `src/app/(app)/my/multi-fabric/page.tsx`。

关键改动：
- `Fabric` 类型 → 使用 textura 的 `Material` 类型（从 Prisma 生成）
- `FabricSelector` 组件 → textura 已有 MaterialGrid/MaterialCard，需要适配或复制 FabricSelector
- 如果 FabricSelector 组件在 textura 不存在，从 fabric-switcher 复制并改名为 MaterialSelector

- [ ] 创建页面文件
- [ ] 处理 Material 类型和组件适配
- [ ] 补充 i18n 翻译键
- [ ] `npx tsc --noEmit`
- [ ] Commit: `git add src/app/\(app\)/my/multi-fabric/ src/messages/ && git commit -m "feat: add multi-fabric comparison page"`

---

## Batch 5: Generations 历史 + 收尾

### Task 10: 迁入 Generations API

**`src/app/api/generations/route.ts`** — 需要重写为组织级查询
**`src/app/api/generations/[id]/route.ts`** — 加 organizationId 校验

- [ ] 创建目录和文件
- [ ] 查询改为 `where: { organizationId: orgAuth.orgId }` 范围
- [ ] `npx tsc --noEmit`
- [ ] Commit: `git add src/app/api/generations/ && git commit -m "feat: add generations history API with org-scoped queries"`

### Task 11: 验证全量构建

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] 修复任何错误
- [ ] Commit fixes if any
