import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getUnlinkedVideos, getVideoById, updateVideo } from "@/lib/videos";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";

const TMDB_BASE = "https://api.themoviedb.org/3";

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const url = new URL(request.url);
    const search = url.searchParams.get("search");

    if (search) {
      const token = process.env.TMDB_TOKEN;
      if (!token) {
        return NextResponse.json({ success: false, error: "TMDB_TOKEN not configured" }, { status: 500 });
      }
      const tmdbRes = await fetch(
        `${TMDB_BASE}/search/movie?query=${encodeURIComponent(search)}&include_adult=false&language=en-US&page=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!tmdbRes.ok) {
        return NextResponse.json({ success: false, error: "TMDB search failed" }, { status: 502 });
      }
      const data = await tmdbRes.json();
      return NextResponse.json({ success: true, data: { results: (data.results ?? []).slice(0, 10) } });
    }

    const videos = await getUnlinkedVideos();
    return NextResponse.json({ success: true, data: { videos } });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Failed to load link data" }, { status: 500 });
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

    const { videoId, tmdbId } = body;
    if (!videoId || typeof videoId !== "number") {
      return NextResponse.json({ success: false, error: "videoId (number) is required" }, { status: 400 });
    }
    if (!tmdbId || typeof tmdbId !== "number") {
      return NextResponse.json({ success: false, error: "tmdbId (number) is required" }, { status: 400 });
    }

    const token = process.env.TMDB_TOKEN;
    if (!token) {
      return NextResponse.json({ success: false, error: "TMDB_TOKEN not configured" }, { status: 500 });
    }

    const video = await getVideoById(videoId);
    if (!video) {
      return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
    }

    const res = await fetch(`${TMDB_BASE}/movie/${tmdbId}?language=en-US`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return NextResponse.json({ success: false, error: "TMDB movie not found" }, { status: 404 });
    }
    const movie = await res.json();

    await updateVideo(videoId, {
      tmdbId: movie.id,
      title: movie.title,
      year: movie.release_date?.split("-")[0] ?? null,
      posterPath: movie.poster_path ?? null,
      backdropPath: movie.backdrop_path ?? null,
      overview: movie.overview ?? "",
      voteAverage: movie.vote_average ?? 0,
    });

    await logAudit(AUDIT_ACTIONS.VIDEO_LINK, `Linked "${video.file}" to TMDB #${movie.id} (${movie.title})`);

    return NextResponse.json({ success: true, data: { title: movie.title } });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Failed to link video" }, { status: 500 });
  }
}
