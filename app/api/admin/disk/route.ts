import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listVideoFiles, isR2Configured } from "@/lib/r2";

let diskCache: { at: number; payload: string } | null = null;
const DISK_CACHE_MS = 60_000;

export async function GET() {
  try {
    await requireAdmin();

    if (!isR2Configured()) {
      return NextResponse.json({
        success: true,
        data: { disk: { movieCount: 0, totalSizeBytes: 0, totalSizeGB: "0.00", storage: "not_configured" } },
      });
    }

    // 60s in-memory cache — R2 listing is the slowest admin call
    if (diskCache && Date.now() - diskCache.at < DISK_CACHE_MS) {
      return new Response(diskCache.payload, { headers: { "Content-Type": "application/json" } });
    }

    const objects = await listVideoFiles();
    const videoFiles = objects.filter((o) =>
      /\.(mp4|mkv|webm|avi|mov)$/i.test(o.key)
    );
    const totalSize = videoFiles.reduce((sum, o) => sum + o.size, 0);

    const payload = JSON.stringify({
      success: true,
      data: {
        disk: {
          movieCount: videoFiles.length,
          totalSizeBytes: totalSize,
          totalSizeGB: (totalSize / (1024 * 1024 * 1024)).toFixed(2),
          storage: "r2",
        },
      },
    });
    diskCache = { at: Date.now(), payload };
    return new Response(payload, { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Failed to load storage stats" }, { status: 500 });
  }
}
