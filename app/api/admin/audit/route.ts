import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAuditLogs, clearAuditLogs } from "@/lib/db";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const result = await getAuditLogs(page, 30);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Failed to load audit logs" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await requireAdmin();
    await clearAuditLogs();
    await logAudit(AUDIT_ACTIONS.AUDIT_CLEAR, "Cleared all audit logs");
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Failed to clear audit logs" }, { status: 500 });
  }
}
