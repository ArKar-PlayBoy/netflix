import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";
import { setRating, getMyRating } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const movieId = parseInt(new URL(request.url).searchParams.get("movieId") || "0");
    if (!movieId) return NextResponse.json({ success: false, error: "movieId required" }, { status: 400 });

    const score = await getMyRating(user.id, movieId);
    return NextResponse.json({ success: true, data: { score } });
  } catch (err) {
    console.error("[Ratings] GET error:", err);
    return NextResponse.json({ success: false, error: "Failed to load rating" }, { status: 500 });
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

    const { movieId, score } = body;
    if (typeof movieId !== "number" || typeof score !== "number" || score < 1 || score > 10) {
      return NextResponse.json({ success: false, error: "movieId and score (1-10) required" }, { status: 400 });
    }

    await setRating(user.id, movieId, Math.round(score));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Ratings] POST error:", err);
    return NextResponse.json({ success: false, error: "Failed to save rating" }, { status: 500 });
  }
}
