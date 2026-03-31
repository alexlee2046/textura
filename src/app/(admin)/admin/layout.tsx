import { requirePlatformAdmin } from "@/lib/dal";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Textura",
};

const NAV_LINKS = [
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/materials", label: "Materials" },
];

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-30 border-b border-border bg-white/80 backdrop-blur dark:bg-zinc-900/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/admin" className="text-sm font-semibold tracking-tight">
            Textura Admin
          </Link>
          <nav className="flex items-center gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 md:p-6">{children}</main>
    </div>
  );
}
