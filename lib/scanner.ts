import { createScanLog, updateScanLog, upsertEpisode, getRegisteredFileKeys } from "./db";
import { upsertVideo } from "./videos";
import { listVideoFiles, headObject, isR2Configured } from "./r2";

const TMDB_BASE = "https://api.themoviedb.org/3";
const VIDEO_EXTENSIONS = [".mp4", ".mkv", ".webm", ".avi", ".mov"];

const QUALITY_KEYWORDS: Record<string, string> = {
  "2160p": "4K", "4k": "4K", "1080p": "1080p", "1080": "1080p",
  "720p": "720p", "720": "720p", "480p": "480p", "480": "480p",
  "hd": "1080p", "sd": "480p",
};

const QUALITY_ORDER = ["4K", "1080p", "720p", "480p"];

function cleanFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/^[\d-]+\s*/, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractIdFromFilename(filename: string): number | null {
  const match = filename.match(/^(\d+)[-_]/);
  return match ? parseInt(match[1]) : null;
}

function detectQuality(filename: string): string {
  const name = filename.toLowerCase().replace(/\.[^.]+$/, "");
  for (const [keyword, quality] of Object.entries(QUALITY_KEYWORDS)) {
    if (name.includes(keyword)) return quality;
  }
  return "SD";
}

async function searchTMDB(query: string, token: string) {
  try {
    const res = await fetch(
      `${TMDB_BASE}/search/movie?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0] ?? null;
  } catch {
    return null;
  }
}

function searchResultTitle(result: { title?: string; name?: string }): string {
  return result.title ?? result.name ?? "Unknown";
}

async function fetchMovieDetails(id: number, token: string) {
  try {
    const res = await fetch(`${TMDB_BASE}/movie/${id}?language=en-US`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function searchTV(query: string, token: string) {
  try {
    const res = await fetch(
      `${TMDB_BASE}/search/tv?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Multi-search: checks movies AND TV, returns best match with its type */
async function searchMulti(query: string, token: string): Promise<{ id: number; mediaType: "movie" | "tv"; result: any } | null> {
  try {
    const res = await fetch(
      `${TMDB_BASE}/search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const hit = (data.results ?? []).find(
      (r: { media_type?: string }) => r.media_type === "movie" || r.media_type === "tv"
    );
    if (!hit) return null;
    return { id: hit.id, mediaType: hit.media_type, result: hit };
  } catch {
    return null;
  }
}

async function fetchTVDetails(id: number, token: string) {
  try {
    const res = await fetch(`${TMDB_BASE}/tv/${id}?language=en-US`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Detect S01E02 / s1e2 / 1x02 patterns
function detectEpisodePattern(filename: string): { seriesName: string; season: number; episode: number } | null {
  const se = filename.match(/^(.*?)[\s._-]*[sS](\d{1,2})[eE](\d{1,3})/);
  if (se) {
    return {
      seriesName: se[1].replace(/[._]+/g, " ").replace(/\s+/g, " ").trim(),
      season: parseInt(se[2]),
      episode: parseInt(se[3]),
    };
  }
  const x = filename.match(/^(\d{1,2})x(\d{1,3})[\s._-]+(.*)$/);
  if (x) {
    return {
      seriesName: x[3].replace(/[._]+/g, " ").replace(/\s+/g, " ").trim(),
      season: parseInt(x[1]),
      episode: parseInt(x[2]),
    };
  }
  return null;
}

export type ScanResult = {
  logId: number;
  status: "completed" | "failed";
  filesFound: number;
  matched: number;
  unmatched: number;
  errors: string[];
};

export async function runScan(): Promise<ScanResult> {
  if (!isR2Configured()) throw new Error("R2 storage is not configured");

  const token = process.env.TMDB_TOKEN;
  if (!token) throw new Error("TMDB_TOKEN not set");

  // List video files from R2 cloud storage
  const objects = await listVideoFiles();
  const registered = await getRegisteredFileKeys();
  const files = objects.map((o) => o.key).filter((k) =>
    VIDEO_EXTENSIONS.includes(k.slice(k.lastIndexOf(".")).toLowerCase())
  );

  // Storage keys are unguessable (random prefix) — content identity lives in
  // object metadata (original upload filename). Already-registered keys skip.
  const nameOf = async (key: string): Promise<string | null> => {
    if (registered.has(key)) return null;
    const head = await headObject(key);
    return head?.originalName ?? null;
  };

  const logId = await createScanLog({
    status: "running",
    files_found: files.length,
    matched: 0,
    unmatched: 0,
    errors: [],
    started_at: new Date().toISOString(),
    completed_at: null,
  });

  const errors: string[] = [];
  let matched = 0;
  let unmatched = 0;

  try {
    const filesByTmdbId: Record<string, string[]> = {};
    const filesWithNoId: { file: string; original: string }[] = [];
    const tvFiles: { file: string; seriesName: string; season: number; episode: number }[] = [];
    const originalNames = new Map<string, string>();

    for (const file of files) {
      const original = await nameOf(file);
      if (!original) continue; // already registered in DB
      originalNames.set(file, original);
      const tvPattern = detectEpisodePattern(original);
      if (tvPattern && tvPattern.seriesName) {
        tvFiles.push({ file, ...tvPattern });
        continue;
      }
      const tmdbId = extractIdFromFilename(original);
      if (tmdbId) {
        const key = tmdbId.toString();
        if (!filesByTmdbId[key]) filesByTmdbId[key] = [];
        filesByTmdbId[key].push(file);
      } else {
        filesWithNoId.push({ file, original });
      }
    }

    // ===== TV series files =====
    const tvCache: { id: number; name: string; details: Record<string, unknown> | null }[] = [];
    for (const tv of tvFiles) {
      try {
        let series = tvCache.find((s) => s.name.toLowerCase() === tv.seriesName.toLowerCase());
        if (!series) {
          const result = await searchTV(tv.seriesName, token);
          if (!result) {
            errors.push(`TV series not found: ${tv.seriesName}`);
            unmatched++;
            continue;
          }
          const details = await fetchTVDetails(result.id, token);
          series = { id: result.id, name: result.name, details };
          tvCache.push(series);
        }

        const quality = detectQuality(tv.file);
        const videoId = await upsertVideo({
          mediaType: "tv",
          tmdbId: series.id,
          title: series.name,
          year: (series.details as { first_air_date?: string })?.first_air_date?.split("-")[0] ?? null,
          posterPath: (series.details as { poster_path?: string })?.poster_path ?? null,
          backdropPath: (series.details as { backdrop_path?: string })?.backdrop_path ?? null,
          overview: (series.details as { overview?: string })?.overview ?? "",
          voteAverage: (series.details as { vote_average?: number })?.vote_average ?? 0,
          file: tv.file,
          qualities: [{ quality, file: tv.file }],
        });

        await upsertEpisode(videoId, tv.season, tv.episode, tv.file, quality);
        matched++;
      } catch (err) {
        errors.push(`TV error ${tv.file}: ${err}`);
        unmatched++;
      }
    }

    for (const [tmdbIdStr, groupFiles] of Object.entries(filesByTmdbId)) {
      try {
        const tmdbId = parseInt(tmdbIdStr);
        const details = await fetchMovieDetails(tmdbId, token);
        const qualities = groupFiles
          .map((file) => ({ quality: detectQuality(file), file }))
          .sort(
            (a, b) =>
              (QUALITY_ORDER.indexOf(a.quality) === -1 ? 99 : QUALITY_ORDER.indexOf(a.quality)) -
              (QUALITY_ORDER.indexOf(b.quality) === -1 ? 99 : QUALITY_ORDER.indexOf(b.quality))
          );

        await upsertVideo({
          tmdbId,
          title: details?.title ?? cleanFilename(groupFiles[0]),
          year: details?.release_date?.split("-")[0] ?? null,
          posterPath: details?.poster_path ?? null,
          backdropPath: details?.backdrop_path ?? null,
          overview: details?.overview ?? "",
          voteAverage: details?.vote_average ?? 0,
          file: qualities[0]?.file ?? groupFiles[0],
          qualities,
        });
        matched++;
      } catch (err) {
        errors.push(`Error processing ${tmdbIdStr}: ${err}`);
      }
    }

    for (const { file, original } of filesWithNoId) {
      try {
        const searchName = cleanFilename(original);
        const quality = detectQuality(original);
        const pattern = detectEpisodePattern(original);

        // Multi-search: match movies AND TV shows correctly
        const multi = await searchMulti(searchName, token);

        if (multi?.mediaType === "tv") {
          const details = await fetchTVDetails(multi.id, token);
          const videoId = await upsertVideo({
            mediaType: "tv",
            tmdbId: multi.id,
            title: details?.name ?? searchResultTitle(multi.result),
            year: details?.first_air_date?.split("-")[0] ?? null,
            posterPath: details?.poster_path ?? null,
            backdropPath: details?.backdrop_path ?? null,
            overview: details?.overview ?? "",
            voteAverage: details?.vote_average ?? 0,
            file,
            qualities: [{ quality, file }],
          });
          // If the filename carries SxxEyy, register that episode; else E1
          const epMatch = pattern ?? { season: 1, episode: 1 };
          await upsertEpisode(videoId, epMatch.season, epMatch.episode, file, quality);
          matched++;
        } else if (multi) {
          const details = await fetchMovieDetails(multi.id, token);
          await upsertVideo({
            tmdbId: multi.id,
            title: details?.title ?? searchResultTitle(multi.result),
            year: details?.release_date?.split("-")[0] ?? null,
            posterPath: details?.poster_path ?? null,
            backdropPath: details?.backdrop_path ?? null,
            overview: details?.overview ?? "",
            voteAverage: details?.vote_average ?? 0,
            file,
            qualities: [{ quality, file }],
          });
          matched++;
        } else {
          await upsertVideo({
            tmdbId: null,
            title: searchName,
            file,
            qualities: [{ quality, file }],
          });
          unmatched++;
        }
      } catch (err) {
        errors.push(`Error processing ${file}: ${err}`);
        unmatched++;
      }
    }

    await updateScanLog(logId, {
      status: "completed",
      matched,
      unmatched,
      errors,
      completed_at: new Date().toISOString(),
    });

    return { logId, status: "completed", filesFound: files.length, matched, unmatched, errors };
  } catch (err) {
    await updateScanLog(logId, {
      status: "failed",
      errors: [String(err)],
      completed_at: new Date().toISOString(),
    });
    return { logId, status: "failed", filesFound: files.length, matched, unmatched, errors: [String(err)] };
  }
}
