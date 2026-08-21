import { NextResponse } from "next/server";
import { buildGoogleAuthUrl, getGoogleConfig } from "@/lib/user-auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import crypto from "crypto";

export async function GET(request: Request) {
  try {
    const rl = rateLimit(`oauth-start:${getClientIp(request)}`, 10, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Try again shortly." },
        { status: 429 }
      );
    }

    const config = getGoogleConfig();
    if (!config) {
      return NextResponse.json(
        { success: false, error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." },
        { status: 500 }
      );
    }

    const origin = new URL(request.url).origin;
    const state = crypto.randomBytes(16).toString("hex");
    const redirectUri = `${origin}/api/auth/google/callback`;

    const authUrl = buildGoogleAuthUrl(redirectUri, state);

    const res = NextResponse.redirect(authUrl);
    res.cookies.set("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("[Auth] Google start error:", err);
    return NextResponse.json({ success: false, error: "Failed to start OAuth" }, { status: 500 });
  }
}
