"use client";

import { logout } from "@/app/(auth)/logout/actions";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => logout()}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
    >
      <LogOut className="h-3.5 w-3.5" />
      退出登录
    </button>
  );
}
