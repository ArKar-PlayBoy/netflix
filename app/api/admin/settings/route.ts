import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAllSettings, updateSettings } from "@/lib/settings";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";

export async function GET() {
  try {
    await requireAdmin();
    const settings = await getAllSettings();
    return NextResponse.json({ success: true, data: { settings } });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const { settings } = body;
    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ success: false, error: "Settings object required" }, { status: 400 });
    }

    await updateSettings(settings);
    await logAudit(AUDIT_ACTIONS.SETTINGS_UPDATE, `Updated keys: ${Object.keys(settings).join(", ")}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Failed to update settings" }, { status: 500 });
  }
}
