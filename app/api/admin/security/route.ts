import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getSecurityEvents, clearSecurityEvents } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const since = parseInt(url.searchParams.get("since") || "0", 10) || 0;
    const data = await getSecurityEvents(since, 50);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Failed to load security events" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await requireAdmin();
    await clearSecurityEvents();
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Failed to clear events" }, { status: 500 });
  }
}
