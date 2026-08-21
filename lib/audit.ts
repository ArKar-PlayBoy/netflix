import { addAuditLog } from "./db";

export async function logAudit(action: string, detail: string = ""): Promise<void> {
  try {
    await addAuditLog(action, detail);
  } catch (err) {
    console.error("[Audit] Failed to log:", err);
  }
}

export const AUDIT_ACTIONS = {
  LOGIN: "login",
  LOGOUT: "logout",
  SETUP: "setup",
  VIDEO_DELETE: "video.delete",
  VIDEO_LINK: "video.link",
  SCAN_RUN: "scan.run",
  SETTINGS_UPDATE: "settings.update",
  FEATURED_ADD: "featured.add",
  FEATURED_REMOVE: "featured.remove",
  FEATURED_CLEAR: "featured.clear",
  AUDIT_CLEAR: "audit.clear",
} as const;
