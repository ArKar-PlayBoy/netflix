import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";
import { getUserFavorites, addUserFavorite, removeUserFavorite } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const favorites = await getUserFavorites(user.id);
    return NextResponse.json({ success: true, data: { favorites } });
  } catch (err) {
    console.error("[Favorites] GET error:", err);
    return NextResponse.json({ success: false, error: "Failed to load favorites" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const movieId = body.movieId;
    if (!movieId || typeof movieId !== "number") {
      return NextResponse.json({ success: false, error: "movieId (number) is required" }, { status: 400 });
    }

    await addUserFavorite(user.id, movieId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Favorites] POST error:", err);
    return NextResponse.json({ success: false, error: "Failed to add favorite" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const movieId = parseInt(new URL(request.url).searchParams.get("movieId") || "0");
    if (!movieId) {
      return NextResponse.json({ success: false, error: "movieId parameter is required" }, { status: 400 });
    }

    await removeUserFavorite(user.id, movieId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Favorites] DELETE error:", err);
    return NextResponse.json({ success: false, error: "Failed to remove favorite" }, { status: 500 });
  }
}
