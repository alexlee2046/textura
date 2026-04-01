// src/app/api/scene/background/route.ts
import { NextResponse } from "next/server";
import { requireOrgWithCredits } from "@/lib/api-guard";
import { callOpenRouterImageGen } from "@/lib/openrouter";
import { STYLE_MAP, ROOM_MAP, LIGHT_MAP } from "@/lib/scenePromptMaps";
import { AI_MODELS, CREDIT_COST } from "@/lib/constants";

export async function POST(req: Request) {
  try {
    // Pre-flight check: ensure org has enough credits before the expensive background generation call.
    // Actual deduction happens in the subsequent /api/scene/enhance call.
    const auth = await requireOrgWithCredits(CREDIT_COST.scene_enhance);
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json()) as {
      roomType: string;
      style: string;
      colorPalette: string;
      lighting: string;
      roomWidthM: number;
      roomDepthM: number;
    };

    const prompt = [
      `An empty ${STYLE_MAP[body.style] ?? body.style} ${ROOM_MAP[body.roomType] ?? body.roomType} interior,`,
      `${LIGHT_MAP[body.lighting] ?? "natural light"},`,
      body.colorPalette ? `color palette: ${body.colorPalette},` : "",
      `room approximately ${body.roomWidthM}m wide by ${body.roomDepthM}m deep,`,
      "photorealistic interior design photography, wide-angle lens,",
      "completely empty room with no furniture, clean floor ready for furniture placement,",
      "high resolution, architectural magazine quality.",
    ]
      .filter(Boolean)
      .join(" ");

    const fluxResp = await callOpenRouterImageGen({
      model: AI_MODELS.FLUX_2_PRO,
      prompt,
      n: 1,
      width: 1344,
      height: 768,
    });

    const fluxData = (await fluxResp.json()) as {
      data: { url?: string; b64_json?: string }[];
    };
    const item = fluxData.data?.[0];
    if (!item) throw new Error("Scene background generation returned no image");

    let roomBackground: string;
    if (item.b64_json) {
      roomBackground = `data:image/jpeg;base64,${item.b64_json}`;
    } else if (item.url) {
      const imgRes = await fetch(item.url);
      const buf = await imgRes.arrayBuffer();
      roomBackground = `data:image/jpeg;base64,${Buffer.from(buf).toString("base64")}`;
    } else {
      throw new Error(
        "Scene background generation returned invalid image data",
      );
    }

    return NextResponse.json({ success: true, roomBackground });
  } catch (error: unknown) {
    console.error("Error in /api/scene/background:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Scene background generation failed",
      },
      { status: 500 },
    );
  }
}
