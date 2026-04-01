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

    const formData = await request.formData();
    let quality = (formData.get("quality") as string) || "standard";
    const imageFile = formData.get("image") as File | null;
    const materialId = formData.get("material_id") as string | null;

    // Anonymous users are forced to standard mode (Pro uses expensive models)
    if (isAnonymous && quality === "pro") {
      quality = "standard";
    }

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
