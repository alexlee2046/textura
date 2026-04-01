import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { getOptionalUser } from "@/lib/dal";
import { requireOrgWithCredits, type ApiCreditResult } from "@/lib/api-guard";
import { saveImageAsWebp } from "@/lib/storage";
import { callOpenRouter } from "@/lib/openrouter";
import { deductOrgCredits, refundOrgCredits } from "@/lib/credits";
import { optimizeForOpenRouter } from "@/lib/image-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { getImageBuffer } from "@/lib/image-fetch";
import {
  MATERIAL_STATUS,
  AI_MODELS,
  CREDIT_COST,
  GENERATION_TYPE,
  GENERATION_MODE,
} from "@/lib/constants";

const ANON_WINDOW_MS = 24 * 60 * 60 * 1000;

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

    const [user, formData] = await Promise.all([
      getOptionalUser(),
      request.formData(),
    ]);
    const isAnonymous = !user;

    let quality = (formData.get("quality") as string) || GENERATION_MODE.STANDARD;
    const imageFile = formData.get("image") as File | null;
    const materialId = formData.get("material_id") as string | null;

    if (isAnonymous && quality === GENERATION_MODE.PRO) {
      quality = GENERATION_MODE.STANDARD;
    }

    if (!imageFile || !materialId) {
      return NextResponse.json(
        { error: "Missing required fields: image and material_id" },
        { status: 400 },
      );
    }

    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10 MB." },
        { status: 400 },
      );
    }

    const isPro = quality === GENERATION_MODE.PRO;
    const model = isPro
      ? AI_MODELS.GEMINI_31_FLASH_IMAGE
      : AI_MODELS.GEMINI_25_FLASH_IMAGE;
    const creditCost = isPro
      ? CREDIT_COST.retexture_pro
      : CREDIT_COST.retexture_standard;

    let orgAuth: ApiCreditResult | null = null;
    if (isAnonymous) {
      if (!checkRateLimit(`anon:${clientIp}`, 1, ANON_WINDOW_MS)) {
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

    const rawImageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const furnitureBuffer = await optimizeForOpenRouter(rawImageBuffer);
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

    const tryRefund = async (reason: string) => {
      if (orgAuth && creditsRemaining !== null) {
        await refundOrgCredits(orgAuth.orgId, orgAuth.userId, creditCost, reason);
      }
    };

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
      await tryRefund("Refund: retexture API error");
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
      await tryRefund("Refund: no image returned");
      throw new Error("No image returned from model");
    }

    const resultBase64 = images[0].image_url.url;
    let resultBuffer = Buffer.from(
      resultBase64.includes(",") ? resultBase64.split(",")[1] : resultBase64,
      "base64",
    );

    if (isAnonymous) {
      resultBuffer = (await addWatermark(resultBuffer)) as Buffer<ArrayBuffer>;
    }

    const [inputImageUrl, resultImageUrl] = await Promise.all([
      saveImageAsWebp(rawImageBuffer),
      saveImageAsWebp(resultBuffer, "results"),
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
