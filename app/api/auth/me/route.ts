import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json({ success: true, data: { user } });
  } catch (err) {
    console.error("[Auth] Me error:", err);
    return NextResponse.json({ success: false, error: "Failed to get user" }, { status: 500 });
  }
}
