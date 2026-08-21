import { NextResponse } from "next/server";
import { destroySession } from "@/lib/admin-auth";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";

export async function POST() {
  try {
    await destroySession();
    await logAudit(AUDIT_ACTIONS.LOGOUT, "Admin signed out");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Logout failed" }, { status: 500 });
  }
}
