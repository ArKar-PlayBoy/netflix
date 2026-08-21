import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";
import { getComments, addComment, deleteComment } from "@/lib/db";

const MAX_BODY_LENGTH = 1000;

export async function GET(request: Request) {
  try {
    const movieId = parseInt(new URL(request.url).searchParams.get("movieId") || "0");
    if (!movieId) return NextResponse.json({ success: false, error: "movieId required" }, { status: 400 });

    const comments = await getComments(movieId);
    return NextResponse.json({ success: true, data: { comments } });
  } catch (err) {
    console.error("[Comments] GET error:", err);
    return NextResponse.json({ success: false, error: "Failed to load comments" }, { status: 500 });
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

    const { movieId, body: text } = body;
    if (typeof movieId !== "number" || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ success: false, error: "movieId and body required" }, { status: 400 });
    }
    if (text.trim().length > MAX_BODY_LENGTH) {
      return NextResponse.json({ success: false, error: `Comment too long (max ${MAX_BODY_LENGTH})` }, { status: 400 });
    }

    await addComment(user.id, movieId, text.trim());
    const comments = await getComments(movieId);
    return NextResponse.json({ success: true, data: { comments } });
  } catch (err) {
    console.error("[Comments] POST error:", err);
    return NextResponse.json({ success: false, error: "Failed to add comment" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const id = parseInt(new URL(request.url).searchParams.get("id") || "0");
    if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 });

    const ok = await deleteComment(id, user.id);
    if (!ok) return NextResponse.json({ success: false, error: "Not found or not yours" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Comments] DELETE error:", err);
    return NextResponse.json({ success: false, error: "Failed to delete comment" }, { status: 500 });
  }
}
