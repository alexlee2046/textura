import { getOrgContext } from "@/lib/dal";
import { OrgProvider } from "@/contexts/OrgContext";

export default async function MyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getOrgContext();

  return (
    <OrgProvider orgSlug={ctx.orgSlug} orgId={ctx.orgId}>
      {children}
    </OrgProvider>
  );
}
