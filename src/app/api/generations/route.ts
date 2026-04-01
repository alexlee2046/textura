import { NextRequest, NextResponse } from "next/server";
import { requireOrgAuth } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireOrgAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
  const type = searchParams.get("type"); // retexture | scene | multi_fabric | orthographic

  const where = {
    organizationId: auth.orgId,
    ...(type ? { type } : {}),
  };

  const [generations, total] = await Promise.all([
    prisma.generation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        type: true,
        mode: true,
        creditCost: true,
        inputImageUrl: true,
        resultImageUrl: true,
        shareHash: true,
        materialSnapshot: true,
        createdAt: true,
        userId: true,
      },
    }),
    prisma.generation.count({ where }),
  ]);

  return NextResponse.json({
    generations,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
