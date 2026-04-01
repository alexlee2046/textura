import { CREDIT_COST } from "@/lib/constants";

/** Statuses indicating a 3D generation is actively in progress (not terminal). */
export const MODEL3D_ACTIVE_STATUSES = ["pending", "processing", "downloading"] as const;

/** Credit cost per generation mode (sourced from central CREDIT_COST). */
export const MODEL3D_CREDIT_COST = {
  quick: CREDIT_COST.model3d_quick,
  precision: CREDIT_COST.model3d_precision,
} as const;

/** Free enhancement attempts before credits are charged. */
export const MODEL3D_FREE_ENHANCE_LIMIT = { quick: 2, precision: 3 } as const;

/** Credit cost per extra enhancement retry (beyond free limit). */
export const MODEL3D_ENHANCE_RETRY_COST = CREDIT_COST.model3d_enhance_retry;
