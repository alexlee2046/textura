import { NextResponse } from "next/server";
import { requireOrgAuth } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireOrgAuth();
  if (auth instanceof NextResponse) return auth;

  const org = await prisma.organization.findUnique({
    where: { id: auth.orgId },
    select: { credits: true, plan: true },
  });

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  return NextResponse.json({
    credits: org.credits,
    plan: org.plan,
    orgId: auth.orgId,
  });
}
