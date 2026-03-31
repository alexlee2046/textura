import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/dal";
import { MEMBER_ROLE, MEMBER_STATUS } from "@/lib/constants";

// GET /api/admin/organizations — list all orgs with member count
export async function GET() {
  try {
    await requirePlatformAdmin();

    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        contactEmail: true,
        createdAt: true,
        _count: { select: { members: true, materials: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const items = orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      contactEmail: o.contactEmail,
      createdAt: o.createdAt,
      memberCount: o._count.members,
      materialCount: o._count.materials,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    throw error;
  }
}

// POST /api/admin/organizations — create org
export async function POST(request: NextRequest) {
  try {
    const admin = await requirePlatformAdmin();

    const body = await request.json();
    const { name, slug } = body as { name?: string; slug?: string };

    if (!name || !slug) {
      return NextResponse.json(
        { error: "name and slug are required" },
        { status: 400 },
      );
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "slug must be lowercase alphanumeric with hyphens" },
        { status: 400 },
      );
    }

    // Check uniqueness
    const existing = await prisma.organization.findUnique({
      where: { slug },
    });
    if (existing) {
      return NextResponse.json(
        { error: "slug already exists" },
        { status: 409 },
      );
    }

    // Create org and add admin as owner
    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: { name, slug },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: created.id,
          userId: admin.userId,
          role: MEMBER_ROLE.OWNER,
          status: MEMBER_STATUS.ACTIVE,
        },
      });

      return created;
    });

    return NextResponse.json(org, { status: 201 });
  } catch (error) {
    throw error;
  }
}
