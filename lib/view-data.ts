import { cache } from "react";
import type { MovieType, CastType, VideoType } from "@/types/global";
import { getVideoByTmdbId } from "@/lib/videos";
import { getEpisodesForSeries } from "@/lib/db";
import { getEmbedConfig, buildEmbedUrl } from "@/lib/embed";

/**
 * Single loader for /view/[id] — the page file stays a thin renderer.
 * Previously every fetch helper lived inline in the page component and
 * getVideoByTmdbId ran twice per request (page + generateMetadata);
 * cache() dedupes that within one render pass.
 */

export type EpisodeRecord = Awaited<ReturnType<typeof getEpisodesForSeries>>[number];

export const getCachedDbVideo = cache(async (tmdbId: number) => {
  try {
    return await getVideoByTmdbId(tmdbId);
  } catch {
    return null;
  }
});

async function fetchMovie(id: string, base: string = "movie"): Promise<MovieType> {
  const res = await fetch(`https://api.themoviedb.org/3/${base}/${id}?language=en-US`, {
    headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error("Failed to fetch movie");
  return res.json();
}

async function fetchCredits(id: string, base: string = "movie"): Promise<{ cast: CastType[]; directors: string[] }> {
  const res = await fetch(`https://api.themoviedb.org/3/${base}/${id}/credits?language=en-US`, {
    headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error("Failed to fetch credits");
  const data = await res.json();
  type CrewMember = { job?: string; name?: string };
  const crew = (data.crew ?? []) as CrewMember[];
  return {
    cast: data.cast?.slice(0, 20) || [],
    directors: crew.filter((c) => c.job === "Director").map((c) => c.name ?? "").filter(Boolean),
  };
}

async function fetchVideos(id: string, base: string = "movie"): Promise<VideoType[]> {
  const res = await fetch(`https://api.themoviedb.org/3/${base}/${id}/videos?language=en-US`, {
    headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const youtube = ((data.results ?? []) as VideoType[]).filter((v) => v.site === "YouTube");
  return [
    ...youtube.filter((v) => v.type === "Full Movie" || v.type === "Feature"),
    ...youtube.filter((v) => v.type === "Trailer" && v.official),
    ...youtube.filter((v) => v.type === "Trailer" && !v.official),
    ...youtube.filter((v) => v.type === "Teaser"),
    ...youtube.filter((v) => v.type === "Clip"),
  ];
}

async function fetchSimilar(id: string, base: string = "movie"): Promise<MovieType[]> {
  const res = await fetch(`https://api.themoviedb.org/3/${base}/${id}/similar?language=en-US&page=1`, {
    headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results?.slice(0, 10) || [];
}

export type LocalVideoData = {
  hasLocalVideo: boolean;
  qualities: { quality: string; file: string }[];
  subtitles: { lang: string; label: string; file: string }[];
};

export type ResolvedEmbedServer = { name: string; url: string };

export type ViewPageData = {
  base: "movie" | "tv";
  dbVideoId: number | null;
  episodes: EpisodeRecord[];
  movie: MovieType | null;
  credits: { cast: CastType[]; directors: string[] };
  videos: VideoType[];
  similar: MovieType[];
  localVideoData: LocalVideoData;
  /** Per-title resolved embed URLs (R2 takes priority, so empty when a local file exists) */
  embedServers: ResolvedEmbedServer[];
};

async function loadLocalVideoData(tmdbId: number): Promise<LocalVideoData> {
  const video = await getCachedDbVideo(tmdbId);
  if (!video) return { hasLocalVideo: false, qualities: [], subtitles: [] };
  return {
    hasLocalVideo: true,
    qualities: video.qualities.map((q) => ({ quality: q.quality, file: q.file })),
    subtitles: video.subtitles ?? [],
  };
}

/** Cheap metadata-only lookup — avoids running the full page loader for <title> */
export async function getPageMetadata(id: string): Promise<{ title: string; description: string } | null> {
  const tmdbId = parseInt(id, 10);
  const dbVideo = await getCachedDbVideo(tmdbId);
  const base = dbVideo?.media_type === "tv" ? "tv" : "movie";
  try {
    const movie = await fetchMovie(id, base);
    const title = movie.title ?? (movie as unknown as { name?: string }).name ?? "Vionix";
    return { title: `${title} — Vionix`, description: movie.overview?.slice(0, 160) || "View details." };
  } catch {
    return null;
  }
}

export async function getViewPageData(id: string): Promise<ViewPageData> {  const tmdbId = parseInt(id, 10);

  // Detect TV vs movie from our DB first
  const dbVideo = await getCachedDbVideo(tmdbId);
  let base: "movie" | "tv" = "movie";
  let dbVideoId: number | null = null;
  let episodes: EpisodeRecord[] = [];
  if (dbVideo) {
    dbVideoId = dbVideo.id;
    if (dbVideo.media_type === "tv") {
      base = "tv";
      episodes = await getEpisodesForSeries(dbVideo.id);
    }
  }

  const [movie, credits, videos, similar, localVideoData, embedConfig] = await Promise.all([
    fetchMovie(id, base).catch(() => null),
    fetchCredits(id, base).catch(() => ({ cast: [], directors: [] })),
    fetchVideos(id, base).catch(() => []),
    fetchSimilar(id, base).catch(() => []),
    loadLocalVideoData(tmdbId),
    getEmbedConfig(),
  ]);

  // Playback priority: R2 upload > external embeds > YouTube trailer
  const embedServers: ResolvedEmbedServer[] = [];
  if (movie && !localVideoData.hasLocalVideo && embedConfig.enabled) {
    for (const server of embedConfig.servers) {
      const template = base === "tv" ? server.tv : server.movie;
      const url = buildEmbedUrl(template, { id: tmdbId });
      if (url) embedServers.push({ name: server.name, url });
    }
  }

  return { base, dbVideoId, episodes, movie, credits, videos, similar, localVideoData, embedServers };
}
