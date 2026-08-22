import { NextResponse } from "next/server";
import { safeJson } from "@/lib/http";
import { getCurrentUser } from "@/lib/user-auth";
import { saveWatchProgress, getWatchProgress, getContinueWatching, deleteWatchProgress } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const movieId = parseInt(url.searchParams.get("movieId") || "0");

    if (movieId) {
      const progress = await getWatchProgress(user.id, movieId);
      return NextResponse.json({ success: true, data: { progress } });
    }

    const list = await getContinueWatching(user.id);
    return NextResponse.json({ success: true, data: { items: list } });
  } catch (err) {
    console.error("[Progress] GET error:", err);
    return NextResponse.json({ success: false, error: "Failed to load progress" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const parsed = await safeJson(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const { movieId, position, duration } = body;
    if (
      typeof movieId !== "number" ||
      typeof position !== "number" ||
      typeof duration !== "number" ||
      movieId < 1 ||
      position < 0 ||
      duration < 0
    ) {
      return NextResponse.json({ success: false, error: "movieId, position, duration (numbers) required" }, { status: 400 });
    }

    // Finished watching → clear so it leaves Continue Watching
    if (duration > 0 && position >= duration * 0.95) {
      await deleteWatchProgress(user.id, movieId);
      return NextResponse.json({ success: true });
    }

    await saveWatchProgress(user.id, movieId, position, duration);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Progress] POST error:", err);
    return NextResponse.json({ success: false, error: "Failed to save progress" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const movieId = parseInt(new URL(request.url).searchParams.get("movieId") || "0");
    if (!movieId) {
      return NextResponse.json({ success: false, error: "movieId required" }, { status: 400 });
    }
    await deleteWatchProgress(user.id, movieId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Progress] DELETE error:", err);
    return NextResponse.json({ success: false, error: "Failed to remove progress" }, { status: 500 });
  }
}
