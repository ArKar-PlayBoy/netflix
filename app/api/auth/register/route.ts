import { NextResponse } from "next/server";
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
    const rl = rateLimit(`register:${ip}`, 3, 60 * 60 * 1000); // 3 per hour
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many sign-up attempts. Try again later." },
        { status: 429 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

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
      // Generic message — do not reveal which emails exist (user enumeration)
      return NextResponse.json(
        { success: false, error: "This email cannot be used. Try signing in or Google instead." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createEmailUser({ email, name, passwordHash });

    await createUserSession(user.id);
    await logAudit("user.register", `New account registered (${ip})`);

    return NextResponse.json({ success: true, data: { name: user.name } });
  } catch (err) {
    console.error("[Register] Error:", err);
    return NextResponse.json({ success: false, error: "Registration failed" }, { status: 500 });
  }
}
