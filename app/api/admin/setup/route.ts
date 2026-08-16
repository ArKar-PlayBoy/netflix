import { NextResponse } from "next/server";
import { initializeAdminPassword, createSession } from "@/lib/admin-auth";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ success: false, error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const created = await initializeAdminPassword(password);
    if (!created) {
      return NextResponse.json({ success: false, error: "Admin already exists" }, { status: 409 });
    }

    await createSession();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Setup] Error:", err);
    return NextResponse.json({ success: false, error: "Setup failed" }, { status: 500 });
  }
}
