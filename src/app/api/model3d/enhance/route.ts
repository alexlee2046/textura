import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgWithCredits } from "@/lib/api-guard";
import { deductOrgCredits, refundOrgCredits } from "@/lib/credits";
import { buildEnhancePrompt, type FurnitureType } from "@/lib/model3d-prompts";
import { uploadToCos } from "@/lib/cos-storage";
import { optimizeForOpenRouter, validateImageBuffer } from "@/lib/image-utils";
import { callOpenRouter } from "@/lib/openrouter";
import { MODEL3D_CREDIT_COST, MODEL3D_FREE_ENHANCE_LIMIT, MODEL3D_ENHANCE_RETRY_COST } from "@/lib/model3d-constants";
import { AI_MODELS } from "@/lib/constants";
import { checkRateLimit } from "@/lib/rate-limit";
import sharp from "sharp";
import { nanoid } from "nanoid";

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type OpenRouterImagePart = { type: "image_url"; image_url: { url: string } };
type OpenRouterImageResult = { url?: string; image_url?: { url: string } };
const VALID_TYPES: FurnitureType[] = [
  "upholstered", "glass", "metal-frame", "stone-top", "wood", "mixed",
];

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // Parse required fields
    const imageFile = formData.get("image") as File | null;
    const width = Number(formData.get("width"));
    const depth = Number(formData.get("depth"));
    const height = Number(formData.get("height"));
    const furnitureType = formData.get("furnitureType") as FurnitureType;
    const mode = formData.get("mode") as "quick" | "precision";
    const viewIndex = Number(formData.get("viewIndex") || "1") as 1 | 2;
    const feedback = formData.get("feedback") as string | null;
    const previousImageUrl = formData.get("previousImageUrl") as string | null;
    const generationId = formData.get("generationId") as string | null;

    // Validate
    if (!imageFile) {
      return NextResponse.json({ error: "Missing image file" }, { status: 400 });
    }
    if (imageFile.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }
    if (!width || !depth || !height || width <= 0 || depth <= 0 || height <= 0) {
      return NextResponse.json({ error: "Invalid dimensions" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(furnitureType)) {
      return NextResponse.json({ error: "Invalid furnitureType" }, { status: 400 });
    }
    if (!["quick", "precision"].includes(mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }
    if (viewIndex !== 1 && viewIndex !== 2) {
      return NextResponse.json({ error: "Invalid viewIndex" }, { status: 400 });
    }

    // Determine if this enhance call costs credits
    let existingRecord = generationId
      ? await prisma.model3DGeneration.findUnique({ where: { id: generationId } })
      : null;

    const enhanceCount = existingRecord?.enhanceCount ?? 0;
    const freeLimit = MODEL3D_FREE_ENHANCE_LIMIT[mode];
    const shouldCharge = enhanceCount >= freeLimit;

    // Auth + credit check (multi-tenant)
    const minCredits = shouldCharge ? MODEL3D_ENHANCE_RETRY_COST : 0;
    const auth = await requireOrgWithCredits(minCredits);
    if (auth instanceof NextResponse) return auth;
    const { userId, orgId } = auth;

    if (!checkRateLimit(`enhance3d:${userId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 },
      );
    }

    // Verify ownership: record must belong to same org
    if (existingRecord && existingRecord.organizationId !== orgId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    try {
      await validateImageBuffer(imageBuffer);
    } catch {
      return NextResponse.json({ error: "Invalid image file" }, { status: 400 });
    }
    const optimizedBuffer = await optimizeForOpenRouter(imageBuffer);
    const mimeType = "image/jpeg";
    const base64Image = optimizedBuffer.toString("base64");

    // Build prompt
    const prompt = buildEnhancePrompt({
      width, depth, height, furnitureType, viewIndex,
      feedback: feedback ?? undefined,
    });

    // Build content parts
    const contentParts: object[] = [
      { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
    ];

    // Include previous image as context if retrying
    if (previousImageUrl && feedback) {
      try {
        const prevResp = await fetch(previousImageUrl);
        if (prevResp.ok) {
          const rawPrevBuf = Buffer.from(await prevResp.arrayBuffer());
          const optPrevBuf = await optimizeForOpenRouter(rawPrevBuf);
          const prevB64 = optPrevBuf.toString("base64");
          contentParts.push({
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${prevB64}` },
          });
        }
      } catch (err) {
        // Skip previous image if fetch fails
        console.error("Failed to process previous image:", err);
      }
    }

    contentParts.push({ type: "text", text: prompt });

    // Deduct credits BEFORE the AI call to prevent concurrent-request race
    let creditsDeducted = 0;
    let creditsRemaining = auth.orgCredits;
    if (shouldCharge) {
      const newBalance = await deductOrgCredits(orgId, userId, MODEL3D_ENHANCE_RETRY_COST, "3D model image enhancement (extra retry)");
      if (newBalance === null) {
        return NextResponse.json({ error: "INSUFFICIENT_CREDITS" }, { status: 402 });
      }
      creditsDeducted = MODEL3D_ENHANCE_RETRY_COST;
      creditsRemaining = newBalance;
    }

    let response: Response;
    try {
      response = await callOpenRouter({
        model: AI_MODELS.GEMINI_31_FLASH_IMAGE,
        messages: [{ role: "user", content: contentParts }],
        modalities: ["image", "text"],
      });
    } catch (aiErr) {
      if (creditsDeducted > 0) {
        await refundOrgCredits(orgId, userId, creditsDeducted, "Enhancement AI call failed").catch(() => {});
      }
      throw aiErr;
    }

    const data = await response.json();

    const stdImages = data.choices?.[0]?.message?.images;
    const contentParsed = !stdImages?.length
      ? (data.choices?.[0]?.message?.content as unknown[])
          ?.filter((p: unknown): p is OpenRouterImagePart => {
            if (typeof p !== "object" || p === null) return false;
            const obj = p as Record<string, unknown>;
            return obj.type === "image_url" && typeof (obj.image_url as Record<string, unknown>)?.url === "string";
          })
      : null;
    const resultImages = stdImages?.length ? stdImages : contentParsed;

    if (!resultImages?.length) {
      console.error(
        "model3d/enhance: no images in response:",
        JSON.stringify(data).slice(0, 800),
      );
      if (creditsDeducted > 0) {
        await refundOrgCredits(orgId, userId, creditsDeducted, "Enhancement returned no image").catch(() => {});
      }
      throw new Error("Image enhancement returned no image");
    }

    // Save enhanced image to COS + DB (refund credits on failure)
    try {
      const firstResult = resultImages[0] as OpenRouterImageResult | OpenRouterImagePart | string;
      const imageDataUrl: string =
        typeof firstResult === "string"
          ? firstResult
          : (firstResult as OpenRouterImagePart)?.image_url?.url
            ?? (firstResult as OpenRouterImageResult)?.url
            ?? "";
      const commaIdx = imageDataUrl.indexOf(",");
      const rawBuffer = Buffer.from(imageDataUrl.slice(commaIdx + 1), "base64");
      const webpBuffer = await sharp(rawBuffer).webp({ quality: 90 }).toBuffer();

      // Create or get generation ID for COS key
      const genId = existingRecord?.id ?? `m3d_${nanoid(12)}`;
      const cosKey = `model3d/${genId}/enhanced-v${viewIndex}.webp`;
      const enhancedImageUrl = await uploadToCos(cosKey, webpBuffer, "image/webp");

      // Save input image to COS (first call only)
      let inputImageUrl = existingRecord?.inputImageUrl;
      if (!inputImageUrl) {
        const inputWebp = await sharp(imageBuffer).webp({ quality: 85 }).toBuffer();
        const inputKey = `model3d/${genId}/input.webp`;
        inputImageUrl = await uploadToCos(inputKey, inputWebp, "image/webp");
      }

      // Create or update DB record
      if (existingRecord) {
        const updateData: Record<string, unknown> = {
          enhanceCount: enhanceCount + 1,
          feedback: feedback ?? existingRecord.feedback,
        };
        if (viewIndex === 1) updateData.enhancedImageUrl = enhancedImageUrl;
        if (viewIndex === 2) updateData.enhancedImage2Url = enhancedImageUrl;

        existingRecord = await prisma.model3DGeneration.update({
          where: { id: existingRecord.id },
          data: updateData,
        });
      } else {
        existingRecord = await prisma.model3DGeneration.create({
          data: {
            id: genId,
            organizationId: orgId,
            userId,
            mode,
            furnitureType,
            dimensions: { width, depth, height },
            creditCost: MODEL3D_CREDIT_COST[mode],
            inputImageUrl,
            enhancedImageUrl: viewIndex === 1 ? enhancedImageUrl : null,
            enhancedImage2Url: viewIndex === 2 ? enhancedImageUrl : null,
            enhanceCount: 1,
            feedback,
            status: "enhancing",
          },
        });
      }

      return NextResponse.json({
        imageUrl: enhancedImageUrl,
        generationId: existingRecord.id,
        enhanceCount: existingRecord.enhanceCount,
        creditsDeducted,
        creditsRemaining,
      });
    } catch (postChargeErr) {
      // Refund if credits were deducted but COS upload or DB write failed
      if (creditsDeducted > 0) {
        await refundOrgCredits(orgId, userId, creditsDeducted, "Enhancement post-processing failed (COS/DB)").catch(
          (refundErr) => console.error("Refund failed after enhance error:", refundErr),
        );
      }
      throw postChargeErr;
    }
  } catch (error) {
    console.error("model3d/enhance error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Enhancement failed" },
      { status: 500 },
    );
  }
}
