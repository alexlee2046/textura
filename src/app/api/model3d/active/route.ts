import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAuth } from "@/lib/api-guard";
import { MODEL3D_ACTIVE_STATUSES } from "@/lib/model3d-constants";

export async function GET() {
  const auth = await requireOrgAuth();
  if (auth instanceof NextResponse) return auth;
  const { orgId } = auth;

  try {
    // Query by org for multi-tenant: show all active tasks in the organization
    const activeGeneration = await prisma.model3DGeneration.findFirst({
      where: {
        organizationId: orgId,
        status: { in: [...MODEL3D_ACTIVE_STATUSES] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!activeGeneration) {
      return NextResponse.json({ active: null });
    }

    return NextResponse.json({ active: activeGeneration });
  } catch (error) {
    console.error("model3d/active error:", error);
    return NextResponse.json({ error: "Failed to fetch active task" }, { status: 500 });
  }
}
