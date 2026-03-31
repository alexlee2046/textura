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

    // Handle image update — ownership check + mutation in single transaction (TOCTOU-safe)
    if (image && image.size > 0) {
      const imageUrl = await saveUploadedFile(image);

      await prisma.$transaction(async (tx) => {
        // Atomic ownership check: updateMany scopes to orgId + non-deleted
        if (Object.keys(updateData).length > 0) {
          const { count } = await tx.material.updateMany({
            where: { id, organizationId: ctx.orgId, deletedAt: null },
            data: updateData,
          });
          if (count === 0) throw new Error("MATERIAL_NOT_FOUND");
        } else {
          // No field updates but still need to verify ownership
          const exists = await tx.material.findFirst({
            where: { id, organizationId: ctx.orgId, deletedAt: null },
            select: { id: true },
          });
          if (!exists) throw new Error("MATERIAL_NOT_FOUND");
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
      const { count } = await prisma.material.updateMany({
        where: { id, organizationId: ctx.orgId, deletedAt: null },
        data: updateData,
      });
      if (count === 0) {
        return NextResponse.json({ error: "Material not found" }, { status: 404 });
      }
    } else {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    revalidateVendorPage(ctx.orgSlug).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "MATERIAL_NOT_FOUND") {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }
    throw error;
  }
}

// DELETE /api/dashboard/materials/[id] — soft delete a material
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const ctx = await getOrgContext();
    const { id } = await context.params;

    // Atomic ownership check + soft delete (TOCTOU-safe)
    const { count } = await prisma.material.updateMany({
      where: { id, organizationId: ctx.orgId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    if (count === 0) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    revalidateVendorPage(ctx.orgSlug).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    throw error;
  }
}
