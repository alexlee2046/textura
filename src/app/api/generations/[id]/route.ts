import { NextRequest, NextResponse } from "next/server";
import { requireOrgAuth } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrgAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const generation = await prisma.generation.findFirst({
    where: { id, organizationId: auth.orgId },
  });

  if (!generation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(generation);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrgAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const { count } = await prisma.generation.deleteMany({
    where: { id, organizationId: auth.orgId },
  });

  if (count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
