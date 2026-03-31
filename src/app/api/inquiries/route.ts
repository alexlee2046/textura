import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getOptionalUser } from "@/lib/dal";
import { sendInquiryNotification } from "@/lib/email";
import { MATERIAL_STATUS, INQUIRY_STATUS } from "@/lib/constants";

const inquirySchema = z.object({
  material_id: z.string().uuid(),
  generation_id: z.string().uuid().optional(),
  contact_name: z.string().min(1, "请填写联系人姓名"),
  phone: z.string().min(5, "请填写有效电话号码"),
  company: z.string().optional(),
  message: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // ---- Auth (optional — anonymous users can also inquire) ----------------
    const user = await getOptionalUser();

    // ---- Parse & validate body --------------------------------------------
    const body = await request.json();
    const parsed = inquirySchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Invalid input";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { material_id, generation_id, contact_name, phone, company, message } =
      parsed.data;

    // ---- Look up material to get organization_id --------------------------
    const material = await prisma.material.findUnique({
      where: {
        id: material_id,
        status: MATERIAL_STATUS.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
        organization: {
          select: {
            name: true,
            notifyEmail: true,
          },
        },
      },
    });

    if (!material) {
      return NextResponse.json(
        { error: "Material not found" },
        { status: 404 },
      );
    }

    // ---- Create Inquiry record --------------------------------------------
    await prisma.inquiry.create({
      data: {
        organizationId: material.organizationId,
        materialId: material.id,
        generationId: generation_id ?? null,
        userId: user?.userId ?? null,
        contactName: contact_name,
        phone,
        company: company || null,
        message: message || null,
        status: INQUIRY_STATUS.PENDING,
      },
    });

    // ---- Send email notification (fire-and-forget) ------------------------
    if (material.organization.notifyEmail) {
      sendInquiryNotification({
        vendorEmail: material.organization.notifyEmail,
        vendorName: material.organization.name,
        materialName: material.name,
        contactName: contact_name,
        phone,
        company: company || undefined,
        message: message || undefined,
      }).catch((err) => {
        console.error("[Email] Failed to send inquiry notification:", err);
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error in POST /api/inquiries:", error);
    const msg =
      error instanceof Error ? error.message : "Failed to submit inquiry";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
