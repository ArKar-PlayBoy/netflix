import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const session = request.cookies.get("admin_session")?.value;

    // Login page: bounce authed admins straight to the panel
    if (pathname === "/admin/login") {
      if (session) {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      }
      return NextResponse.next();
    }

    // Everything else under /admin requires a session cookie.
    // (Real HMAC validation happens server-side in the (panel) layout —
    // this is just a fast UX redirect for missing cookies.)
    if (!session) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
