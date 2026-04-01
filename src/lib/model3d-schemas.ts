import { z } from "zod";

export { parseGeminiJSON } from "./gemini-utils";

export const Model3DRegionSchema = z.object({
  id: z.string(),
  label: z.string(),
  label_zh: z.string().optional().default(""),
  furnitureType: z.enum(["upholstered", "glass", "metal-frame", "stone-top", "wood", "mixed"]),
  box_2d: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});

export type Model3DRegion = z.infer<typeof Model3DRegionSchema>;

export const Model3DDetectResponseSchema = z.array(Model3DRegionSchema).min(1).max(20);
