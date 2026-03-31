import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/dal";
import { saveUploadedFile } from "@/lib/storage";
import { revalidateVendorPage } from "@/lib/revalidate";
import { MEMBER_ROLE } from "@/lib/constants";

// GET /api/dashboard/settings — return org details
export async function GET() {
  try {
    const ctx = await getOrgContext();

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: ctx.orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        description: true,
        contactEmail: true,
        notifyEmail: true,
        wechatQr: true,
      },
    });

    return NextResponse.json(org);
  } catch (error) {
    throw error;
  }
}

// PATCH /api/dashboard/settings — update org fields (owner only)
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getOrgContext();

    if (ctx.role !== MEMBER_ROLE.OWNER) {
      return NextResponse.json({ error: "仅组织所有者可修改设置" }, { status: 403 });
    }

    const formData = await request.formData();

    const name = formData.get("name") as string | null;
    const description = (formData.get("description") as string) || null;
    const contactEmail = (formData.get("contactEmail") as string) || null;
    const notifyEmail = (formData.get("notifyEmail") as string) || null;
    const logo = formData.get("logo") as File | null;
    const wechatQrFile = formData.get("wechatQr") as File | null;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "组织名称不能为空" }, { status: 400 });
    }

    // Build update data
    const updateData: Record<string, string | null> = {
      name: name.trim(),
      description: description?.trim() ?? null,
      contactEmail: contactEmail?.trim() ?? null,
      notifyEmail: notifyEmail?.trim() ?? null,
    };

    // Handle logo upload
    if (logo && logo.size > 0) {
      updateData.logoUrl = await saveUploadedFile(logo);
    }

    // Handle WeChat QR upload
    if (wechatQrFile && wechatQrFile.size > 0) {
      updateData.wechatQr = await saveUploadedFile(wechatQrFile);
    }

    const updated = await prisma.organization.update({
      where: { id: ctx.orgId },
      data: updateData,
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        description: true,
        contactEmail: true,
        notifyEmail: true,
        wechatQr: true,
      },
    });

    // Revalidate vendor page (fire-and-forget)
    revalidateVendorPage(ctx.orgSlug).catch(() => {});

    return NextResponse.json(updated);
  } catch (error) {
    throw error;
  }
}
