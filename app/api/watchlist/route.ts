import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";
import { toggleWatchlist, isInWatchlist, getWatchlistIds } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const movieId = parseInt(url.searchParams.get("movieId") || "0");

    if (movieId) {
      const inList = await isInWatchlist(user.id, movieId);
      return NextResponse.json({ success: true, data: { inList } });
    }

    const ids = await getWatchlistIds(user.id);
    return NextResponse.json({ success: true, data: { watchlist: ids } });
  } catch (err) {
    console.error("[Watchlist] GET error:", err);
    return NextResponse.json({ success: false, error: "Failed to load watchlist" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const { movieId } = body;
    if (typeof movieId !== "number") {
      return NextResponse.json({ success: false, error: "movieId (number) required" }, { status: 400 });
    }

    const result = await toggleWatchlist(user.id, movieId);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[Watchlist] POST error:", err);
    return NextResponse.json({ success: false, error: "Failed to update watchlist" }, { status: 500 });
  }
}
