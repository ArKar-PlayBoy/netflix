import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/user-auth";
import { findUserById, setUserPassword } from "@/lib/db";
import { safeEqual } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const full = await findUserById(user.id);
    return NextResponse.json({ success: true, data: { hasPassword: !!full?.password_hash } });
  } catch (err) {
    console.error("[SetPassword] GET error:", err);
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (newPassword.length < 8 || newPassword.length > 128 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return NextResponse.json(
        { success: false, error: "Password must be 8+ characters with letters and numbers." },
        { status: 400 }
      );
    }

    const full = await findUserById(sessionUser.id);
    if (!full) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

    // Changing an EXISTING password requires the current one
    if (full.password_hash) {
      const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
      const ok = await bcrypt.compare(current, full.password_hash);
      if (!ok) {
        return NextResponse.json({ success: false, error: "Current password is incorrect." }, { status: 401 });
      }
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await setUserPassword(sessionUser.id, hash);
    await logAudit("user.password", `Password ${full.password_hash ? "changed" : "created"} for <${sessionUser.email}>`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[SetPassword] POST error:", err);
    return NextResponse.json({ success: false, error: "Failed to set password" }, { status: 500 });
  }
}
