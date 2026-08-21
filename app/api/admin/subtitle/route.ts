import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { isR2Configured, getPresignedUploadUrl } from "@/lib/r2";
import { addSubtitle } from "@/lib/db";

const ALLOWED_SUB_EXTENSIONS = [".srt", ".vtt"];
const SAFE_KEY_RE = /^[a-zA-Z0-9._\- ()[\]'+,&!]+$/;

export async function POST(request: Request) {
  try {
    await requireAdmin();

    if (!isR2Configured()) {
      return NextResponse.json({ success: false, error: "R2 storage is not configured" }, { status: 500 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const action = body.action ?? "presign";

    if (action === "presign") {
      const fileName = typeof body.fileName === "string" ? body.fileName : "";
      const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
      if (!fileName || !ALLOWED_SUB_EXTENSIONS.includes(ext)) {
        return NextResponse.json({ success: false, error: "Allowed: .srt, .vtt" }, { status: 400 });
      }
      if (!SAFE_KEY_RE.test(fileName)) {
        return NextResponse.json({ success: false, error: "Invalid file name" }, { status: 400 });
      }
      const key = `subs/${Date.now()}-${fileName.replace(/\.[^.]+$/, "")}.vtt`;
      const uploadUrl = await getPresignedUploadUrl(key, "text/vtt");
      return NextResponse.json({ success: true, data: { key, uploadUrl } });
    }

    if (action === "attach") {
      const { videoId, lang, label, key } = body;
      if (
        typeof videoId !== "number" ||
        typeof lang !== "string" ||
        typeof label !== "string" ||
        typeof key !== "string"
      ) {
        return NextResponse.json(
          { success: false, error: "videoId, lang, label, key required" },
          { status: 400 }
        );
      }
      await addSubtitle(videoId, lang.slice(0, 10), label.slice(0, 40), key);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    console.error("[Subtitle] Error:", err);
    return NextResponse.json({ success: false, error: "Subtitle operation failed" }, { status: 500 });
  }
}
