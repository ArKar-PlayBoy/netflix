import {
  getAllVideos as dbGetAll,
  getVideoById as dbGetById,
  getVideoByTmdbId as dbGetByTmdbId,
  createVideo as dbCreate,
  updateVideo as dbUpdate,
  deleteVideo as dbDelete,
  upsertVideo as dbUpsert,
  getVideoStats as dbStats,
  type VideoRecord as DBVideoRecord,
} from "./db";

export type VideoRecord = DBVideoRecord;

export type VideoInput = {
  mediaType?: "movie" | "tv";
  tmdbId: number | null;
  title: string;
  year?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  overview?: string;
  voteAverage?: number;
  file: string;
  qualities: { quality: string; file: string }[];
  subtitles?: { lang: string; label: string; file: string }[];
};

export async function getAllVideos(page: number = 1, limit: number = 20, search?: string) {
  return dbGetAll(page, limit, search);
}

export async function getUnlinkedVideos(): Promise<VideoRecord[]> {
  const { loadAllVideos } = await import("./db");
  return loadAllVideos().then((videos) => videos.filter((v) => v.tmdb_id === null));
}

export async function getVideoById(id: number): Promise<VideoRecord | null> {
  return dbGetById(id);
}

export async function getVideoByTmdbId(tmdbId: number): Promise<VideoRecord | null> {
  return dbGetByTmdbId(tmdbId);
}

export async function createVideo(data: VideoInput): Promise<number> {
  return dbCreate({
    media_type: data.mediaType ?? "movie",
    tmdb_id: data.tmdbId,
    title: data.title,
    year: data.year ?? null,
    poster_path: data.posterPath ?? null,
    backdrop_path: data.backdropPath ?? null,
    overview: data.overview ?? "",
    vote_average: data.voteAverage ?? 0,
    file: data.file,
    qualities: data.qualities,
    subtitles: data.subtitles ?? [],
  });
}

export async function updateVideo(id: number, data: Partial<VideoInput>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (data.mediaType !== undefined) update.media_type = data.mediaType;
  if (data.tmdbId !== undefined) update.tmdb_id = data.tmdbId;
  if (data.title !== undefined) update.title = data.title;
  if (data.year !== undefined) update.year = data.year;
  if (data.posterPath !== undefined) update.poster_path = data.posterPath;
  if (data.backdropPath !== undefined) update.backdrop_path = data.backdropPath;
  if (data.overview !== undefined) update.overview = data.overview;
  if (data.voteAverage !== undefined) update.vote_average = data.voteAverage;
  if (data.file !== undefined) update.file = data.file;
  if (data.qualities !== undefined) update.qualities = data.qualities;
  return dbUpdate(id, update);
}

export async function deleteVideo(id: number): Promise<VideoRecord | null> {
  return dbDelete(id);
}

export async function upsertVideo(data: VideoInput): Promise<number> {
  return dbUpsert({
    media_type: data.mediaType ?? "movie",
    tmdb_id: data.tmdbId,
    title: data.title,
    year: data.year ?? null,
    poster_path: data.posterPath ?? null,
    backdrop_path: data.backdropPath ?? null,
    overview: data.overview ?? "",
    vote_average: data.voteAverage ?? 0,
    file: data.file,
    qualities: data.qualities,
    subtitles: data.subtitles ?? [],
  });
}

export async function getVideoStats() {
  return dbStats();
}
