import { z } from "zod";

// --- Region detection ---

export const RegionSchema = z.object({
  id: z.number(),
  label: z.string(),
  label_zh: z.string().optional().default(""),
  material_type: z.string(),
  box_2d: z.array(z.number()).optional(),
});

export type Region = z.infer<typeof RegionSchema>;

export const DetectResponseSchema = z.array(RegionSchema).min(1).max(12);

// --- Fabric assignments ---

export const AssignmentSchema = z.object({
  regionId: z.number(),
  fabricId: z.string(),
});

export type Assignment = z.infer<typeof AssignmentSchema>;

export const AssignmentsSchema = z.array(AssignmentSchema).min(1).max(12);

// --- Metadata stored in Generation.metadata ---

export const MultiFabricMetadataSchema = z.object({
  regions: z.array(RegionSchema),
  assignments: z.array(
    z.object({
      regionId: z.number(),
      regionLabel: z.string(),
      fabricId: z.string(),
    })
  ),
});

export type MultiFabricMetadata = z.infer<typeof MultiFabricMetadataSchema>;

