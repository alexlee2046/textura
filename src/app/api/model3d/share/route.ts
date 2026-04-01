import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAuth } from "@/lib/api-guard";
import { nanoid } from "nanoid";

export async function POST(req: Request) {
  try {
    const auth = await requireOrgAuth();
    if (auth instanceof NextResponse) return auth;
    const { orgId } = auth;

    const body = (await req.json()) as { generationId?: string };
    const { generationId } = body;

    if (!generationId || typeof generationId !== "string") {
      return NextResponse.json(
        { error: "Missing required field: generationId" },
        { status: 400 },
      );
    }

    const record = await prisma.model3DGeneration.findUnique({
      where: { id: generationId },
      select: {
        organizationId: true,
        status: true,
        modelUrl: true,
        shareHash: true,
      },
    });

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // Multi-tenant ownership check
    if (record.organizationId !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (record.status !== "completed" || !record.modelUrl) {
      return NextResponse.json(
        { error: "Model not ready for sharing" },
        { status: 400 },
      );
    }

    // Return existing share hash if already created
    if (record.shareHash) {
      return NextResponse.json({
        shareHash: record.shareHash,
        shareUrl: `/m/${record.shareHash}`,
      });
    }

    // Generate a unique hash and update the record
    const shareHash = nanoid(10);
    await prisma.model3DGeneration.update({
      where: { id: generationId },
      data: { shareHash },
    });

    return NextResponse.json({
      shareHash,
      shareUrl: `/m/${shareHash}`,
    });
  } catch (error) {
    console.error("[model3d/share] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
