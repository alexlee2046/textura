import { getOrgContext } from "@/lib/dal";
import { DashboardProvider } from "@/components/dashboard/dashboard-context";
import { DesktopSidebar, MobileHeader } from "@/components/dashboard/sidebar";
import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Textura",
};

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const orgContext = await getOrgContext();

  return (
    <DashboardProvider value={orgContext}>
      <div className="flex h-screen overflow-hidden">
        <DesktopSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <MobileHeader />
          <main className="flex-1 overflow-y-auto bg-zinc-50/50 p-4 md:p-6 dark:bg-zinc-950/50">
            {children}
          </main>
        </div>
      </div>
    </DashboardProvider>
  );
}
