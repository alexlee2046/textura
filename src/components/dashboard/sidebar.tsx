"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Layers, MessageSquare, Settings, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { logout } from "@/app/(auth)/logout/actions";
import { useOrgContext } from "./dashboard-context";

const NAV_ITEMS = [
  { href: "/dashboard/materials", label: "材质管理", icon: Layers },
  { href: "/dashboard/inquiries", label: "询盘记录", icon: MessageSquare },
  { href: "/dashboard/settings", label: "设置", icon: Settings },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function LogoutButton() {
  return (
    <form action={logout}>
      <Button
        variant="ghost"
        size="sm"
        type="submit"
        className="w-full justify-start gap-3 text-muted-foreground"
      >
        <LogOut className="h-4 w-4" />
        退出登录
      </Button>
    </form>
  );
}

/** Desktop sidebar (hidden on mobile) */
export function DesktopSidebar() {
  const org = useOrgContext();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          {org.orgSlug.charAt(0).toUpperCase()}
        </div>
        <span className="truncate text-sm font-semibold">{org.orgSlug}</span>
      </div>

      <div className="flex flex-1 flex-col justify-between p-3">
        <NavLinks />
        <LogoutButton />
      </div>
    </aside>
  );
}

/** Mobile header with hamburger sheet */
export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const org = useOrgContext();

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border px-4 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" className="h-8 w-8" />
          }
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          <span className="sr-only">菜单</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="border-b border-border px-4 py-4">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                {org.orgSlug.charAt(0).toUpperCase()}
              </div>
              {org.orgSlug}
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col justify-between p-3">
            <NavLinks onNavigate={() => setOpen(false)} />
            <LogoutButton />
          </div>
        </SheetContent>
      </Sheet>

      <span className="truncate text-sm font-semibold">{org.orgSlug}</span>
    </header>
  );
}
