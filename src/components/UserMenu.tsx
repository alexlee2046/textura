"use client";

import { useUser } from "@/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect, useRef } from "react";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";

export default function UserMenu() {
  const t = useTranslations("UserMenu");
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!user) return null;

  const initial = (user.email?.[0] ?? "U").toUpperCase();

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full bg-zinc-900 text-white flex items-center justify-center text-sm font-bold hover:bg-zinc-700 transition-colors"
        aria-label={t("ariaLabel")}
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-20 bg-white rounded-xl shadow-lg border border-zinc-200 py-2 min-w-[180px]">
          <p className="px-4 py-1.5 text-xs text-zinc-400 truncate">
            {user.email}
          </p>
          <hr className="my-1 border-zinc-100" />
          <button
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              setOpen(false);
              window.location.reload();
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t("signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
