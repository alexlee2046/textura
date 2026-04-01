// src/app/api/scene/direct/route.ts
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { deductOrgCredits, refundOrgCredits } from "@/lib/credits";
import { requireOrgWithCredits } from "@/lib/api-guard";
import { saveBase64Image } from "@/lib/storage";
import { callOpenRouter } from "@/lib/openrouter";
import { nanoid } from "nanoid";
import { STYLE_MAP, ROOM_MAP, LIGHT_MAP } from "@/lib/scenePromptMaps";
import {
  AI_MODELS,
  CREDIT_COST,
  GENERATION_TYPE,
  GENERATION_MODE,
} from "@/lib/constants";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const productFiles = formData.getAll("products") as File[];
    const productMeta = JSON.parse(
      formData.get("productMeta") as string,
    ) as Array<{
      name: string;
      width: number;
      depth: number;
      height: number;
    }>;
    const sceneParams = JSON.parse(
      formData.get("sceneParams") as string,
    ) as {
      roomType: string;
      style: string;
      colorPalette: string;
      lighting: string;
      roomWidthM: number;
      roomDepthM: number;
    };
    const layoutDesc = formData.get("layoutDesc") as string;

    const geminiModel =
      (formData.get("geminiModel") as string) ||
      AI_MODELS.GEMINI_25_FLASH_IMAGE;
    const creditCost =
      geminiModel === AI_MODELS.GEMINI_31_FLASH_IMAGE
        ? CREDIT_COST.scene_pro
        : CREDIT_COST.scene_standard;

    const auth = await requireOrgWithCredits(creditCost);
    if (auth instanceof NextResponse) return auth;

    if (!productFiles.length) {
      return NextResponse.json(
        { error: "No product images" },
        { status: 400 },
      );
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    const contentParts: object[] = [];

    for (let i = 0; i < productFiles.length; i++) {
      const f = productFiles[i];
      if (f.size > MAX_SIZE) continue;
      const b64 = Buffer.from(await f.arrayBuffer()).toString("base64");
      contentParts.push({
        type: "image_url",
        image_url: {
          url: `data:${f.type || "image/jpeg"};base64,${b64}`,
        },
      });
    }

    const productList = productMeta
      .map(
        (m, i) =>
          `Product ${i + 1}: ${m.name || `item ${i + 1}`} (${m.width}W x ${m.depth}D x ${m.height}H cm)`,
      )
      .join("\n");

    const prompt = `Product photos follow (plain backgrounds -- ignore backgrounds):
${productList}

${layoutDesc ? `Layout: ${layoutDesc}\n` : ""}Place ALL products in a ${STYLE_MAP[sceneParams.style] ?? sceneParams.style} ${ROOM_MAP[sceneParams.roomType] ?? sceneParams.roomType}, ~${sceneParams.roomWidthM}m x ${sceneParams.roomDepthM}m.
${LIGHT_MAP[sceneParams.lighting] ?? sceneParams.lighting}.${sceneParams.colorPalette ? ` ${sceneParams.colorPalette}.` : ""}
Maintain correct proportions from the given dimensions. Wide-angle view.`;

    contentParts.push({ type: "text", text: prompt });

    // Deduct credits before the expensive API call
    const newBalance = await deductOrgCredits(
      auth.orgId,
      auth.userId,
      creditCost,
      `scene direct generation (${geminiModel})`,
    );
    if (newBalance === null) {
      return NextResponse.json(
        { error: "INSUFFICIENT_CREDITS" },
        { status: 402 },
      );
    }

    let data: Record<string, unknown>;
    try {
      const resp = await callOpenRouter({
        model: geminiModel,
        messages: [{ role: "user", content: contentParts }],
        modalities: ["image", "text"],
      });
      data = (await resp.json()) as Record<string, unknown>;
    } catch (err) {
      console.error("OpenRouter scene direct API call failed:", err);
      await refundOrgCredits(
        auth.orgId,
        auth.userId,
        creditCost,
        "Refund: scene direct API error",
      );
      throw new Error("Scene generation is temporarily unavailable");
    }

    const images = (
      data as {
        choices?: {
          message?: { images?: { image_url: { url: string } }[] };
        }[];
      }
    )?.choices?.[0]?.message?.images;

    if (!images?.length) {
      await refundOrgCredits(
        auth.orgId,
        auth.userId,
        creditCost,
        "Refund: scene direct returned no image",
      );
      throw new Error("Scene generation returned no image");
    }

    // Persist result image
    const resultImageUrl = await saveBase64Image(images[0].image_url.url);

    // Write generation record
    const mode =
      geminiModel === AI_MODELS.GEMINI_31_FLASH_IMAGE
        ? GENERATION_MODE.GEMINI_31_DIRECT
        : GENERATION_MODE.GEMINI_DIRECT;

    const generation = await prisma.generation.create({
      data: {
        organizationId: auth.orgId,
        userId: auth.userId,
        materialSnapshot: {},
        type: GENERATION_TYPE.SCENE,
        mode,
        creditCost,
        modelUsed: geminiModel,
        inputImageUrl: "",
        resultImageUrl,
        shareHash: nanoid(8),
        sceneParams: sceneParams as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      success: true,
      imageUrl: resultImageUrl,
      creditsRemaining: newBalance,
      shareHash: generation.shareHash,
    });
  } catch (error: unknown) {
    console.error("Error in /api/scene/direct:", error);
    const message =
      error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
