import { NextResponse } from "next/server";
import { destroyUserSession, getCurrentUser } from "@/lib/user-auth";
import { bumpUserSessionVer } from "@/lib/db";

export async function POST() {
  try {
    // Revoke EVERY session of this user across all devices
    const user = await getCurrentUser();
    if (user) await bumpUserSessionVer(user.id);
    await destroyUserSession();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Auth] Logout error:", err);
    return NextResponse.json({ success: false, error: "Logout failed" }, { status: 500 });
  }
}
