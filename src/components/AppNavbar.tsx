"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useUser } from "@/hooks/useUser";
import { usePathname } from "next/navigation";
import Link from "next/link";
import UserMenu from "@/components/UserMenu";

interface AppNavbarProps {
  onCtaClick?: () => void;
  onLoginClick?: () => void;
}

const APP_LINKS = [
  { key: "retexture" as const, href: "/my/retexture" },
  { key: "scene" as const, href: "/my/scene" },
  { key: "multiFabric" as const, href: "/my/multi-fabric" },
  { key: "orthographic" as const, href: "/my/orthographic" },
  { key: "viewer" as const, href: "/my/viewer" },
  { key: "history" as const, href: "/my/history" },
];

export default function AppNavbar({ onCtaClick, onLoginClick }: AppNavbarProps) {
  const pathname = usePathname();
  const { user, loading } = useUser();
  const locale = useLocale();
  const setLocale = (_l: string) => { /* TODO: implement locale switching via next-intl routing */ };
  const tLanding = useTranslations("LandingPage.nav");
  const tApp = useTranslations("AppNavbar");

  const isAppMode = pathname.startsWith("/my") && !!user;

  const [scrolled, setScrolled] = useState(isAppMode);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (isAppMode) return; // always opaque in app mode
    const onScroll = () => {
      const next = window.scrollY > 50;
      setScrolled((prev) => (prev === next ? prev : next));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isAppMode]);

  useEffect(() => {
    if (user) {
      fetch("/api/credits")
        .then((r) => r.json())
        .then((d) => setCredits(d.credits ?? null))
        .catch(() => {});
    }
  }, [user]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileOpen(false);
  };

  const isActive = useCallback(
    (href: string) => {
      if (href === "/app") return pathname === "/app";
      return pathname.startsWith(href);
    },
    [pathname]
  );

  const navBg =
    isAppMode || scrolled
      ? "bg-white/80 backdrop-blur-xl border-b border-zinc-200/80 shadow-sm"
      : "bg-transparent";

  // Skeleton during loading on app routes
  if (loading && pathname.startsWith("/my")) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-b border-zinc-200/80 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center">
          <span className="text-lg font-semibold tracking-tight text-zinc-900">
            XinVise · 心维
          </span>
        </div>
      </nav>
    );
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${navBg}`}
    >
      {/* Gradient guard for transparent state (landing only) */}
      {!isAppMode && !scrolled && (
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/[0.06] to-transparent pointer-events-none" />
      )}

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href={isAppMode ? "/app" : "/"}
          className="text-lg font-semibold tracking-tight text-zinc-900 shrink-0"
        >
          XinVise · 心维
        </Link>

        {isAppMode ? (
          <>
            {/* Desktop: tool links */}
            <div className="hidden md:flex items-center gap-1">
              {APP_LINKS.map((link) => (
                <Link
                  key={link.key}
                  href={link.href}
                  className={`relative text-sm px-3 py-4 transition-colors ${
                    isActive(link.href)
                      ? "text-zinc-900 font-medium"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  {tApp(link.key)}
                  {isActive(link.href) && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-zinc-900 rounded-full" />
                  )}
                </Link>
              ))}
            </div>

            {/* Desktop: right side */}
            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
                className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors px-2 py-1"
              >
                {locale === "zh" ? "EN" : "中"}
              </button>
              {credits !== null && (
                <span className="flex items-center gap-1 text-sm text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-full">
                  <Zap className="w-3.5 h-3.5" />
                  {credits}
                </span>
              )}
              <UserMenu />
            </div>

            {/* Mobile: hamburger */}
            <div className="flex md:hidden items-center gap-2">
              {credits !== null && (
                <span className="flex items-center gap-1 text-xs text-zinc-500 bg-zinc-100 px-2 py-1 rounded-full">
                  <Zap className="w-3 h-3" />
                  {credits}
                </span>
              )}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="w-11 h-11 flex items-center justify-center text-zinc-600"
                aria-label="Menu"
              >
                {mobileOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Landing: desktop nav */}
            <div className="hidden md:flex items-center gap-6">
              <button
                onClick={() => scrollTo("features")}
                className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                {tLanding("features")}
              </button>
              <button
                onClick={() => scrollTo("enterprise")}
                className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                {tLanding("enterprise")}
              </button>
            </div>

            {/* Landing: right side */}
            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
                className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors px-2 py-1"
              >
                {locale === "zh" ? "EN" : "中"}
              </button>
              <button
                onClick={onLoginClick}
                className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                {tLanding("login")}
              </button>
              <button
                onClick={onCtaClick}
                className="text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 px-4 py-2 rounded-full transition-colors"
              >
                {tLanding("cta")}
              </button>
            </div>

            {/* Landing: mobile */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={onCtaClick}
                className="text-xs font-medium text-white bg-zinc-900 px-3 py-1.5 rounded-full"
              >
                {tLanding("cta")}
              </button>
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="w-11 h-11 flex items-center justify-center text-zinc-600"
                aria-label="Menu"
              >
                {mobileOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 top-16 bg-black/30 z-40"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-16 inset-x-0 bg-white/95 backdrop-blur-xl border-b border-zinc-200 z-50 p-4 flex flex-col gap-3"
            >
              {isAppMode ? (
                <>
                  {APP_LINKS.map((link) => (
                    <Link
                      key={link.key}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`text-left text-sm py-2 ${
                        isActive(link.href)
                          ? "text-zinc-900 font-medium"
                          : "text-zinc-600"
                      }`}
                    >
                      {tApp(link.key)}
                    </Link>
                  ))}
                  <button
                    onClick={() => {
                      setLocale(locale === "zh" ? "en" : "zh");
                      setMobileOpen(false);
                    }}
                    className="text-left text-sm text-zinc-500 py-2"
                  >
                    {locale === "zh" ? "Switch to English" : "切换到中文"}
                  </button>
                  <div className="border-t border-zinc-100 pt-2 mt-1">
                    <UserMenu />
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => scrollTo("features")}
                    className="text-left text-sm text-zinc-700 py-2"
                  >
                    {tLanding("features")}
                  </button>
                  <button
                    onClick={() => scrollTo("enterprise")}
                    className="text-left text-sm text-zinc-700 py-2"
                  >
                    {tLanding("enterprise")}
                  </button>
                  <button
                    onClick={() => {
                      onLoginClick?.();
                      setMobileOpen(false);
                    }}
                    className="text-left text-sm text-zinc-700 py-2"
                  >
                    {tLanding("login")}
                  </button>
                  <button
                    onClick={() => {
                      setLocale(locale === "zh" ? "en" : "zh");
                      setMobileOpen(false);
                    }}
                    className="text-left text-sm text-zinc-500 py-2"
                  >
                    {locale === "zh" ? "Switch to English" : "切换到中文"}
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
