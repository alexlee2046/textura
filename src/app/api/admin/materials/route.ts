import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/dal";

// GET /api/admin/materials — list all materials across orgs with search/filter
export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin();

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") || "";
    const orgId = searchParams.get("orgId") || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (orgId) {
      where.organizationId = orgId;
    }

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const [materials, total] = await Promise.all([
      prisma.material.findMany({
        where,
        select: {
          id: true,
          name: true,
          category: true,
          seriesCode: true,
          status: true,
          createdAt: true,
          organization: {
            select: { name: true, slug: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.material.count({ where }),
    ]);

    return NextResponse.json({ items: materials, total, page, limit });
  } catch (error) {
    throw error;
  }
}
