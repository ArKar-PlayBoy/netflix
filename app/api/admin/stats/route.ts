import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getVideoStats } from "@/lib/videos";

export async function GET() {
  try {
    await requireAdmin();
    const stats = await getVideoStats();
    return NextResponse.json({ success: true, data: { stats } });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Failed to load stats" }, { status: 500 });
  }
}
