import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { VendorPageClient } from "./client";

export const revalidate = 3600;

export default async function VendorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      wechatQr: true,
      _count: {
        select: {
          materials: {
            where: { status: "active", deletedAt: null },
          },
        },
      },
    },
  });

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
