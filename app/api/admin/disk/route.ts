import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { readdir, stat } from "fs/promises";
import { join } from "path";

async function getDirSize(dir: string): Promise<number> {
  let totalSize = 0;
  try {
    const entries = await readdir(dir);
    for (const entry of entries) {
      const filePath = join(dir, entry);
      const fileStat = await stat(filePath);
      if (fileStat.isFile()) {
        totalSize += fileStat.size;
      } else if (fileStat.isDirectory()) {
        totalSize += await getDirSize(filePath);
      }
    }
  } catch {}
  return totalSize;
}

export async function GET() {
  try {
    await requireAdmin();

    const videosDir = join(process.cwd(), "data", "movies");
    const moviesSize = await getDirSize(videosDir);

    let movieCount = 0;
    try {
      const files = await readdir(videosDir);
      movieCount = files.filter((f) => /\.(mp4|mkv|webm|avi|mov)$/i.test(f)).length;
    } catch {}

    return NextResponse.json({
      success: true,
      data: {
        disk: {
          movieCount,
          totalSizeBytes: moviesSize,
          totalSizeGB: (moviesSize / (1024 * 1024 * 1024)).toFixed(2),
        },
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Failed to load disk info" }, { status: 500 });
  }
}
