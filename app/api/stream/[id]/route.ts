import { NextResponse } from "next/server";
import { getVideoByTmdbId } from "@/lib/videos";
import { getEpisodeById } from "@/lib/db";
import { isR2Configured, getPresignedStreamUrl } from "@/lib/r2";
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

    // 302 → short-lived signed R2 URL. Video bytes flow viewer↔Cloudflare
    // directly: no server bandwidth, scales to any audience. Range requests
    // (seeking) are honored by R2 natively; the URL self-expires in 15 min.
    const downloadUrl = await getPresignedStreamUrl(fileName);
    return NextResponse.redirect(downloadUrl, 302);
  } catch (err) {
    console.error("[Stream] Error:", err);
    return NextResponse.json({ success: false, error: "Stream failed" }, { status: 500 });
  }
}
