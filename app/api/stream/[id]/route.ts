import { NextResponse } from "next/server";
import { readFile, stat, open } from "fs/promises";
import { join } from "path";
import { getVideoByTmdbId } from "@/lib/videos";
import { safeEqual } from "@/lib/crypto";
import crypto from "crypto";

const MOVIES_DIR = join(process.cwd(), "data", "movies");
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

const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
};

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

    const requestedFile = new URL(request.url).searchParams.get("file");

    const video = await getVideoByTmdbId(movieId);
    if (!video) {
      return NextResponse.json({ success: false, error: "Movie not available" }, { status: 404 });
    }

    let fileName = video.file;
    if (requestedFile) {
      const isValid = video.qualities.some((q) => q.file === requestedFile);
      if (isValid) {
        fileName = requestedFile;
      }
    }

    const filePath = join(MOVIES_DIR, fileName);

    let fileStat;
    try {
      fileStat = await stat(filePath);
    } catch {
      return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
    }

    const ext = "." + fileName.split(".").pop()?.toLowerCase();
    const contentType = MIME_TYPES[ext] || "video/mp4";
    const fileSize = fileStat.size;

    const range = request.headers.get("range");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 10 * 1024 * 1024 - 1, fileSize - 1);
      const chunkSize = end - start + 1;

      const fileHandle = await open(filePath, "r");
      const buffer = Buffer.alloc(chunkSize);
      await fileHandle.read(buffer, 0, chunkSize, start);
      await fileHandle.close();

      return new Response(buffer, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize.toString(),
          "Content-Type": contentType,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    const buffer = await readFile(filePath);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Length": fileSize.toString(),
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[Stream] Error:", err);
    return NextResponse.json({ success: false, error: "Stream failed" }, { status: 500 });
  }
}
