import { NextResponse } from "next/server";
import { verifyAdminPassword, createSession, hasAdminAccount } from "@/lib/admin-auth";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password || typeof password !== "string") {
      return NextResponse.json({ success: false, error: "Password required" }, { status: 400 });
    }

    const hasAdmin = await hasAdminAccount();
    if (!hasAdmin) {
      return NextResponse.json({ success: true, needsSetup: true });
    }

    const valid = await verifyAdminPassword(password);
    if (!valid) {
      return NextResponse.json({ success: false, error: "Invalid password" }, { status: 401 });
    }

    await createSession();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Login] Error:", err);
    return NextResponse.json({ success: false, error: "Login failed" }, { status: 500 });
  }
}
