import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const session = request.cookies.get("admin_session")?.value;

    // NOTE: we deliberately do NOT redirect away from /admin/login when a
    // cookie merely EXISTS — a revoked/stale cookie would create an infinite
    // login⇄dashboard loop. The (panel) layout performs real HMAC+version
    // validation and is the single source of truth.
    if (!session && pathname !== "/admin/login") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
