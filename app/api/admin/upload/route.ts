import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { isR2Configured, getPresignedUploadUrl, headObject } from "@/lib/r2";
import { logAudit } from "@/lib/audit";

const ALLOWED_EXTENSIONS = [".mp4", ".mkv", ".webm", ".avi", ".mov"];
// Common release-name characters: dots, dashes, underscores, spaces, parens, brackets, apostrophes, etc.
const SAFE_KEY_RE = /^[a-zA-Z0-9._\- ()[\]'+,&!]+$/;

export async function POST(request: Request) {
  try {
    await requireAdmin();

    if (!isR2Configured()) {
      return NextResponse.json(
        { success: false, error: "R2 storage is not configured. Set R2 env vars." },
        { status: 500 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const contentType = typeof body.contentType === "string" ? body.contentType : "video/mp4";

    const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
    if (!fileName || !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { success: false, error: `Allowed types: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }
    if (!SAFE_KEY_RE.test(fileName) || fileName.includes("..")) {
      return NextResponse.json({ success: false, error: "Invalid file name" }, { status: 400 });
    }

    const key = fileName; // flat namespace in bucket root
    const uploadUrl = await getPresignedUploadUrl(key, contentType);

    return NextResponse.json({ success: true, data: { key, uploadUrl } });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    console.error("[Upload] URL error:", err);
    return NextResponse.json({ success: false, error: "Failed to create upload URL" }, { status: 500 });
  }
}

// Called by client after a successful PUT to verify the object landed
export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const { key } = await request.json();
    if (typeof key !== "string" || !key) {
      return NextResponse.json({ success: false, error: "key required" }, { status: 400 });
    }
    const head = await headObject(key);
    if (!head) {
      return NextResponse.json({ success: false, error: "Object not found after upload" }, { status: 404 });
    }
    await logAudit("upload.complete", `${key} (${(head.size / 1024 / 1024).toFixed(1)} MB)`);
    return NextResponse.json({ success: true, data: { key, size: head.size } });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    console.error("[Upload] Complete error:", err);
    return NextResponse.json({ success: false, error: "Failed to confirm upload" }, { status: 500 });
  }
}
