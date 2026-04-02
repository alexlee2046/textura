import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAuth } from "@/lib/api-guard";
import { MATERIAL_STATUS } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const auth = await requireOrgAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category");
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 200);

  const materials = await prisma.material.findMany({
    where: {
      organizationId: auth.orgId,
      status: MATERIAL_STATUS.ACTIVE,
      deletedAt: null,
      ...(category ? { category } : {}),
    },
    select: {
      name: true,
      seriesCode: true,
      category: true,
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { url: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  // Group by (name, seriesCode) to build series entries
  const seriesMap = new Map<string, {
    name: string;
    seriesCode: string | null;
    category: string;
    colorCount: number;
    representativeImage: string | null;
  }>();

  for (const m of materials) {
    const key = `${m.name}::${m.seriesCode ?? ""}`;
    const existing = seriesMap.get(key);
    if (existing) {
      existing.colorCount++;
    } else {
      seriesMap.set(key, {
        name: m.name,
        seriesCode: m.seriesCode,
        category: m.category,
        colorCount: 1,
        representativeImage: m.images[0]?.url ?? null,
      });
    }
  }

  const series = [...seriesMap.values()].slice(0, limit);

  return NextResponse.json({ series });
}
