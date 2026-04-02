import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAuth } from "@/lib/api-guard";
import { MATERIAL_STATUS } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const auth = await requireOrgAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim();
  const ids = searchParams.get("ids");
  const series = searchParams.get("series");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  const baseWhere = {
    organizationId: auth.orgId,
    status: MATERIAL_STATUS.ACTIVE,
    deletedAt: null as Date | null,
  };

  let where: Record<string, unknown>;

  if (ids) {
    // Batch lookup by IDs (favorites, history)
    const idList = ids.split(",").map((s) => s.trim()).filter(Boolean);
    where = { ...baseWhere, id: { in: idList } };
  } else if (series) {
    // Colors within a series
    where = { ...baseWhere, name: series };
  } else if (q) {
    // Text search across name, color, colorCode, seriesCode
    where = {
      ...baseWhere,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { color: { contains: q, mode: "insensitive" } },
        { colorCode: { contains: q, mode: "insensitive" } },
        { seriesCode: { contains: q, mode: "insensitive" } },
      ],
    };
  } else {
    return NextResponse.json([]);
  }

  const materials = await prisma.material.findMany({
    where,
    select: {
      id: true,
      name: true,
      seriesCode: true,
      category: true,
      color: true,
      colorCode: true,
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { url: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: limit,
  });

  const result = materials.map((m) => ({
    id: m.id,
    name: m.name,
    seriesCode: m.seriesCode,
    category: m.category,
    color: m.color,
    colorCode: m.colorCode,
    imageUrl: m.images[0]?.url ?? null,
  }));

  return NextResponse.json(result);
}
