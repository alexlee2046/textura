"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { OrgContext } from "@/lib/dal";

const DashboardContext = createContext<OrgContext | null>(null);

export function DashboardProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: OrgContext;
}) {
  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useOrgContext(): OrgContext {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useOrgContext must be used within DashboardProvider");
  return ctx;
}
