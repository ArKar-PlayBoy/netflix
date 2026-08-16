import { readdir } from "fs/promises";
import { join, extname } from "path";
import { createScanLog, updateScanLog } from "./db";
import { upsertVideo } from "./videos";

const MOVIES_DIR = join(process.cwd(), "data", "movies");
const TMDB_BASE = "https://api.themoviedb.org/3";
const VIDEO_EXTENSIONS = [".mp4", ".mkv", ".webm", ".avi", ".mov"];

const QUALITY_KEYWORDS: Record<string, string> = {
  "2160p": "4K", "4k": "4K", "1080p": "1080p", "1080": "1080p",
  "720p": "720p", "720": "720p", "480p": "480p", "480": "480p",
  "hd": "1080p", "sd": "480p",
};

const QUALITY_ORDER = ["4K", "1080p", "720p", "480p", "SD"];

function cleanFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/^[\d-]+\s*/, "").replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
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
    const res = await fetch(`${TMDB_BASE}/search/movie?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0] ?? null;
  } catch {
    return null;
  }
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

export type ScanResult = {
  logId: number;
  status: "completed" | "failed";
  filesFound: number;
  matched: number;
  unmatched: number;
  errors: string[];
};

export async function runScan(): Promise<ScanResult> {
  const token = process.env.TMDB_TOKEN;
  if (!token) throw new Error("TMDB_TOKEN not set");

  let files: string[];
  try {
    const entries = await readdir(MOVIES_DIR);
    files = entries.filter((f) => VIDEO_EXTENSIONS.includes(extname(f).toLowerCase()));
  } catch {
    files = [];
  }

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
    const filesWithNoId: string[] = [];

    for (const file of files) {
      const tmdbId = extractIdFromFilename(file);
      if (tmdbId) {
        const key = tmdbId.toString();
        if (!filesByTmdbId[key]) filesByTmdbId[key] = [];
        filesByTmdbId[key].push(file);
      } else {
        filesWithNoId.push(file);
      }
    }

    for (const [tmdbIdStr, groupFiles] of Object.entries(filesByTmdbId)) {
      try {
        const tmdbId = parseInt(tmdbIdStr);
        const details = await fetchMovieDetails(tmdbId, token);
        const qualities = groupFiles.map((file) => ({ quality: detectQuality(file), file }))
          .sort((a, b) => (QUALITY_ORDER.indexOf(a.quality) === -1 ? 99 : QUALITY_ORDER.indexOf(a.quality)) - (QUALITY_ORDER.indexOf(b.quality) === -1 ? 99 : QUALITY_ORDER.indexOf(b.quality)));

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

    for (const file of filesWithNoId) {
      try {
        const searchName = cleanFilename(file);
        const searchResult = await searchTMDB(searchName, token);
        const quality = detectQuality(file);

        await upsertVideo({
          tmdbId: searchResult?.id ?? null,
          title: searchResult?.title ?? searchName,
          year: searchResult?.release_date?.split("-")[0] ?? null,
          posterPath: searchResult?.poster_path ?? null,
          backdropPath: searchResult?.backdrop_path ?? null,
          overview: searchResult?.overview ?? "",
          voteAverage: searchResult?.vote_average ?? 0,
          file,
          qualities: [{ quality, file }],
        });

        if (searchResult) matched++;
        else unmatched++;
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

export async function getScanLogs(limit: number = 10) {
  const { getScanLogs: dbGetLogs } = await import("./db");
  return dbGetLogs(limit);
}
