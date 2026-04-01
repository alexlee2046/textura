import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { requireOrgWithCredits } from "@/lib/api-guard";
import { deductOrgCredits, refundOrgCredits } from "@/lib/credits";
import { saveBase64Image, saveImageAsWebp } from "@/lib/storage";
import { callOpenRouter } from "@/lib/openrouter";
import { retryWithDelay } from "@/lib/gemini-utils";
import {
  AI_MODELS,
  CREDIT_COST,
  GENERATION_TYPE,
} from "@/lib/constants";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const quality =
      (formData.get("quality") as string) === "pro" ? "pro" : "standard";
    const model =
      quality === "pro"
        ? AI_MODELS.GEMINI_3_PRO_IMAGE
        : AI_MODELS.GEMINI_31_FLASH_IMAGE;
    const creditCost =
      quality === "pro"
        ? CREDIT_COST.orthographic_pro
        : CREDIT_COST.orthographic_standard;

    const auth = await requireOrgWithCredits(creditCost);
    if (auth instanceof NextResponse) return auth;

    // Collect images: probe image_0, image_1, image_2, fallback to "image"
    const imageFiles: File[] = [];
    for (let i = 0; i < 3; i++) {
      const f = formData.get(`image_${i}`) as File | null;
      if (f) imageFiles.push(f);
    }
    if (imageFiles.length === 0) {
      const single = formData.get("image") as File | null;
      if (single) imageFiles.push(single);
    }
    if (imageFiles.length === 0) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 },
      );
    }

    // Validate each image
    for (const file of imageFiles) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "File too large. Maximum size is 10 MB." },
          { status: 400 },
        );
      }
    }

    const parseDim = (raw: FormDataEntryValue | null): number | null => {
      if (!raw || typeof raw !== "string") return null;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 1 || n > 9999) return null;
      return Math.round(n);
    };
    const width = parseDim(formData.get("width"));
    const depth = parseDim(formData.get("depth"));
    const height = parseDim(formData.get("height"));
    const hasDimensions = width !== null && depth !== null && height !== null;

    // Encode all images to base64
    const encodedImages = await Promise.all(
      imageFiles.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return {
          buffer,
          base64: buffer.toString("base64"),
          mimeType: file.type || "image/jpeg",
        };
      }),
    );

    const dimensionLine = hasDimensions
      ? `\n- Annotate with these exact dimensions: width ${width}mm, depth ${depth}mm, height ${height}mm. Show dimension numbers with standard annotation lines (arrows + extension lines).`
      : "";
    const dimensionSuffix = hasDimensions
      ? " — only dimension numbers on annotation lines"
      : ", no text of any kind — pure line art only";

    // Build prompt based on image count
    const prompt =
      imageFiles.length > 1
        ? `I'm providing ${imageFiles.length} photos of the same furniture piece from different angles. Use all views to infer accurate proportions and hidden geometry, then generate a professional engineering three-view orthographic drawing.

Requirements:
- Front view, side view, top view in standard third-angle projection layout
- Clean black line art on white background${dimensionLine}
- No view labels, no title block, no material notes${dimensionSuffix}`
        : `Generate a professional engineering three-view orthographic drawing of this furniture piece.

Requirements:
- Front view, side view, top view in standard third-angle projection layout
- Clean black line art on white background${dimensionLine}
- No view labels, no title block, no material notes${dimensionSuffix}`;

    const contentParts = [
      ...encodedImages.map(({ base64, mimeType }) => ({
        type: "image_url" as const,
        image_url: { url: `data:${mimeType};base64,${base64}` },
      })),
      { type: "text" as const, text: prompt },
    ];

    // Deduct before AI call, refund on failure
    const newBalance = await deductOrgCredits(
      auth.orgId,
      auth.userId,
      creditCost,
      `${quality} orthographic generation`,
    );
    if (newBalance === null) {
      return NextResponse.json(
        { error: "INSUFFICIENT_CREDITS" },
        { status: 402 },
      );
    }

    let images: Array<{ image_url: { url: string } }>;
    try {
      images = await retryWithDelay(
        async () => {
          const resp = await callOpenRouter({
            model,
            messages: [{ role: "user", content: contentParts }],
            modalities: ["image", "text"],
          });

          const data = await resp.json();
          const imgs = data.choices?.[0]?.message?.images;
          if (!imgs || imgs.length === 0) {
            throw new Error("No image returned from model");
          }
          return imgs;
        },
        { maxAttempts: 3, delayMs: 2000 },
      );
    } catch (e) {
      await refundOrgCredits(
        auth.orgId,
        auth.userId,
        creditCost,
        "orthographic generation failed",
      );
      throw e;
    }

    // Save first input image + result image
    const [inputImageUrl, resultImageUrl] = await Promise.all([
      saveImageAsWebp(encodedImages[0].buffer),
      saveBase64Image(images[0].image_url.url),
    ]);

    const generation = await prisma.generation.create({
      data: {
        organizationId: auth.orgId,
        userId: auth.userId,
        type: GENERATION_TYPE.ORTHOGRAPHIC,
        mode: quality,
        creditCost,
        modelUsed: model,
        materialSnapshot: {},
        inputImageUrl,
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
    console.error("Error generating orthographic:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate drawing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
