import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { runScan, getScanLogs } from "@/lib/scanner";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";

export async function POST() {
  try {
    await requireAdmin();
    const result = await runScan();
    await logAudit(AUDIT_ACTIONS.SCAN_RUN, `Scanned ${result.filesFound} files: ${result.matched} matched, ${result.unmatched} unmatched`);
    return NextResponse.json({ success: true, data: { result } });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Scan failed" }, { status: 500 });
  }
}

export async function GET() {
  try {
    await requireAdmin();
    const logs = await getScanLogs(10);
    return NextResponse.json({ success: true, data: { logs } });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Failed to load scan logs" }, { status: 500 });
  }
}
