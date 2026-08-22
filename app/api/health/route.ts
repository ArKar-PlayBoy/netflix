import { NextResponse } from "next/server";
import { pingDb } from "@/lib/db";

// Called by Vercel Cron every 5 minutes to keep Neon awake —
// eliminates the multi-second cold-wake tax on real visitors.
export async function GET() {
  try {
    await pingDb();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Health] ping failed:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
