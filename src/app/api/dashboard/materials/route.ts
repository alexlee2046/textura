import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/dal";
import { saveUploadedFile } from "@/lib/storage";
import { revalidateVendorPage } from "@/lib/revalidate";
import { MEMBER_ROLE, MATERIAL_STATUS, MATERIAL_CATEGORIES } from "@/lib/constants";

// GET /api/dashboard/materials — list materials for the org
export async function GET(request: NextRequest) {
  try {
    const ctx = await getOrgContext();

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
    const skip = (page - 1) * limit;

    const where = {
      organizationId: ctx.orgId,
      deletedAt: null,
    };

    const [materials, total] = await Promise.all([
      prisma.material.findMany({
        where,
        include: {
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { id: true, url: true },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.material.count({ where }),
    ]);

    const items = materials.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      seriesCode: m.seriesCode,
      color: m.color,
      colorCode: m.colorCode,
      promptModifier: m.promptModifier,
      status: m.status,
      sortOrder: m.sortOrder,
      createdAt: m.createdAt,
      imageUrl: m.images[0]?.url ?? null,
      imageId: m.images[0]?.id ?? null,
    }));

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    // Redirect responses from getOrgContext should be rethrown
    throw error;
  }
}

// POST /api/dashboard/materials — create a new material
export async function POST(request: NextRequest) {
  try {
    const ctx = await getOrgContext();

    if (ctx.role !== MEMBER_ROLE.OWNER && ctx.role !== MEMBER_ROLE.MEMBER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const category = formData.get("category") as string | null;
    const name = formData.get("name") as string | null;
    const seriesCode = (formData.get("series_code") as string) || null;
    const color = (formData.get("color") as string) || null;
    const colorCode = (formData.get("color_code") as string) || null;
    const promptModifier = (formData.get("prompt_modifier") as string) || "";
    const image = formData.get("image") as File | null;

    // Validate required fields
    if (!category || !name) {
      return NextResponse.json(
        { error: "category and name are required" },
        { status: 400 },
      );
    }

    const validCategories = MATERIAL_CATEGORIES.map((c) => c.key);
    if (!validCategories.includes(category as (typeof validCategories)[number])) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 },
      );
    }

    if (!image) {
      return NextResponse.json(
        { error: "Image is required" },
        { status: 400 },
      );
    }

    // Save image file
    const imageUrl = await saveUploadedFile(image);

    // Create material + primary image in a transaction
    const material = await prisma.$transaction(async (tx) => {
      const mat = await tx.material.create({
        data: {
          organizationId: ctx.orgId,
          category,
          name,
          seriesCode,
          color,
          colorCode,
          promptModifier,
          status: MATERIAL_STATUS.ACTIVE,
          createdBy: ctx.userId,
        },
      });

      await tx.materialImage.create({
        data: {
          materialId: mat.id,
          organizationId: ctx.orgId,
          url: imageUrl,
          storageKey: imageUrl,
          isPrimary: true,
        },
      });

      return mat;
    });

    // Revalidate vendor page (fire-and-forget)
    revalidateVendorPage(ctx.orgSlug).catch(() => {});

    return NextResponse.json(
      { ...material, imageUrl },
      { status: 201 },
    );
  } catch (error) {
    throw error;
  }
}
