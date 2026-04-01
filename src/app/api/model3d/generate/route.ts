import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgWithCredits } from "@/lib/api-guard";
import { deductOrgCredits, refundOrgCredits } from "@/lib/credits";
import { tripoCreateTask, tripoUploadImage } from "@/lib/tripo";
import { MODEL3D_ACTIVE_STATUSES, MODEL3D_CREDIT_COST } from "@/lib/model3d-constants";
import { checkRateLimit } from "@/lib/rate-limit";
import sharp from "sharp";

const CONCURRENT_LIMIT = 2;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

interface PendingClaim {
  generationId: string;
  orgId: string;
  userId: string;
  key: string;
}

async function releasePendingClaim(c: PendingClaim) {
  await prisma.model3DGeneration.updateMany({
    where: {
      id: c.generationId,
      organizationId: c.orgId,
      status: "pending",
      idempotencyKey: c.key,
    },
    data: {
      status: "enhancing",
      idempotencyKey: null,
    },
  });
}

export async function POST(req: Request) {
  let claim: PendingClaim | null = null;

  try {
    const body = await req.json();
    const { generationId, idempotencyKey } = body as {
      generationId?: string;
      idempotencyKey?: string;
    };

    if (!generationId || !idempotencyKey) {
      return NextResponse.json(
        { error: "Missing generationId or idempotencyKey" },
        { status: 400 },
      );
    }

    const auth = await requireOrgWithCredits(0);
    if (auth instanceof NextResponse) return auth;
    const { userId, orgId, orgCredits } = auth;

    if (!checkRateLimit(`generate3d:${userId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 },
      );
    }

    const record = await prisma.model3DGeneration.findUnique({
      where: { id: generationId },
    });
    if (!record) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }
    // Multi-tenant ownership: check org, not just user
    if (record.organizationId !== orgId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (record.idempotencyKey === idempotencyKey && record.status !== "enhancing") {
      return NextResponse.json({
        generationId: record.id,
        status: record.status,
        creditsDeducted: 0,
        creditsRemaining: orgCredits,
      });
    }

    if (record.idempotencyKey && record.idempotencyKey !== idempotencyKey) {
      return NextResponse.json(
        { error: "This 3D task has already been submitted." },
        { status: 409 },
      );
    }

    if (record.status !== "enhancing") {
      return NextResponse.json(
        { error: `Invalid status: expected "enhancing", got "${record.status}"` },
        { status: 409 },
      );
    }
    if (!record.enhancedImageUrl) {
      return NextResponse.json({ error: "Enhanced image not ready" }, { status: 400 });
    }
    if (record.mode === "precision" && !record.enhancedImage2Url) {
      return NextResponse.json(
        { error: "Second enhanced image required for precision mode" },
        { status: 400 },
      );
    }

    const creditCost = MODEL3D_CREDIT_COST[record.mode as keyof typeof MODEL3D_CREDIT_COST];
    if (orgCredits < creditCost) {
      return NextResponse.json({ error: "INSUFFICIENT_CREDITS" }, { status: 402 });
    }

    const claimed = await prisma.model3DGeneration.updateMany({
      where: {
        id: generationId,
        organizationId: orgId,
        status: "enhancing",
        idempotencyKey: null,
      },
      data: {
        idempotencyKey,
        status: "pending",
      },
    });

    if (claimed.count === 0) {
      const current = await prisma.model3DGeneration.findUnique({
        where: { id: generationId },
      });

      if (current?.idempotencyKey === idempotencyKey) {
        return NextResponse.json({
          generationId: current.id,
          status: current.status,
          creditsDeducted: 0,
          creditsRemaining: orgCredits,
        });
      }

      return NextResponse.json(
        { error: "This 3D task has already been submitted." },
        { status: 409 },
      );
    }

    claim = { generationId, orgId, userId, key: idempotencyKey };

    const inProgressCount = await prisma.model3DGeneration.count({
      where: {
        organizationId: orgId,
        status: { in: [...MODEL3D_ACTIVE_STATUSES] },
      },
    });
    if (inProgressCount > CONCURRENT_LIMIT) {
      await releasePendingClaim(claim);
      claim = null;

      return NextResponse.json(
        { error: `You already have ${CONCURRENT_LIMIT} in-progress tasks. Please wait for them to finish.` },
        { status: 429 },
      );
    }

    async function downloadConvertUpload(url: string): Promise<string> {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download enhanced image: HTTP ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const pngBuffer = await sharp(buffer).png().toBuffer();
      return tripoUploadImage(pngBuffer, "image/png");
    }

    let imageToken: string;
    let imageToken2: string | undefined;

    if (record.mode === "precision" && record.enhancedImage2Url) {
      [imageToken, imageToken2] = await Promise.all([
        downloadConvertUpload(record.enhancedImageUrl),
        downloadConvertUpload(record.enhancedImage2Url),
      ]);
    } else {
      imageToken = await downloadConvertUpload(record.enhancedImageUrl);
    }

    const newBalance = await deductOrgCredits(
      orgId,
      userId,
      creditCost,
      `3D model generation (${record.mode})`,
    );
    if (newBalance === null) {
      await releasePendingClaim(claim);
      claim = null;
      return NextResponse.json({ error: "INSUFFICIENT_CREDITS" }, { status: 402 });
    }

    let tripoTaskId: string;
    try {
      tripoTaskId = await tripoCreateTask(record.mode as "quick" | "precision", {
        imageToken,
        imageToken2,
      });
    } catch (tripoErr) {
      await refundOrgCredits(
        orgId,
        userId,
        creditCost,
        `3D generation task creation failed: ${tripoErr instanceof Error ? tripoErr.message : "unknown"}`,
      );
      await releasePendingClaim(claim);
      claim = null;
      throw new Error("3D generation is temporarily unavailable");
    }

    try {
      await prisma.model3DGeneration.updateMany({
        where: {
          id: generationId,
          organizationId: orgId,
          status: "pending",
          idempotencyKey,
        },
        data: {
          tripoTaskId,
          status: "processing",
          submittedAt: new Date(),
        },
      });
    } catch (dbErr) {
      console.error(
        `Orphaned Tripo task ${tripoTaskId} -- DB update failed after task creation:`,
        dbErr,
      );
      await refundOrgCredits(
        orgId,
        userId,
        creditCost,
        `DB update failed after Tripo task creation, orphaned task: ${tripoTaskId}`,
      ).catch((refundErr) =>
        console.error("Refund also failed for orphaned task:", refundErr),
      );
      await releasePendingClaim(claim);
      claim = null;
      throw new Error("3D generation submission failed, credits refunded");
    }

    claim = null;

    return NextResponse.json({
      generationId,
      status: "processing",
      creditsDeducted: creditCost,
      creditsRemaining: newBalance,
    });
  } catch (error) {
    if (claim) {
      await releasePendingClaim(claim).catch((releaseError) => {
        console.error("Failed to release pending 3D generation claim:", releaseError);
      });
    }

    console.error("model3d/generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 },
    );
  }
}
