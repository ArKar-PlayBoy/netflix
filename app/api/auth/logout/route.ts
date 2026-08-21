import { NextResponse } from "next/server";
import { destroyUserSession } from "@/lib/user-auth";

export async function POST() {
  try {
    await destroyUserSession();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Auth] Logout error:", err);
    return NextResponse.json({ success: false, error: "Logout failed" }, { status: 500 });
  }
}
