import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireAdmin } from "@/lib/admin-auth";
import { isR2Configured, getBucket, getR2Client } from "@/lib/r2";
import { addSubtitle } from "@/lib/db";

const ALLOWED_SUB_EXTENSIONS = [".srt", ".vtt"];
const SAFE_KEY_RE = /^[a-zA-Z0-9._\- ()[\]'+,&!]+$/;

export async function POST(request: Request) {
  try {
    await requireAdmin();

    if (!isR2Configured()) {
      return NextResponse.json({ success: false, error: "R2 storage is not configured" }, { status: 500 });
    }

    const url = new URL(request.url);

    // Proxied text upload: raw VTT body → R2 server-side (ISP-proof).
    // Subtitles are small (<2MB) so the Vercel body limit is never an issue.
    if (url.searchParams.get("action") === "put") {
      const key = url.searchParams.get("key") ?? "";
      if (!key.startsWith("subs/") || key.includes("..")) {
        return NextResponse.json({ success: false, error: "Invalid key" }, { status: 400 });
      }
      const text = await request.text();
      if (text.length > 2 * 1024 * 1024) {
        return NextResponse.json({ success: false, error: "Subtitle too large" }, { status: 413 });
      }
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      await getR2Client().send(
        new PutObjectCommand({
          Bucket: getBucket(),
          Key: key,
          Body: text,
          ContentType: "text/vtt; charset=utf-8",
        })
      );
      return NextResponse.json({ success: true });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const action = body.action ?? "key";

    if (action === "key") {
      const fileName = typeof body.fileName === "string" ? body.fileName : "";
      const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
      if (!fileName || !ALLOWED_SUB_EXTENSIONS.includes(ext)) {
        return NextResponse.json({ success: false, error: "Allowed: .srt, .vtt" }, { status: 400 });
      }
      if (!SAFE_KEY_RE.test(fileName)) {
        return NextResponse.json({ success: false, error: "Invalid file name" }, { status: 400 });
      }
      const rand = crypto.randomBytes(6).toString("hex");
      const key = `subs/${rand}-${fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 60)}.vtt`;
      return NextResponse.json({ success: true, data: { key } });
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
