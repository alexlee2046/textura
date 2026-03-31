import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/dal";
import { saveUploadedFile } from "@/lib/storage";
import { revalidateVendorPage } from "@/lib/revalidate";
import { MATERIAL_CATEGORIES } from "@/lib/constants";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/dashboard/materials/[id] — update a material
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await getOrgContext();
    const { id } = await context.params;

    // Verify material belongs to org
    const existing = await prisma.material.findFirst({
      where: { id, organizationId: ctx.orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const category = formData.get("category") as string | null;
    const name = formData.get("name") as string | null;
    const seriesCode = formData.get("series_code") as string | null;
    const color = formData.get("color") as string | null;
    const colorCode = formData.get("color_code") as string | null;
    const promptModifier = formData.get("prompt_modifier") as string | null;
    const image = formData.get("image") as File | null;

    if (category) {
      const validCategories = MATERIAL_CATEGORIES.map((c) => c.key);
      if (!validCategories.includes(category as (typeof validCategories)[number])) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
      }
    }

    // Build update data — only include fields that were explicitly sent
    const updateData: Record<string, unknown> = {};
    if (category !== null) updateData.category = category;
    if (name !== null) updateData.name = name;
    if (formData.has("series_code")) updateData.seriesCode = seriesCode || null;
    if (formData.has("color")) updateData.color = color || null;
    if (formData.has("color_code")) updateData.colorCode = colorCode || null;
    if (formData.has("prompt_modifier")) updateData.promptModifier = promptModifier || "";

    // Handle image update
    if (image && image.size > 0) {
      const imageUrl = await saveUploadedFile(image);

      await prisma.$transaction(async (tx) => {
        if (Object.keys(updateData).length > 0) {
          await tx.material.update({
            where: { id },
            data: updateData,
          });
        }

        // Upsert primary image: delete existing primary, create new one
        await tx.materialImage.deleteMany({
          where: { materialId: id, isPrimary: true },
        });
        await tx.materialImage.create({
          data: {
            materialId: id,
            organizationId: ctx.orgId,
            url: imageUrl,
            storageKey: imageUrl,
            isPrimary: true,
          },
        });
      });
    } else if (Object.keys(updateData).length > 0) {
      await prisma.material.update({
        where: { id },
        data: updateData,
      });
    }

    revalidateVendorPage(ctx.orgSlug).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    throw error;
  }
}

// DELETE /api/dashboard/materials/[id] — soft delete a material
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const ctx = await getOrgContext();
    const { id } = await context.params;

    // Verify material belongs to org
    const existing = await prisma.material.findFirst({
      where: { id, organizationId: ctx.orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    await prisma.material.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidateVendorPage(ctx.orgSlug).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    throw error;
  }
}
