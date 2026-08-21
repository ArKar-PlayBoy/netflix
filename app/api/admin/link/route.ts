import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getUnlinkedVideos, getVideoById, updateVideo } from "@/lib/videos";
import { upsertEpisode } from "@/lib/db";
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
      // Multi search: movies + TV shows
      const tmdbRes = await fetch(
        `${TMDB_BASE}/search/multi?query=${encodeURIComponent(search)}&include_adult=false&language=en-US&page=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!tmdbRes.ok) {
        return NextResponse.json({ success: false, error: "TMDB search failed" }, { status: 502 });
      }
      const data = await tmdbRes.json();
      const results = (data.results ?? [])
        .filter((r: { media_type?: string }) => r.media_type === "movie" || r.media_type === "tv")
        .slice(0, 10)
        .map((r: { id: number; title?: string; name?: string; release_date?: string; first_air_date?: string; poster_path?: string | null; media_type?: string }) => ({
          id: r.id,
          title: r.title ?? r.name ?? "Unknown",
          year: (r.release_date ?? r.first_air_date ?? "").split("-")[0] || null,
          poster_path: r.poster_path ?? null,
          media_type: r.media_type ?? "movie",
        }));
      return NextResponse.json({ success: true, data: { results } });
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

    const { videoId, tmdbId, season, episode } = body;
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

    // Try movie first; if body says tv or movie lookup fails, try TV
    let details = await fetch(`${TMDB_BASE}/movie/${tmdbId}?language=en-US`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    let isTv = false;
    if (!details.ok) {
      details = await fetch(`${TMDB_BASE}/tv/${tmdbId}?language=en-US`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      isTv = true;
    }
    if (!details.ok) {
      return NextResponse.json({ success: false, error: "TMDB entry not found" }, { status: 404 });
    }
    const media = await details.json();

    await updateVideo(videoId, {
      tmdbId: media.id,
      mediaType: isTv ? "tv" : "movie",
      title: media.title ?? media.name,
      year: (media.release_date ?? media.first_air_date ?? "")?.split("-")[0] || null,
      posterPath: media.poster_path ?? null,
      backdropPath: media.backdrop_path ?? null,
      overview: media.overview ?? "",
      voteAverage: media.vote_average ?? 0,
    });

    // If TV and season/episode provided, register the episode file
    if (isTv && typeof season === "number" && typeof episode === "number") {
      await upsertEpisode(videoId, season, episode, video.file, "SD");
    }

    await logAudit(AUDIT_ACTIONS.VIDEO_LINK, `Linked "${video.file}" to ${isTv ? "TV" : "movie"} #${media.id} (${media.title ?? media.name})`);

    return NextResponse.json({ success: true, data: { title: media.title ?? media.name, type: isTv ? "tv" : "movie" } });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Failed to link video" }, { status: 500 });
  }
}
