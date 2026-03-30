import { getOrgBySlug } from "@/lib/dal";
import { notFound } from "next/navigation";
import { VendorPageClient } from "./client";

export const revalidate = 3600;

export default async function VendorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const org = await getOrgBySlug(slug);

  if (!org) notFound();

  return (
    <VendorPageClient
      orgName={org.name}
      orgSlug={org.slug}
      description={org.description}
      wechatQr={org.wechatQr}
      materialCount={org._count.materials}
    />
  );
}
