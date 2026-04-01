import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { MEMBER_STATUS, type MemberRole } from "@/lib/constants";

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const forbidden = () =>
  NextResponse.json({ error: "Forbidden" }, { status: 403 });

const insufficientCredits = () =>
  NextResponse.json({ error: "INSUFFICIENT_CREDITS" }, { status: 402 });

export type ApiAuthResult = { userId: string };

export type ApiOrgAuthResult = {
  userId: string;
  orgId: string;
  orgSlug: string;
  role: MemberRole;
};

export type ApiCreditResult = ApiOrgAuthResult & { orgCredits: number };

/** Require authenticated user (no org context). */
export async function requireAuth(): Promise<ApiAuthResult | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();
  return { userId: user.id };
}

/** Require authenticated user with active org membership. */
export async function requireOrgAuth(): Promise<
  ApiOrgAuthResult | NextResponse
> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const member = await prisma.organizationMember.findFirst({
    where: { userId: auth.userId, status: MEMBER_STATUS.ACTIVE },
    include: { organization: { select: { id: true, slug: true } } },
    orderBy: { joinedAt: "asc" },
  });

  if (!member) return forbidden();

  return {
    userId: auth.userId,
    orgId: member.organizationId,
    orgSlug: member.organization.slug,
    role: member.role as MemberRole,
  };
}

/** Require org auth + minimum credits. */
export async function requireOrgWithCredits(
  minCredits: number,
): Promise<ApiCreditResult | NextResponse> {
  const orgAuth = await requireOrgAuth();
  if (orgAuth instanceof NextResponse) return orgAuth;

  const org = await prisma.organization.findUnique({
    where: { id: orgAuth.orgId },
    select: { credits: true },
  });

  if (!org || org.credits < minCredits) return insufficientCredits();

  return { ...orgAuth, orgCredits: org.credits };
}

/** Require platform admin. */
export async function requireAdmin(): Promise<ApiAuthResult | NextResponse> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const admin = await prisma.adminUser.findUnique({
    where: { userId: auth.userId, isActive: true },
  });

  if (!admin) return forbidden();
  return auth;
}
