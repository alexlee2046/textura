import type { ReactNode } from "react";
import { getOrgContext } from "@/lib/dal";
import { OrgProvider } from "@/contexts/OrgContext";
import AppNavbar from "@/components/AppNavbar";

export default async function MyLayout({
  children,
}: {
  children: ReactNode;
}) {
  const ctx = await getOrgContext();

  return (
    <OrgProvider orgSlug={ctx.orgSlug} orgId={ctx.orgId}>
      <AppNavbar />
      {children}
    </OrgProvider>
  );
}
