import { NextResponse } from "next/server";
import { requireOrgWithCredits } from "@/lib/api-guard";
import { deductOrgCredits, refundOrgCredits } from "@/lib/credits";
import { saveBase64Image, saveImageAsWebp } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  DetectResponseSchema,
  AssignmentsSchema,
  type Region,
  type Assignment,
} from "@/lib/multi-fabric-schemas";
import { prisma } from "@/lib/prisma";
import { structuredLog } from "@/lib/gemini-utils";
import { callOpenRouter } from "@/lib/openrouter";
import { nanoid } from "nanoid";
import {
  AI_MODELS,
  CREDIT_COST,
  GENERATION_TYPE,
} from "@/lib/constants";

const MODELS: Record<string, string> = {
  pro: AI_MODELS.GEMINI_31_FLASH_IMAGE,
  ultra: AI_MODELS.GEMINI_3_PRO_IMAGE,
};
const CREDIT_COSTS: Record<string, number> = {
  pro: CREDIT_COST.multi_fabric_pro,
  ultra: CREDIT_COST.multi_fabric_ultra,
};
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60_000;

function buildPrompt(
  regions: Region[],
  assignments: Assignment[],
  assignedMaterialIds: string[],
) {
  // Map each materialId to its Image index (Image 2, 3, 4...)
  const materialImageIndex = new Map(
    assignedMaterialIds.map((id, i) => [id, i + 2]),
  );

  // Assignment map (keyed by regionId)
  const assignmentByRegion = new Map(assignments.map((a) => [a.regionId, a]));

  const assignmentLines = regions.map((r) => {
    const a = assignmentByRegion.get(r.id);
    if (a) {
      const imgIdx = materialImageIndex.get(a.fabricId)!;
      return `- ${r.label}: apply Image ${imgIdx}`;
    }
    return `- ${r.label}: keep unchanged`;
  });

  return `Image 1: furniture photo. Swatch images follow (each is a 20 × 20 cm physical sample).

Replace upholstery on these regions:
${assignmentLines.join("\n")}

Scale each swatch's weave pattern to the furniture's real-world size. Adapt color and texture to the scene's lighting and viewing angle. Keep everything else unchanged.`;
}

export async function POST(req: Request) {
  let userId = "unknown";
  let orgId = "unknown";

  try {
    // 0. Parse quality from FormData (need to peek before auth)
    const formData = await req.formData();
    const quality =
      (formData.get("quality") as string) === "ultra" ? "ultra" : "pro";
    const model = MODELS[quality];
    const creditCost = CREDIT_COSTS[quality];

    // 1. Auth + credit pre-check
    const auth = await requireOrgWithCredits(creditCost);
    if (auth instanceof NextResponse) return auth;
    userId = auth.userId;
    orgId = auth.orgId;

    // 2. Rate limit
    if (
      !checkRateLimit(
        `multi-gen:${userId}`,
        RATE_LIMIT_MAX,
        RATE_LIMIT_WINDOW_MS,
      )
    ) {
      structuredLog("multi-fabric.rate_limited", { userId });
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 },
      );
    }

    // 3. Parse FormData (already parsed above for quality)
    const imageFile = formData.get("image") as File | null;
    const assignmentsRaw = formData.get("assignments") as string | null;
    const regionsRaw = formData.get("regions") as string | null;
    const aspectRatio = formData.get("aspectRatio") as string | null;

    if (!imageFile || !assignmentsRaw || !regionsRaw) {
      return NextResponse.json(
        { error: "Missing required fields: image, assignments, regions" },
        { status: 400 },
      );
    }

    if (imageFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5 MB." },
        { status: 400 },
      );
    }

    // 4. Validate with Zod
    let regions: Region[];
    let assignments: Assignment[];
    try {
      regions = DetectResponseSchema.parse(JSON.parse(regionsRaw));
      assignments = AssignmentsSchema.parse(JSON.parse(assignmentsRaw));
    } catch {
      return NextResponse.json(
        { error: "Invalid regions or assignments format" },
        { status: 400 },
      );
    }

    // 5. Cross-validate: every assignment regionId must exist in regions
    const regionIds = new Set(regions.map((r) => r.id));
    for (const a of assignments) {
      if (!regionIds.has(a.regionId)) {
        return NextResponse.json(
          { error: `Assignment references unknown region ${a.regionId}` },
          { status: 400 },
        );
      }
    }

    // 6. Look up materials from DB + fetch swatch images
    const materialIds = [...new Set(assignments.map((a) => a.fabricId))];
    const materials = await prisma.material.findMany({
      where: { id: { in: materialIds } },
      include: { images: { where: { isPrimary: true }, take: 1 } },
    });

    if (materials.length !== materialIds.length) {
      const found = new Set(materials.map((m) => m.id));
      const missing = materialIds.filter((id) => !found.has(id));
      return NextResponse.json(
        { error: `Unknown material IDs: ${missing.join(", ")}` },
        { status: 400 },
      );
    }

    // Fetch swatch images as base64 (parallel I/O from URLs)
    const swatchEntries = await Promise.all(
      materials.map(async (material) => {
        const primaryImage = material.images[0];
        if (!primaryImage) {
          throw new Error(
            `Material ${material.id} has no primary image`,
          );
        }
        const response = await fetch(primaryImage.url);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch swatch for material ${material.id}`,
          );
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get("content-type") || "image/jpeg";
        return [
          material.id,
          `data:${contentType};base64,${buffer.toString("base64")}`,
        ] as const;
      }),
    );
    const swatchImages = new Map(swatchEntries);

    // Build material snapshot for the generation record
    const materialSnapshotMap = Object.fromEntries(
      materials.map((m) => [
        m.id,
        {
          name: m.name,
          category: m.category,
          seriesCode: m.seriesCode,
          color: m.color,
          colorCode: m.colorCode,
          promptModifier: m.promptModifier,
        },
      ]),
    );

    // 7. Build content parts: Image 1 = furniture, Image 2+ = swatches (in assignment order)
    const base64Image = Buffer.from(await imageFile.arrayBuffer()).toString(
      "base64",
    );
    const mimeType = imageFile.type || "image/jpeg";
    const assignedMaterialIds = [
      ...new Set(assignments.map((a) => a.fabricId)),
    ];

    const contentParts: object[] = [
      {
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64Image}` },
      },
    ];
    for (const materialId of assignedMaterialIds) {
      contentParts.push({
        type: "image_url",
        image_url: { url: swatchImages.get(materialId)! },
      });
    }

    // 8. Build prompt -- references Image 2, 3, 4... by index
    const prompt = buildPrompt(regions, assignments, assignedMaterialIds);
    contentParts.push({ type: "text", text: prompt });

    structuredLog("multi-fabric.start", {
      userId,
      orgId,
      regionCount: regions.length,
      assignmentCount: assignments.length,
      materialCount: assignedMaterialIds.length,
    });

    // 9. Deduct credits BEFORE AI call to prevent concurrent-request race
    const newBalance = await deductOrgCredits(
      auth.orgId,
      auth.userId,
      creditCost,
      `multi-fabric ${quality} generation`,
    );
    if (newBalance === null) {
      return NextResponse.json(
        { error: "INSUFFICIENT_CREDITS" },
        { status: 402 },
      );
    }

    // 10. Call OpenRouter
    let data: Record<string, unknown>;
    try {
      const response = await callOpenRouter({
        model,
        messages: [{ role: "user", content: contentParts }],
        modalities: ["image", "text"],
        ...(aspectRatio && {
          image_config: { aspect_ratio: aspectRatio },
        }),
      });
      data = await response.json();
    } catch (aiErr) {
      await refundOrgCredits(
        auth.orgId,
        auth.userId,
        creditCost,
        "multi-fabric generation failed -- refund",
      ).catch(() => {});
      throw aiErr;
    }

    const images = (
      data as {
        choices?: Array<{
          message?: { images?: Array<{ image_url: { url: string } }> };
        }>;
      }
    ).choices?.[0]?.message?.images;

    if (!images || images.length === 0) {
      await refundOrgCredits(
        auth.orgId,
        auth.userId,
        creditCost,
        "multi-fabric generation returned no image -- refund",
      ).catch(() => {});
      throw new Error("No image returned from model");
    }

    // 11. Save images (parallel)
    const inputBuffer = Buffer.from(await imageFile.arrayBuffer());
    const [inputImageUrl, resultImageUrl] = await Promise.all([
      saveImageAsWebp(inputBuffer),
      saveBase64Image(images[0].image_url.url),
    ]);

    // 12. Build metadata
    const regionById = new Map(regions.map((r) => [r.id, r]));
    const metadata = {
      regions,
      assignments: assignments.map((a) => ({
        regionId: a.regionId,
        regionLabel: regionById.get(a.regionId)?.label ?? "",
        materialId: a.fabricId,
      })),
    };

    const shareHash = nanoid(8);

    // Create generation record
    const generation = await prisma.generation.create({
      data: {
        organizationId: auth.orgId,
        userId: auth.userId,
        type: GENERATION_TYPE.MULTI_FABRIC,
        mode: quality,
        creditCost,
        modelUsed: model,
        materialId: assignedMaterialIds.length === 1 ? assignedMaterialIds[0] : null,
        materialSnapshot: materialSnapshotMap,
        inputImageUrl,
        resultImageUrl,
        shareHash,
        metadata,
      },
    });

    structuredLog("multi-fabric.success", {
      userId,
      orgId,
      generationId: generation.id,
      creditsRemaining: newBalance,
    });

    // 13. Return result
    return NextResponse.json({
      success: true,
      imageUrl: resultImageUrl,
      creditsRemaining: newBalance,
      shareHash: generation.shareHash,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    structuredLog("multi-fabric.error", { userId, orgId, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
