import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/db";
import { createSession } from "@/lib/admin-auth";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { rateLimit, resetRateLimit, getClientIp } from "@/lib/rate-limit";
import { recordSecurityEvent, isIpBlocked } from "@/lib/db";
import { ATTACKER_MESSAGE } from "@/lib/security-message";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 min window
const LOCKOUT_MS = 15 * 60 * 1000; // 15 min lockout

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (await isIpBlocked(ip)) {
      return NextResponse.json(
        { success: false, error: "Access blocked due to suspicious activity.", message: ATTACKER_MESSAGE },
        { status: 403 }
      );
    }
    const rl = rateLimit(`admin-login:${ip}`, MAX_ATTEMPTS, WINDOW_MS, LOCKOUT_MS);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many attempts. Try again in ${Math.ceil(rl.retryAfterSec / 60)} minute(s).`, message: ATTACKER_MESSAGE },
        { status: 429 }
      );
    }

    const { password } = await request.json();

    if (!password || typeof password !== "string") {
      return NextResponse.json({ success: false, error: "Password required" }, { status: 400 });
    }

    // Single round-trip auth check
    const result = await authenticateAdmin(password);

    if (result.needsSetup) {
      return NextResponse.json({ success: true, needsSetup: true });
    }

    if (!result.ok) {
      await logAudit(AUDIT_ACTIONS.LOGIN, `Failed login attempt from ${ip}`);
      await recordSecurityEvent(ip, "bruteforce", "Failed admin login");
      return NextResponse.json({ success: false, error: "Invalid password" }, { status: 401 });
    }

    resetRateLimit(`admin-login:${ip}`);
    await createSession();
    await logAudit(AUDIT_ACTIONS.LOGIN, "Admin signed in");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Login] Error:", err);
    return NextResponse.json({ success: false, error: "Login failed" }, { status: 500 });
  }
}
