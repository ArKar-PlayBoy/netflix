import { NextResponse } from "next/server";
import { safeJson } from "@/lib/http";
import bcrypt from "bcryptjs";
import { findUserByEmailHash, createEmailUser } from "@/lib/db";
import { hmacHash } from "@/lib/crypto";
import { createUserSession } from "@/lib/user-auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    // Abuse limit applies only in production — local testing never locks out
    if (process.env.NODE_ENV === "production") {
      const rl = rateLimit(`register:${ip}`, 3, 60 * 60 * 1000); // 3 per hour
      if (!rl.allowed) {
        return NextResponse.json(
          { success: false, error: "Too many sign-up attempts. Try again later." },
          { status: 429 }
        );
      }
    }

    const parsed = await safeJson(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ success: false, error: "Please enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ success: false, error: "Password must be 8–128 characters." }, { status: 400 });
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json({ success: false, error: "Password needs at least one letter and one number." }, { status: 400 });
    }
    if (!name || name.length > 60) {
      return NextResponse.json({ success: false, error: "Please enter your name (max 60 characters)." }, { status: 400 });
    }

    const existing = await findUserByEmailHash(hmacHash(email));
    if (existing) {
      const hasGoogle = !!existing.google_id;
      return NextResponse.json(
        {
          success: false,
          error: hasGoogle
            ? "This email is already registered with Google. Please use 'Continue with Google'."
            : "An account with this email already exists. Please sign in.",
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createEmailUser({ email, name, passwordHash });

    await createUserSession(user.id, user.session_ver);
    await logAudit("user.register", `Registered "${user.name}" <${email}> from ${ip}`);

    return NextResponse.json({ success: true, data: { name: user.name } });
  } catch (err) {
    console.error("[Register] Error:", err);
    return NextResponse.json({ success: false, error: "Registration failed" }, { status: 500 });
  }
}
