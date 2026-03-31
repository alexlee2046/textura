import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { getOptionalUser } from "@/lib/dal";
import { saveBase64Image, saveUploadedFile } from "@/lib/storage";
import { MATERIAL_STATUS, AI_MODEL } from "@/lib/constants";
import { getImageBuffer } from "@/lib/image-fetch";

// ---------------------------------------------------------------------------
// Anonymous rate-limit: 1 generation per IP per 24 hours
// ---------------------------------------------------------------------------
const anonTracker = new Map<string, number>();
const ANON_WINDOW_MS = 24 * 60 * 60 * 1000;

function canAnonymousGenerate(ip: string): boolean {
  const lastTime = anonTracker.get(ip);
  if (!lastTime) return true;
  return Date.now() - lastTime > ANON_WINDOW_MS;
}

function recordAnonymousGeneration(ip: string) {
  anonTracker.set(ip, Date.now());
  // Lazy cleanup: remove entries older than 24 h when map grows large
  if (anonTracker.size > 10_000) {
    const cutoff = Date.now() - ANON_WINDOW_MS;
    for (const [key, ts] of anonTracker) {
      if (ts < cutoff) anonTracker.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Watermark (for anonymous users)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// POST /api/generate
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    // ---- Auth (optional) ------------------------------------------------
    const headersList = await headers();
    const clientIp =
      headersList.get("x-forwarded-for")?.split(",")[0].trim() ||
      headersList.get("x-real-ip") ||
      "unknown";

    const user = await getOptionalUser();
    const isAnonymous = !user;

    if (isAnonymous) {
      if (!canAnonymousGenerate(clientIp)) {
        return NextResponse.json(
          { error: "Anonymous users are limited to 1 generation per 24 hours. Please sign in for unlimited access." },
          { status: 429 },
        );
      }
    }

    // ---- Parse FormData -------------------------------------------------
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;
    const materialId = formData.get("material_id") as string | null;

    if (!imageFile || !materialId) {
      return NextResponse.json(
        { error: "Missing required fields: image and material_id" },
        { status: 400 },
      );
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    if (imageFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10 MB." },
        { status: 400 },
      );
    }

    // ---- Look up material (server-side, never trust client prompt) ------
    const material = await prisma.material.findUnique({
      where: { id: materialId, status: MATERIAL_STATUS.ACTIVE, deletedAt: null },
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
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true },
        },
      },
    });

    if (!material) {
      return NextResponse.json(
        { error: "Material not found" },
        { status: 404 },
      );
    }

    const swatchUrl = material.images[0]?.url;
    if (!swatchUrl) {
      return NextResponse.json(
        { error: "Material has no primary image" },
        { status: 400 },
      );
    }

    // ---- Convert images to base64 for OpenRouter -----------------------
    const furnitureBase64 = Buffer.from(await imageFile.arrayBuffer()).toString("base64");
    const furnitureMime = imageFile.type || "image/jpeg";

    // Fetch the swatch image from its URL (with timeout)
    let swatchBuffer: Buffer;
    try {
      swatchBuffer = await getImageBuffer(swatchUrl);
    } catch {
      return NextResponse.json(
        { error: "Failed to fetch material swatch image" },
        { status: 502 },
      );
    }
    const swatchMime = swatchUrl.endsWith(".png") ? "image/png" : "image/webp";
    const swatchBase64 = swatchBuffer.toString("base64");

    // ---- Build OpenRouter request --------------------------------------
    const prompt = [
      "Image 1: furniture photo. Image 2: material swatch.",
      "Replace the main upholstery/surface material of the furniture with the material shown in Image 2.",
      "Scale the material's pattern to the furniture's real-world size.",
      "Adapt to scene lighting and viewing angle.",
      "Keep everything else unchanged.",
      "",
      `Material description: ${material.promptModifier}`,
    ].join("\n");

    const contentParts = [
      {
        type: "image_url" as const,
        image_url: { url: `data:${furnitureMime};base64,${furnitureBase64}` },
      },
      {
        type: "image_url" as const,
        image_url: { url: `data:${swatchMime};base64,${swatchBase64}` },
      },
      { type: "text" as const, text: prompt },
    ];

    const openRouterResp = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [{ role: "user", content: contentParts }],
          modalities: ["image", "text"],
        }),
      },
    );

    if (!openRouterResp.ok) {
      const err = await openRouterResp.json().catch(() => ({}));
      const msg =
        (err as Record<string, Record<string, string>>)?.error?.message ||
        "OpenRouter API error";
      throw new Error(msg);
    }

    const data = await openRouterResp.json();
    const images = (data as { choices?: { message?: { images?: { image_url: { url: string } }[] } }[] })
      ?.choices?.[0]?.message?.images;

    if (!images || images.length === 0) {
      throw new Error("No image returned from model");
    }

    // ---- Post-process & save -------------------------------------------
    const resultBase64 = images[0].image_url.url;
    let resultBuffer = Buffer.from(
      resultBase64.includes(",") ? resultBase64.split(",")[1] : resultBase64,
      "base64",
    );

    // Watermark for anonymous users
    if (isAnonymous) {
      resultBuffer = await addWatermark(resultBuffer) as Buffer<ArrayBuffer>;
    }

    // Save input + result to disk
    const [inputImageUrl, resultImageUrl] = await Promise.all([
      saveUploadedFile(imageFile),
      saveBase64Image(
        `data:image/png;base64,${resultBuffer.toString("base64")}`,
      ),
    ]);

    const shareHash = nanoid(8);

    // Frozen material snapshot for the generation record
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

    // ---- Persist generation record -------------------------------------
    await prisma.generation.create({
      data: {
        organizationId: material.organizationId,
        userId: user?.userId ?? null,
        materialId: material.id,
        materialSnapshot,
        type: "retexture",
        creditCost: 0,
        modelUsed: AI_MODEL,
        inputImageUrl,
        resultImageUrl,
        shareHash,
      },
    });

    // Record anonymous usage AFTER successful generation
    if (isAnonymous) {
      recordAnonymousGeneration(clientIp);
    }

    return NextResponse.json({
      success: true,
      imageUrl: resultImageUrl,
      shareHash,
      materialName: material.name,
      vendorSlug: material.organization.slug,
    });
  } catch (error: unknown) {
    console.error("Error in /api/generate:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
