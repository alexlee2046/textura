import { getOrgBySlug } from "@/lib/dal";
import { notFound } from "next/navigation";
import { type ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) return {};

  return {
    title: `${org.name} — Textura`,
    description: `${org.name} 材质展示`,
  };
}

export default async function VendorLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-border bg-white/80 backdrop-blur-md dark:bg-zinc-950/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          {org.logoUrl ? (
            <Image
              src={org.logoUrl}
              alt={org.name}
              width={32}
              height={32}
              className="rounded-md"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              {org.name.charAt(0)}
            </div>
          )}
          <span className="text-base font-semibold">{org.name}</span>
        </div>
      </header>

      {children}
    </div>
  );
}
