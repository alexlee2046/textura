import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/dal";
import { INQUIRY_STATUS } from "@/lib/constants";

const VALID_STATUSES = Object.values(INQUIRY_STATUS);

// GET /api/dashboard/inquiries — list inquiries for the org
export async function GET(request: NextRequest) {
  try {
    const ctx = await getOrgContext();

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
    const skip = (page - 1) * limit;

    const where = { organizationId: ctx.orgId };

    const [inquiries, total] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        include: {
          material: {
            select: { id: true, name: true, category: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.inquiry.count({ where }),
    ]);

    const items = inquiries.map((inq) => ({
      id: inq.id,
      contactName: inq.contactName,
      phone: inq.phone,
      company: inq.company,
      message: inq.message,
      status: inq.status,
      createdAt: inq.createdAt,
      materialName: inq.material?.name ?? null,
      materialCategory: inq.material?.category ?? null,
    }));

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    throw error;
  }
}

// PATCH /api/dashboard/inquiries — update inquiry status
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getOrgContext();

    const body = await request.json();
    const { id, status } = body as { id?: string; status?: string };

    if (!id || !status) {
      return NextResponse.json(
        { error: "id and status are required" },
        { status: 400 },
      );
    }

    if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }

    // Ensure the inquiry belongs to the org
    const inquiry = await prisma.inquiry.findFirst({
      where: { id, organizationId: ctx.orgId },
    });

    if (!inquiry) {
      return NextResponse.json(
        { error: "Inquiry not found" },
        { status: 404 },
      );
    }

    const updated = await prisma.inquiry.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (error) {
    throw error;
  }
}
