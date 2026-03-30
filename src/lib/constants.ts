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
