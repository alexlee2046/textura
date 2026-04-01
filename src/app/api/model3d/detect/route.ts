import { NextResponse } from "next/server";
import { requireOrgWithCredits } from "@/lib/api-guard";
import { Model3DDetectResponseSchema, parseGeminiJSON } from "@/lib/model3d-schemas";
import { structuredLog, retryWithDelay } from "@/lib/gemini-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { optimizeForOpenRouter, validateImageBuffer } from "@/lib/image-utils";
import { callOpenRouter } from "@/lib/openrouter";
import { AI_MODELS } from "@/lib/constants";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2_000;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

const DETECT_PROMPT = `Identify all distinct furniture and decor items in this photo that could be made into 3D models (e.g. sofas, chairs, tables, beds, cabinets, large lamps, large plant pots).

For each item return a JSON object with:
- "id": a unique string ID (e.g. "item-1")
- "label": specific English name (e.g. "three-seater leather sofa", "round marble coffee table")
- "label_zh": Chinese name (e.g. "三人皮沙发", "圆形大理石茶几")
- "furnitureType": must be exactly one of: "upholstered", "glass", "metal-frame", "stone-top", "wood", "mixed"
- "box_2d": [ymin, xmin, ymax, xmax] bounding box coordinates normalized between 0 and 1000. It must tightly enclose the item.

Return ONLY a JSON array.`;

async function callGeminiText(base64Image: string, mimeType: string, prompt: string): Promise<string> {
  const resp = await callOpenRouter({
    model: AI_MODELS.GEMINI_31_FLASH_IMAGE,
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
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

    if (!checkRateLimit(`detect3d:${userId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
      structuredLog("detect3d.rate_limited", { userId, orgId: auth.orgId });
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 },
      );
    }

    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: "Missing required field: image" }, { status: 400 });
    }

    if (imageFile.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size is 10 MB." }, { status: 400 });
    }

    const rawBuffer = Buffer.from(await imageFile.arrayBuffer());
    try {
      await validateImageBuffer(rawBuffer);
    } catch {
      return NextResponse.json({ error: "Invalid image file" }, { status: 400 });
    }
    const optimizedBuffer = await optimizeForOpenRouter(rawBuffer);
    const base64Image = optimizedBuffer.toString("base64");

    structuredLog("detect3d.start", { userId, orgId: auth.orgId, fileSize: imageFile.size });

    try {
      const regions = await retryWithDelay(
        async () => {
          const raw = await callGeminiText(base64Image, "image/jpeg", DETECT_PROMPT);
          return parseGeminiJSON(raw, Model3DDetectResponseSchema);
        },
        {
          maxAttempts: MAX_ATTEMPTS,
          delayMs: RETRY_DELAY_MS,
          onError: (err, attempt) =>
            structuredLog("detect3d.attempt_failed", { userId, orgId: auth.orgId, attempt, error: err.message }),
        },
      );

      structuredLog("detect3d.success", { userId, orgId: auth.orgId, regionCount: regions.length });
      return NextResponse.json({ regions });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      structuredLog("detect3d.failed", { userId, orgId: auth.orgId, error: msg });
      return NextResponse.json({ error: "Failed to detect furniture. Please try again." }, { status: 502 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    structuredLog("detect3d.error", { userId, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
