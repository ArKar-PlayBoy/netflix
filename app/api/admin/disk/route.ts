import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listVideoFiles, isR2Configured } from "@/lib/r2";

export async function GET() {
  try {
    await requireAdmin();

    if (!isR2Configured()) {
      return NextResponse.json({
        success: true,
        data: { disk: { movieCount: 0, totalSizeBytes: 0, totalSizeGB: "0.00", storage: "not_configured" } },
      });
    }

    const objects = await listVideoFiles();
    const videoFiles = objects.filter((o) =>
      /\.(mp4|mkv|webm|avi|mov)$/i.test(o.key)
    );
    const totalSize = videoFiles.reduce((sum, o) => sum + o.size, 0);

    return NextResponse.json({
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
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Failed to load storage stats" }, { status: 500 });
  }
}
