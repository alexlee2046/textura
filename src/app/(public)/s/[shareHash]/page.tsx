import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MATERIAL_STATUS, SITE_URL } from "@/lib/constants";
import SharePageClient from "./client";

export const revalidate = false;

interface Props {
  params: Promise<{ shareHash: string }>;
}

type MaterialSnapshot = {
  id?: string;
  name?: string;
  category?: string;
  color?: string;
  colorCode?: string;
  seriesCode?: string;
  promptModifier?: string;
  organizationId?: string;
  vendorSlug?: string;
  swatchUrl?: string;
};

const getGeneration = cache(async (hash: string) => {
  return prisma.generation.findUnique({
    where: { shareHash: hash },
    include: {
      organization: {
        select: {
          name: true,
          slug: true,
          logoUrl: true,
        },
      },
    },
  });
});

const getRelatedMaterials = cache(
  async (orgId: string, excludeId: string | null) => {
    return prisma.material.findMany({
      where: {
        organizationId: orgId,
        status: MATERIAL_STATUS.ACTIVE,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: {
        id: true,
        name: true,
        color: true,
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true },
        },
      },
      take: 4,
      orderBy: { sortOrder: "asc" },
    });
  },
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareHash } = await params;
  const gen = await getGeneration(shareHash);
  if (!gen) return { title: "Not Found" };

  const snapshot = gen.materialSnapshot as MaterialSnapshot;
  const orgName = gen.organization?.name;
  const pageUrl = `${SITE_URL}/s/${shareHash}`;
  const ogImageUrl = `${SITE_URL}/s/${shareHash}/opengraph-image`;

  const title = snapshot.name
    ? `${snapshot.name}${snapshot.color ? ` ${snapshot.color}` : ""} — ${orgName || "Textura"}`
    : "AI 材质可视化 — Textura";

  const description = orgName
    ? `看看 ${orgName} ${snapshot.name || "材质"} 的换装效果 | Textura`
    : "查看 AI 生成的材质换装效果 | Textura";

  return {
    title,
    description,
    openGraph: {
      type: "article",
      url: pageUrl,
      title,
      description,
      siteName: "Textura",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          type: "image/jpeg",
        },
      ],
    },
    other: {
      image_src: ogImageUrl,
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { shareHash } = await params;
  const gen = await getGeneration(shareHash);
  if (!gen) notFound();

  const snapshot = gen.materialSnapshot as MaterialSnapshot;
  const org = gen.organization;

  // Fetch related materials from the same vendor
  const relatedRaw = gen.organizationId
    ? await getRelatedMaterials(gen.organizationId, gen.materialId)
    : [];

  const relatedMaterials = relatedRaw.map((m) => ({
    id: m.id,
    name: m.name,
    color: m.color,
    imageUrl: m.images[0]?.url ?? null,
  }));

  return (
    <>
      {/* Hidden image for WeChat crawler -- non-lazy, >=300x300, first img in DOM */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${SITE_URL}/s/${shareHash}/opengraph-image`}
        alt=""
        width={600}
        height={315}
        style={{ position: "absolute", left: "-9999px", top: 0 }}
      />
      <SharePageClient
        beforeImage={gen.inputImageUrl}
        afterImage={gen.resultImageUrl}
        materialName={snapshot.name ?? null}
        materialColor={snapshot.color ?? null}
        swatchUrl={snapshot.swatchUrl ?? null}
        orgName={org?.name ?? null}
        orgSlug={org?.slug ?? null}
        orgLogoUrl={org?.logoUrl ?? null}
        materialId={snapshot.id ?? null}
        shareUrl={`${SITE_URL}/s/${shareHash}`}
        relatedMaterials={relatedMaterials}
      />
    </>
  );
}
