import { prisma } from "@/lib/prisma";
import { getOrgBySlug } from "@/lib/dal";
import { MATERIAL_STATUS, MATERIAL_CATEGORIES } from "@/lib/constants";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCategoryLabel(key: string): string {
  const found = MATERIAL_CATEGORIES.find((c) => c.key === key);
  return found ? found.label : key;
}

async function getMaterialWithImages(materialId: string) {
  return prisma.material.findUnique({
    where: { id: materialId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      seriesCode: true,
      color: true,
      colorCode: true,
      category: true,
      promptModifier: true,
      status: true,
      deletedAt: true,
      images: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          url: true,
          isPrimary: true,
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

type PageProps = {
  params: Promise<{ slug: string; materialId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, materialId } = await params;

  const [org, material] = await Promise.all([
    getOrgBySlug(slug),
    getMaterialWithImages(materialId),
  ]);

  if (!org || !material || material.organizationId !== org.id) {
    return {};
  }

  const title = `${material.name} - ${org.name} | Textura`;
  const description = material.promptModifier
    ? material.promptModifier.slice(0, 160)
    : `${org.name} ${getCategoryLabel(material.category)} - ${material.name}`;

  const primaryImage = material.images[0]?.url;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(primaryImage ? { images: [{ url: primaryImage }] } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const revalidate = 3600;

export default async function MaterialDetailPage({ params }: PageProps) {
  const { slug, materialId } = await params;

  const [org, material] = await Promise.all([
    getOrgBySlug(slug),
    getMaterialWithImages(materialId),
  ]);

  if (!org) notFound();
  if (!material) notFound();
  if (material.organizationId !== org.id) notFound();
  if (material.status !== MATERIAL_STATUS.ACTIVE || material.deletedAt) {
    notFound();
  }

  const primaryImage = material.images[0]?.url ?? null;
  const galleryImages = material.images.filter((img) => !img.isPrimary);
  const categoryLabel = getCategoryLabel(material.category);

  const vendorUrl = `/v/${slug}`;
  const tryOnUrl = `/v/${slug}?material=${material.id}`;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      {/* Back navigation */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href={vendorUrl}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <span>返回 {org.name}</span>
        </Link>
      </nav>

      <div className="space-y-8">
        {/* Hero section: image + info */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Primary image */}
          <div className="overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
            {primaryImage ? (
              <div className="relative aspect-square w-full">
                <Image
                  src={primaryImage}
                  alt={material.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                  priority
                />
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center text-muted-foreground">
                暂无图片
              </div>
            )}
          </div>

          {/* Material info */}
          <div className="flex flex-col justify-center space-y-5">
            <div className="space-y-3">
              <Badge variant="secondary">{categoryLabel}</Badge>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {material.name}
              </h1>
            </div>

            {/* Attributes */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {material.seriesCode && (
                <div>
                  <dt className="text-muted-foreground">系列编号</dt>
                  <dd className="mt-0.5 font-medium">{material.seriesCode}</dd>
                </div>
              )}
              {material.color && (
                <div>
                  <dt className="text-muted-foreground">颜色</dt>
                  <dd className="mt-0.5 flex items-center gap-2 font-medium">
                    {material.colorCode && (
                      <span
                        className="inline-block size-4 rounded-full border border-border"
                        style={{ backgroundColor: material.colorCode }}
                        aria-hidden="true"
                      />
                    )}
                    {material.color}
                  </dd>
                </div>
              )}
              {material.colorCode && !material.color && (
                <div>
                  <dt className="text-muted-foreground">色号</dt>
                  <dd className="mt-0.5 flex items-center gap-2 font-medium">
                    <span
                      className="inline-block size-4 rounded-full border border-border"
                      style={{ backgroundColor: material.colorCode }}
                      aria-hidden="true"
                    />
                    {material.colorCode}
                  </dd>
                </div>
              )}
            </dl>

            {/* Description */}
            {material.promptModifier && (
              <div>
                <h2 className="text-sm font-medium text-muted-foreground">
                  描述
                </h2>
                <p className="mt-1 text-sm leading-relaxed">
                  {material.promptModifier}
                </p>
              </div>
            )}

            {/* CTA */}
            <div className="pt-2">
              <Link
                href={tryOnUrl}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "w-full md:w-auto",
                )}
              >
                <Sparkles className="size-4" data-icon="inline-start" />
                在你的家具上试试
              </Link>
            </div>
          </div>
        </div>

        {/* Gallery (only if there are non-primary images) */}
        {galleryImages.length > 0 && (
          <section aria-label="更多图片">
            <h2 className="mb-3 text-lg font-semibold">更多图片</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {galleryImages.map((img) => (
                <div
                  key={img.id}
                  className="overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800"
                >
                  <div className="relative aspect-square w-full">
                    <Image
                      src={img.url}
                      alt={`${material.name} - 图片`}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                      className="object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
