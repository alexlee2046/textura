import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Zone 1: Public routes — zero auth overhead
  const isPublicRoute =
    pathname.startsWith("/v/") ||
    pathname.startsWith("/s/") ||
    pathname.startsWith("/api/materials") ||
    pathname.startsWith("/api/organizations");

  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-"));

  if (isPublicRoute && !hasAuthCookie) {
    return NextResponse.next({ request });
  }

  // Zone 2: Protected routes — redirect to login if no cookie
  if (!hasAuthCookie) {
    const needsAuth =
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/my");

    if (needsAuth) {
      return NextResponse.redirect(
        new URL(`/login?next=${encodeURIComponent(pathname)}`, request.url),
      );
    }
  }

  // Has cookie or unmatched route → refresh token
  if (hasAuthCookie) {
    return updateSession(request);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
