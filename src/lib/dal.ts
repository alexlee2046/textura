import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { cache } from "react";

export type AuthUser = {
  userId: string;
  email: string;
};

export type OrgContext = {
  userId: string;
  email: string;
  orgId: string;
  orgSlug: string;
  role: string;
};

/** Require authenticated user. Redirects to /login if not authenticated. */
export const getAuthUser = cache(async (): Promise<AuthUser> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return { userId: user.id, email: user.email ?? "" };
});

/** Require authenticated user with active org membership. Redirects to /onboarding if no org. */
export const getOrgContext = cache(async (): Promise<OrgContext> => {
  const { userId, email } = await getAuthUser();

  const member = await prisma.organizationMember.findFirst({
    where: { userId, status: "active" },
    include: { organization: { select: { id: true, slug: true } } },
    orderBy: { joinedAt: "asc" },
  });

  if (!member) redirect("/onboarding");

  return {
    userId,
    email,
    orgId: member.organizationId,
    orgSlug: member.organization.slug,
    role: member.role,
  };
});

/** Get user if authenticated, or null. No redirects. */
export const getOptionalUser = cache(
  async (): Promise<AuthUser | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    return { userId: user.id, email: user.email ?? "" };
  },
);

/** Require platform admin. Redirects to / if not admin. */
export async function requirePlatformAdmin(): Promise<AuthUser> {
  const { userId, email } = await getAuthUser();

  const admin = await prisma.adminUser.findUnique({
    where: { userId, isActive: true },
  });

  if (!admin) redirect("/");

  return { userId, email };
}

/** Sync org claims to Supabase app_metadata (call after org membership changes). */
export async function syncOrgClaims(userId: string): Promise<void> {
  const admin = createAdminClient();

  const member = await prisma.organizationMember.findFirst({
    where: { userId, status: "active" },
    orderBy: { joinedAt: "asc" },
  });

  const platformAdmin = await prisma.adminUser.findUnique({
    where: { userId, isActive: true },
  });

  const { data: userData } = await admin.auth.admin.getUserById(userId);
  if (!userData.user) return;

  const current = userData.user.app_metadata;
  const newMeta = {
    ...current,
    organization_id: member?.organizationId ?? null,
    organization_role: member?.role ?? null,
    is_platform_admin: !!platformAdmin,
  };

  // Skip update if nothing changed
  if (
    current?.organization_id === newMeta.organization_id &&
    current?.organization_role === newMeta.organization_role &&
    current?.is_platform_admin === newMeta.is_platform_admin
  ) {
    return;
  }

  await admin.auth.admin.updateUserById(userId, { app_metadata: newMeta });
}
