import { NextResponse } from "next/server";
import { GOOGLE_TOKEN_URL, GOOGLE_USERINFO_URL, getGoogleConfig, createUserSession } from "@/lib/user-auth";
import { upsertGoogleUser } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  try {
    const rl = rateLimit(`oauth-cb:${getClientIp(request)}`, 20, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.redirect(`${origin}/login?auth_error=rate_limited`);
    }

    const config = getGoogleConfig();
    if (!config) {
      return NextResponse.redirect(`${origin}/login?auth_error=not_configured`);
    }

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieState = request.headers
      .get("cookie")
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("oauth_state="))
      ?.split("=")[1];

    if (!code || !state || !cookieState || state !== cookieState) {
      return NextResponse.redirect(`${origin}/login?auth_error=invalid_state`);
    }

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      return NextResponse.redirect(`${origin}/login?auth_error=token_exchange`);
    }
    const tokens = await tokenRes.json();

    const userinfoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userinfoRes.ok) {
      return NextResponse.redirect(`${origin}/login?auth_error=userinfo`);
    }
    const profile = await userinfoRes.json();

    if (!profile.sub) {
      return NextResponse.redirect(`${origin}/login?auth_error=no_profile`);
    }

    const user = await upsertGoogleUser({
      google_id: profile.sub,
      email: profile.email ?? "",
      name: profile.name ?? profile.email ?? "User",
      picture: profile.picture ?? null,
    });

    await createUserSession(user.id);

    const res = NextResponse.redirect(origin);
    res.cookies.delete("oauth_state");
    return res;
  } catch (err) {
    console.error("[Auth] Google callback error:", err);
    return NextResponse.redirect(`${origin}/login?auth_error=server`);
  }
}
