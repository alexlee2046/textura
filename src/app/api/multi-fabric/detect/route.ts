import { NextResponse } from "next/server";
import { requireOrgWithCredits } from "@/lib/api-guard";
import { DetectResponseSchema } from "@/lib/multi-fabric-schemas";
import {
  parseGeminiJSON,
  structuredLog,
  retryWithDelay,
} from "@/lib/gemini-utils";
import { callOpenRouter } from "@/lib/openrouter";
import { checkRateLimit } from "@/lib/rate-limit";
import { AI_MODELS } from "@/lib/constants";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2_000;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

function buildDetectPrompt(productHint?: string, maxRegions: number = 8) {
  const focus = productHint
    ? `\nFocus ONLY on the ${productHint} — ignore other objects.`
    : "";
  return `Identify up to ${maxRegions} distinct upholsterable regions on this furniture photo.${focus}

For each region return JSON with:
- "id": sequential integer from 1
- "label": specific English name (e.g. "left seat cushion", "backrest center panel")
- "label_zh": Chinese name (e.g. "左座垫", "靠背中板")
- "material_type": "fabric" | "leather" | "velvet" | "synthetic" | "wood" | "metal"

Distinguish individual cushions, left/right, front/back.
Return ONLY a JSON array.`;
}

async function callGeminiText(
  base64Image: string,
  mimeType: string,
  prompt: string,
): Promise<string> {
  const resp = await callOpenRouter({
    model: AI_MODELS.GEMINI_31_FLASH_IMAGE,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64Image}` },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const data = await resp.json();
  const raw: string | undefined = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Empty response from model");
  return raw;
}

export async function POST(req: Request) {
  let userId = "unknown";

  try {
    const auth = await requireOrgWithCredits(0);
    if (auth instanceof NextResponse) return auth;
    userId = auth.userId;

    if (
      !checkRateLimit(
        `detect:${userId}`,
        RATE_LIMIT_MAX,
        RATE_LIMIT_WINDOW_MS,
      )
    ) {
      structuredLog("detect.rate_limited", { userId });
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 },
      );
    }

    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;
    const productHint =
      (formData.get("productHint") as string | null) || undefined;
    const maxRegionsRaw = formData.get("maxRegions") as string | null;
    const maxRegions = Math.min(Math.max(Number(maxRegionsRaw) || 8, 2), 12);

    if (!imageFile) {
      return NextResponse.json(
        { error: "Missing required field: image" },
        { status: 400 },
      );
    }

    if (imageFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5 MB." },
        { status: 400 },
      );
    }

    const base64Image = Buffer.from(await imageFile.arrayBuffer()).toString(
      "base64",
    );
    const mimeType = imageFile.type || "image/jpeg";
    const detectPrompt = buildDetectPrompt(productHint, maxRegions);

    structuredLog("detect.start", {
      userId,
      fileSize: imageFile.size,
      mimeType,
      productHint: productHint || null,
    });

    try {
      const regions = await retryWithDelay(
        async () => {
          const raw = await callGeminiText(base64Image, mimeType, detectPrompt);
          return parseGeminiJSON(raw, DetectResponseSchema);
        },
        {
          maxAttempts: MAX_ATTEMPTS,
          delayMs: RETRY_DELAY_MS,
          onError: (err, attempt) =>
            structuredLog("detect.attempt_failed", {
              userId,
              attempt,
              error: err.message,
            }),
        },
      );

      structuredLog("detect.success", { userId, regionCount: regions.length });
      return NextResponse.json({ regions });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      structuredLog("detect.failed", { userId, error: msg });
      return NextResponse.json(
        { error: "Failed to detect regions. Please try again." },
        { status: 502 },
      );
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    structuredLog("detect.error", { userId, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
