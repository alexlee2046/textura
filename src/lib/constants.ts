export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const AI_MODEL =
  process.env.AI_MODEL || "google/gemini-2.5-flash-image";

export const MATERIAL_STATUS = {
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export const MEMBER_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export const MEMBER_ROLE = {
  OWNER: "owner",
  MEMBER: "member",
} as const;

export const INQUIRY_STATUS = {
  PENDING: "pending",
  CONTACTED: "contacted",
  CLOSED: "closed",
} as const;

export const MATERIAL_CATEGORIES = [
  { key: "fabric", label: "布料" },
  { key: "leather", label: "皮料" },
  { key: "wood_veneer", label: "木皮" },
  { key: "stone", label: "石材" },
  { key: "tile", label: "瓷砖" },
  { key: "carpet", label: "地毯" },
  { key: "wallpaper", label: "墙纸" },
  { key: "metal", label: "金属" },
] as const;

export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number]["key"];
export type MemberRole = (typeof MEMBER_ROLE)[keyof typeof MEMBER_ROLE];

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
