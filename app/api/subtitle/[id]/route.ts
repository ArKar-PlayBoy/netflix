import { NextResponse } from "next/server";
import { getObjectStream, isR2Configured } from "@/lib/r2";
import { safeEqual } from "@/lib/crypto";
import crypto from "crypto";

const STREAM_SECRET = process.env.STREAM_SECRET || "default-secret-change-me";

function verifyToken(token: string | null): boolean {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [expires, hash] = decoded.split(":");
    if (Date.now() > parseInt(expires)) return false;
    const expected = crypto.createHash("sha256").update(`${expires}:${STREAM_SECRET}`).digest("hex");
    return safeEqual(hash, expected);
  } catch {
    return false;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // movie id — kept for URL symmetry with stream route

    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    const file = url.searchParams.get("file");

    if (!verifyToken(token)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!file || file.includes("..")) {
      return NextResponse.json({ success: false, error: "file required" }, { status: 400 });
    }
    if (!isR2Configured()) {
      return NextResponse.json({ success: false, error: "Storage not configured" }, { status: 500 });
    }

    const obj = await getObjectStream(file);
    if (!obj || !obj.body) {
      return NextResponse.json({ success: false, error: "Subtitle not found" }, { status: 404 });
    }

    return new Response(obj.body, {
      status: 200,
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (err) {
    console.error("[Subtitle] Serve error:", err);
    return NextResponse.json({ success: false, error: "Failed to load subtitle" }, { status: 500 });
  }
}
