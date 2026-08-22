import { NextResponse } from "next/server";
import { getVideoByTmdbId } from "@/lib/videos";
import { getEpisodeById } from "@/lib/db";
import { isR2Configured, getObjectStream, getPublicBaseUrl, getPublicObjectUrl } from "@/lib/r2";
import { safeEqual } from "@/lib/crypto";
import crypto from "crypto";

const STREAM_SECRET = process.env.STREAM_SECRET || "default-secret-change-me";

const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
};

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
    const { id } = await params;
    const movieId = parseInt(id, 10);
    if (!movieId || movieId < 1) {
      return NextResponse.json({ success: false, error: "Invalid movie id" }, { status: 400 });
    }

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "") ?? new URL(request.url).searchParams.get("token");
    if (!verifyToken(token)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!isR2Configured()) {
      return NextResponse.json({ success: false, error: "Storage not configured" }, { status: 500 });
    }

    const requestedFile = new URL(request.url).searchParams.get("file");
    const epParam = new URL(request.url).searchParams.get("ep");

    // Episode streaming (TV)
    let fileName: string;
    if (epParam) {
      const episodeId = parseInt(epParam, 10);
      if (!episodeId) {
        return NextResponse.json({ success: false, error: "Invalid episode id" }, { status: 400 });
      }
      const episode = await getEpisodeById(episodeId);
      if (!episode) {
        return NextResponse.json({ success: false, error: "Episode not found" }, { status: 404 });
      }
      fileName = requestedFile && episode.qualities.some((q) => q.file === requestedFile)
        ? requestedFile
        : episode.file;
    } else {
      const video = await getVideoByTmdbId(movieId);
      if (!video) {
        return NextResponse.json({ success: false, error: "Movie not available" }, { status: 404 });
      }
      fileName = video.file;
      if (requestedFile) {
        const isValid = video.qualities.some((q) => q.file === requestedFile);
        if (isValid) fileName = requestedFile;
      }
    }

    // Delivery mode:
    // 1. R2_PUBLIC_BASE set (custom domain / CDN) → 302 to CDN. Zero server
    //    bandwidth, infinite scale. Use when the CDN hostname is reachable
    //    by your audience (some ISPs block the raw r2.cloudflarestorage.com
    //    S3 endpoint, so CDN domains are the reliable upgrade path).
    // 2. Otherwise proxy-stream through this function (token-gated, range
    //    passthrough). Works from any network — verified end-to-end.
    const publicBase = getPublicBaseUrl();
    if (publicBase) {
      return NextResponse.redirect(getPublicObjectUrl(fileName), 302);
    }

    const range = request.headers.get("range") ?? undefined;

    // Transient connection resets (flaky upstream networks) get ONE silent
    // retry — without this, a single reset stalls the player indefinitely.
    let obj: Awaited<ReturnType<typeof getObjectStream>> = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        obj = await getObjectStream(fileName, range);
        break;
      } catch (streamErr) {
        if (attempt === 1) throw streamErr;
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    if (!obj || !obj.body) {
      return NextResponse.json({ success: false, error: "File not found in storage" }, { status: 404 });
    }

    const ext = "." + fileName.split(".").pop()?.toLowerCase();
    const contentType = MIME_TYPES[ext] || "video/mp4";

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    };
    if (obj.contentLength !== undefined) headers["Content-Length"] = String(obj.contentLength);
    if (obj.contentRange) headers["Content-Range"] = obj.contentRange;

    return new Response(obj.body, { status: obj.status, headers });
  } catch (err) {
    console.error("[Stream] Error:", err);
    return NextResponse.json({ success: false, error: "Stream failed" }, { status: 500 });
  }
}
