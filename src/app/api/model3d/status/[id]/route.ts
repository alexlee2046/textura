import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgWithCredits } from "@/lib/api-guard";
import { refundOrgCredits } from "@/lib/credits";
import { tripoDownloadAsStream, tripoGetStatus } from "@/lib/tripo";
import { isCosConfigured, uploadStreamToCos } from "@/lib/cos-storage";
import { MODEL3D_ACTIVE_STATUSES } from "@/lib/model3d-constants";

const TIMEOUT_MS = 30 * 60 * 1000;
const DOWNLOADING_TIMEOUT_MS = 5 * 60 * 1000;
const COS_RETRY_DELAYS = [1000, 2000, 4000];

async function failAndRefund(
  id: string,
  orgId: string,
  userId: string,
  creditCost: number,
  reason: string,
) {
  const claimed = await prisma.model3DGeneration.updateMany({
    where: {
      id,
      organizationId: orgId,
      status: { in: [...MODEL3D_ACTIVE_STATUSES] },
    },
    data: { status: "failed" },
  });

  if (claimed.count === 0) {
    return null;
  }

  const balance = await refundOrgCredits(orgId, userId, creditCost, reason);
  await prisma.model3DGeneration.update({
    where: { id },
    data: { status: "refunded" },
  });

  return balance;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const auth = await requireOrgWithCredits(0);
    if (auth instanceof NextResponse) return auth;
    const { orgId, orgCredits } = auth;

    const record = await prisma.model3DGeneration.findUnique({
      where: { id },
      select: {
        organizationId: true,
        userId: true,
        status: true,
        mode: true,
        creditCost: true,
        tripoTaskId: true,
        modelUrl: true,
        enhancedImageUrl: true,
        tripoResultUrl: true,
        submittedAt: true,
        updatedAt: true,
      },
    });
    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Multi-tenant ownership check
    if (record.organizationId !== orgId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (record.status === "completed") {
      return NextResponse.json({
        status: "completed",
        modelUrl: record.modelUrl,
        enhancedImageUrl: record.enhancedImageUrl,
        creditsRemaining: orgCredits,
      });
    }
    if (record.status === "failed" || record.status === "refunded") {
      return NextResponse.json({
        status: record.status,
        error:
          record.status === "refunded"
            ? "Generation failed. Credits have been refunded."
            : "Generation failed.",
        creditsRemaining: orgCredits,
      });
    }
    if (!record.tripoTaskId) {
      return NextResponse.json({
        status: record.status,
        progress: 0,
        creditsRemaining: orgCredits,
      });
    }

    // Use submittedAt for overall timeout (doesn't reset on status transitions)
    const now = Date.now();
    const timeoutBase = record.submittedAt ?? record.updatedAt;

    if (now - timeoutBase.getTime() > TIMEOUT_MS) {
      const balance = await failAndRefund(
        id,
        orgId,
        record.userId,
        record.creditCost,
        `3D generation timed out (${record.mode})`,
      );
      return NextResponse.json({
        status: "refunded",
        error: "Generation timed out. Credits refunded.",
        creditsRemaining: balance ?? orgCredits,
      });
    }

    if (record.status === "downloading" && now - record.updatedAt.getTime() > DOWNLOADING_TIMEOUT_MS) {
      const balance = await failAndRefund(
        id,
        orgId,
        record.userId,
        record.creditCost,
        `3D generation stuck at 100% downloading (${record.mode})`,
      );
      return NextResponse.json({
        status: "refunded",
        error: "Generation stuck at 100%. Credits refunded.",
        creditsRemaining: balance ?? orgCredits,
      });
    }

    const tripoStatus = await tripoGetStatus(record.tripoTaskId);

    if (tripoStatus.status === "queued") {
      return NextResponse.json({
        status: "pending",
        progress: tripoStatus.progress,
        creditsRemaining: orgCredits,
      });
    }

    if (tripoStatus.status === "running") {
      return NextResponse.json({
        status: "processing",
        progress: tripoStatus.progress,
        creditsRemaining: orgCredits,
      });
    }

    if (tripoStatus.status === "failed") {
      const balance = await failAndRefund(
        id,
        orgId,
        record.userId,
        record.creditCost,
        `3D generation failed (${record.mode})`,
      );
      return NextResponse.json({
        status: "refunded",
        error: "3D generation failed. Credits refunded.",
        creditsRemaining: balance ?? orgCredits,
      });
    }

    const locked = await prisma.model3DGeneration.updateMany({
      where: { id, status: "processing" },
      data: {
        status: "downloading",
        tripoResultUrl: tripoStatus.modelUrl ?? null,
        tripoExpiresAt: tripoStatus.modelUrl
          ? new Date(Date.now() + 24 * 60 * 60 * 1000)
          : null,
      },
    });

    const modelSourceUrl = tripoStatus.modelUrl;

    if (locked.count === 0) {
      const current = await prisma.model3DGeneration.findUnique({
        where: { id },
        select: { status: true, modelUrl: true, enhancedImageUrl: true },
      });

      if (current?.status === "downloading" && !current.modelUrl) {
        // Another poll request is already handling the download
        return NextResponse.json({
          status: "downloading",
          progress: 100,
          creditsRemaining: orgCredits,
        });
      }

      return NextResponse.json({
        status: current?.status ?? "processing",
        progress: 100,
        modelUrl: current?.modelUrl,
        enhancedImageUrl: current?.enhancedImageUrl,
        creditsRemaining: orgCredits,
      });
    }

    if (!modelSourceUrl) {
      const balance = await failAndRefund(
        id,
        orgId,
        record.userId,
        record.creditCost,
        `3D generation returned success but no model URL (${record.mode})`,
      );
      return NextResponse.json({
        status: "refunded",
        error: "3D generation returned no model. Credits refunded.",
        creditsRemaining: balance ?? orgCredits,
      });
    }

    // Mark completed immediately with Tripo URL so client is unblocked
    const completed = await prisma.model3DGeneration.updateMany({
      where: { id, status: "downloading" },
      data: {
        status: "completed",
        modelUrl: modelSourceUrl,
      },
    });

    if (completed.count === 0) {
      const current = await prisma.model3DGeneration.findUnique({
        where: { id },
        select: { status: true },
      });
      return NextResponse.json({
        status: current?.status ?? "refunded",
        error: "Generation timed out. Credits refunded.",
        creditsRemaining: orgCredits,
      });
    }

    // Upload GLB to COS synchronously with retry + timeout.
    // On success, return COS URL; on failure, fall back to Tripo URL (24h TTL).
    let finalModelUrl = modelSourceUrl;

    if (isCosConfigured) {
      const cosKey = `model3d/${id}/model.glb`;

      for (let attempt = 0; attempt < COS_RETRY_DELAYS.length; attempt++) {
        let body: ReadableStream<Uint8Array> | null = null;
        try {
          const result = await tripoDownloadAsStream(modelSourceUrl);
          body = result.body;
          const cosUrl = await uploadStreamToCos(cosKey, body, "model/gltf-binary", result.contentLength);
          body = null;
          await prisma.model3DGeneration.updateMany({
            where: { id, status: "completed", modelUrl: modelSourceUrl },
            data: { modelUrl: cosUrl },
          });
          finalModelUrl = cosUrl;
          break;
        } catch (err) {
          console.error(
            `COS upload attempt ${attempt + 1} failed:`,
            err instanceof Error ? err.message : err,
          );
          if (attempt < COS_RETRY_DELAYS.length - 1) {
            await new Promise((r) => setTimeout(r, COS_RETRY_DELAYS[attempt]));
          } else {
            console.warn(
              `COS upload failed after ${COS_RETRY_DELAYS.length} attempts, returning Tripo URL (24h TTL)`,
            );
          }
        } finally {
          if (body) body.cancel().catch(() => {});
        }
      }
    }

    return NextResponse.json({
      status: "completed",
      modelUrl: finalModelUrl,
      enhancedImageUrl: record.enhancedImageUrl,
      creditsRemaining: orgCredits,
    });
  } catch (error) {
    console.error("model3d/status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status check failed" },
      { status: 500 },
    );
  }
}
