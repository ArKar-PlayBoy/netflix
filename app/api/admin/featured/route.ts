import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFeatured, addToFeatured, removeFromFeatured, clearFeatured } from "@/lib/featured";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";

export async function GET() {
  try {
    await requireAdmin();
    const featured = await getFeatured();
    return NextResponse.json({ success: true, data: { featured } });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Failed to load featured" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const { movieId, type } = body;
    if (!movieId || typeof movieId !== "number") {
      return NextResponse.json({ success: false, error: "movieId (number) is required" }, { status: 400 });
    }

    await addToFeatured(movieId, type);
    await logAudit(AUDIT_ACTIONS.FEATURED_ADD, `Added TMDB #${movieId} to featured`);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Failed to add featured" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const idParam = url.searchParams.get("id");

    if (action === "clear") {
      await clearFeatured();
      await logAudit(AUDIT_ACTIONS.FEATURED_CLEAR, "Cleared all featured items");
      return NextResponse.json({ success: true });
    }

    const id = parseInt(idParam || "0");
    if (!id) {
      return NextResponse.json({ success: false, error: "id parameter is required" }, { status: 400 });
    }

    await removeFromFeatured(id);
    await logAudit(AUDIT_ACTIONS.FEATURED_REMOVE, `Removed featured item id ${id}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Failed to remove featured" }, { status: 500 });
  }
}
