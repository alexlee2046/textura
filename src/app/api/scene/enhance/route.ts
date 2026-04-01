// src/app/api/scene/enhance/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deductOrgCredits, refundOrgCredits } from "@/lib/credits";
import { requireOrgWithCredits } from "@/lib/api-guard";
import { saveBase64Image } from "@/lib/storage";
import { callOpenRouter, extractImages } from "@/lib/openrouter";
import { nanoid } from "nanoid";
import {
  AI_MODELS,
  CREDIT_COST,
  GENERATION_TYPE,
  GENERATION_MODE,
} from "@/lib/constants";

export async function POST(req: Request) {
  try {
    const creditCost = CREDIT_COST.scene_enhance;

    const auth = await requireOrgWithCredits(creditCost);
    if (auth instanceof NextResponse) return auth;

    const formData = await req.formData();
    const compositeFile = formData.get("composite") as File;
    const productFiles = formData.getAll("products") as File[];
    const sceneDescription =
      (formData.get("sceneDescription") as string) || "";

    if (!compositeFile) {
      return NextResponse.json(
        { error: "Missing composite image" },
        { status: 400 },
      );
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    const contentParts: object[] = [];

    const compB64 = Buffer.from(await compositeFile.arrayBuffer()).toString(
      "base64",
    );
    contentParts.push({
      type: "image_url",
      image_url: {
        url: `data:${compositeFile.type || "image/jpeg"};base64,${compB64}`,
      },
    });

    const productParts = await Promise.all(
      productFiles.slice(0, 6).filter(pf => pf.size <= MAX_SIZE).map(async (pf) => {
        const b64 = Buffer.from(await pf.arrayBuffer()).toString("base64");
        return {
          type: "image_url" as const,
          image_url: { url: `data:${pf.type || "image/jpeg"};base64,${b64}` },
        };
      })
    );
    contentParts.push(...productParts);

    contentParts.push({
      type: "text",
      text: `The first image is a composited interior scene with furniture products placed in a room.
The remaining images are the original product reference photos.
${sceneDescription ? `Scene context: ${sceneDescription}` : ""}

Your task:
1. Add realistic shadows, reflections, and ambient occlusion beneath and around each furniture piece.
2. Blend the lighting on each furniture surface to match the room's light sources.
3. Keep all furniture exactly in their current positions and sizes.
4. Keep the room background (walls, floor, ceiling, windows) completely unchanged.
5. Output a single photorealistic interior design photograph, professional staging quality.`,
    });

    // Deduct credits before the expensive API call
    const newBalance = await deductOrgCredits(
      auth.orgId,
      auth.userId,
      creditCost,
      "scene flux-gemini enhance",
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
        model: AI_MODELS.GEMINI_25_FLASH_IMAGE,
        messages: [{ role: "user", content: contentParts }],
        modalities: ["image", "text"],
      });
      data = (await resp.json()) as Record<string, unknown>;
    } catch (err) {
      console.error("OpenRouter scene enhance API call failed:", err);
      await refundOrgCredits(
        auth.orgId,
        auth.userId,
        creditCost,
        "Refund: scene enhance API error",
      );
      throw new Error("Scene enhancement is temporarily unavailable");
    }

    const images = extractImages(data);

    if (!images?.length) {
      await refundOrgCredits(
        auth.orgId,
        auth.userId,
        creditCost,
        "Refund: scene enhance returned no image",
      );
      throw new Error("Scene enhancement returned no image");
    }

    // Persist result image
    const resultImageUrl = await saveBase64Image(images[0].image_url.url);

    // Write generation record
    const generation = await prisma.generation.create({
      data: {
        organizationId: auth.orgId,
        userId: auth.userId,
        materialSnapshot: {},
        type: GENERATION_TYPE.SCENE,
        mode: GENERATION_MODE.FLUX_GEMINI,
        creditCost,
        modelUsed: AI_MODELS.GEMINI_25_FLASH_IMAGE,
        inputImageUrl: "",
        resultImageUrl,
        shareHash: nanoid(8),
      },
    });

    return NextResponse.json({
      success: true,
      imageUrl: resultImageUrl,
      creditsRemaining: newBalance,
      shareHash: generation.shareHash,
    });
  } catch (error: unknown) {
    console.error("Error in /api/scene/enhance:", error);
    const message =
      error instanceof Error ? error.message : "Enhancement failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
