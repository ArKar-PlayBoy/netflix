import { NextResponse } from "next/server";
import { safeJson } from "@/lib/http";
import bcrypt from "bcryptjs";
import { findUserByEmailHash } from "@/lib/db";
import { hmacHash } from "@/lib/crypto";
import { createUserSession } from "@/lib/user-auth";
import { rateLimit, resetRateLimit, getClientIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { recordSecurityEvent, isIpBlocked } from "@/lib/db";
import { ATTACKER_MESSAGE } from "@/lib/security-message";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

// Dummy hash — comparing against this when user not found keeps
// response time constant (prevents user-enumeration via timing)
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO1QJ8Q6RV7dUvU0TfL/QZfRlFeZLRaUW";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (await isIpBlocked(ip)) {
      return NextResponse.json(
        { success: false, error: "Access blocked due to suspicious activity.", message: ATTACKER_MESSAGE },
        { status: 403 }
      );
    }
    const rl = rateLimit(`user-login:${ip}`, MAX_ATTEMPTS, WINDOW_MS, LOCKOUT_MS);
    if (!rl.allowed) { void recordSecurityEvent(ip, "bruteforce", "Login flood (lockout)"); }
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many attempts. Try again in ${Math.ceil(rl.retryAfterSec / 60)} minute(s).`, message: ATTACKER_MESSAGE },
        { status: 429 }
      );
    }

    const parsed = await safeJson(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Email and password are required." }, { status: 400 });
    }

    const user = await findUserByEmailHash(hmacHash(email));
    const valid = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);

    if (!user || !valid) {
      await logAudit("user.login", `Failed sign-in for ${email || "unknown"} (${ip})`);
      await recordSecurityEvent(ip, "bruteforce", `Failed user login for ${email}`);
      return NextResponse.json({ success: false, error: "Invalid email or password." }, { status: 401 });
    }

    if (!user.password_hash) {
      // Account exists only via Google — no password set
      return NextResponse.json(
        { success: false, error: "This account uses Google sign-in. Continue with Google instead." },
        { status: 400 }
      );
    }

    resetRateLimit(`user-login:${ip}`);
    await createUserSession(user.id, user.session_ver);
    await logAudit("user.login", `Signed in "${user.name}" <${user.email}> (${ip})`);

    return NextResponse.json({ success: true, data: { name: user.name } });
  } catch (err) {
    console.error("[UserLogin] Error:", err);
    return NextResponse.json({ success: false, error: "Sign-in failed" }, { status: 500 });
  }
}
