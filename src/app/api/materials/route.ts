import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MATERIAL_STATUS } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const orgSlug = searchParams.get("org_slug");
  const category = searchParams.get("category");

  if (!orgSlug) {
    return NextResponse.json(
      { error: "org_slug is required" },
      { status: 400 },
    );
  }

  const orgExists = await prisma.organization.count({ where: { slug: orgSlug } });
  if (!orgExists) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 },
    );
  }

  const materials = await prisma.material.findMany({
    where: {
      organization: { slug: orgSlug },
      status: MATERIAL_STATUS.ACTIVE,
      deletedAt: null,
      ...(category ? { category } : {}),
    },
    select: {
      id: true,
      name: true,
      category: true,
      color: true,
      colorCode: true,
      seriesCode: true,
      sortOrder: true,
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { url: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  const result = materials.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    color: m.color,
    colorCode: m.colorCode,
    seriesCode: m.seriesCode,
    sortOrder: m.sortOrder,
    imageUrl: m.images[0]?.url ?? null,
  }));

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, max-age=600, s-maxage=600",
    },
  });
}
