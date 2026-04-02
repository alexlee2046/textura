"use client";

import { createContext, useContext, type ReactNode } from "react";

type OrgContextValue = {
  orgSlug: string;
  orgId: string;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({
  children,
  orgSlug,
  orgId,
}: {
  children: ReactNode;
  orgSlug: string;
  orgId: string;
}) {
  return (
    <OrgContext.Provider value={{ orgSlug, orgId }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
