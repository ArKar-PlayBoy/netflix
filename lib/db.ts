import { readFile, writeFile, mkdir, copyFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import bcrypt from "bcryptjs";

const DB_DIR = join(process.cwd(), "data");
const DB_PATH = join(DB_DIR, "admin.json");
const DB_BACKUP = join(DB_DIR, "admin.json.bak");

export type AdminDB = {
  videos: VideoRecord[];
  settings: Record<string, string>;
  scanLogs: ScanLog[];
  featured: FeaturedItem[];
  nextId: { videos: number; scanLogs: number; featured: number };
};

export type VideoRecord = {
  id: number;
  tmdb_id: number | null;
  title: string;
  year: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  file: string;
  qualities: { quality: string; file: string }[];
  created_at: string;
  updated_at: string;
};

export type ScanLog = {
  id: number;
  status: string;
  files_found: number;
  matched: number;
  unmatched: number;
  errors: string[];
  started_at: string;
  completed_at: string | null;
};

export type FeaturedItem = {
  id: number;
  movie_id: number;
  position: number;
  type: string;
  created_at: string;
};

const DEFAULT_DB: AdminDB = {
  videos: [],
  settings: {},
  scanLogs: [],
  featured: [],
  nextId: { videos: 1, scanLogs: 1, featured: 1 },
};

let cachedDb: AdminDB | null = null;
let writeLock = false;
const waitQueue: (() => void)[] = [];

async function acquireLock(): Promise<void> {
  if (!writeLock) {
    writeLock = true;
    return;
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      writeLock = true;
      resolve();
    });
  });
}

function releaseLock(): void {
  if (waitQueue.length > 0) {
    const next = waitQueue.shift()!;
    next();
  } else {
    writeLock = false;
  }
}

async function loadDb(): Promise<AdminDB> {
  if (cachedDb) return cachedDb;

  try {
    if (existsSync(DB_PATH)) {
      const data = await readFile(DB_PATH, "utf-8");
      cachedDb = JSON.parse(data);
      return cachedDb!;
    }
  } catch (err) {
    console.error("[DB] Load error, trying backup:", err);
    try {
      if (existsSync(DB_BACKUP)) {
        const data = await readFile(DB_BACKUP, "utf-8");
        cachedDb = JSON.parse(data);
        await writeFile(DB_PATH, JSON.stringify(cachedDb, null, 2));
        return cachedDb!;
      }
    } catch {
      console.error("[DB] Backup load also failed");
    }
  }

  cachedDb = { ...DEFAULT_DB };
  await saveDb(cachedDb);
  return cachedDb;
}

async function saveDb(data: AdminDB): Promise<void> {
  await acquireLock();
  try {
    await mkdir(DB_DIR, { recursive: true });

    if (existsSync(DB_PATH)) {
      await copyFile(DB_PATH, DB_BACKUP);
    }

    const json = JSON.stringify(data, null, 2);
    await writeFile(DB_PATH, json);
  } catch (err) {
    console.error("[DB] Save error:", err);
    throw new Error(`Database save failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    releaseLock();
  }
}

function nextId(data: AdminDB, table: keyof typeof data.nextId): number {
  const id = data.nextId[table];
  data.nextId[table] = id + 1;
  return id;
}

// Settings
export async function getSetting(key: string): Promise<string | null> {
  const db = await loadDb();
  return db.settings[key] ?? null;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await loadDb();
  const filtered: Record<string, string> = {};
  for (const [k, v] of Object.entries(db.settings)) {
    if (k !== "admin_password" && !k.startsWith("session_")) {
      filtered[k] = v;
    }
  }
  return filtered;
}

export async function updateSettings(settings: Record<string, string>): Promise<void> {
  const db = await loadDb();
  for (const [k, v] of Object.entries(settings)) {
    if (k === "admin_password") continue;
    db.settings[k] = v;
  }
  await saveDb(db);
}

// Admin password
export async function getAdminPasswordHash(): Promise<string | null> {
  const db = await loadDb();
  return db.settings["admin_password"] ?? null;
}

export async function initializeAdminPassword(password: string): Promise<boolean> {
  const db = await loadDb();
  if (db.settings["admin_password"]) return false;
  db.settings["admin_password"] = await bcrypt.hash(password, 10);
  await saveDb(db);
  return true;
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const db = await loadDb();
  const hash = db.settings["admin_password"];
  if (hash) {
    return bcrypt.compare(password, hash);
  }

  const envPassword = process.env.ADMIN_PASSWORD;
  if (envPassword && password === envPassword) {
    db.settings["admin_password"] = await bcrypt.hash(password, 10);
    await saveDb(db);
    return true;
  }

  return false;
}

export async function hasAdminAccount(): Promise<boolean> {
  const hash = await getAdminPasswordHash();
  return !!(hash || process.env.ADMIN_PASSWORD);
}

// Videos
export async function getAllVideos(page: number = 1, limit: number = 20, search?: string) {
  const db = await loadDb();
  let videos = db.videos;

  if (search) {
    const s = search.toLowerCase();
    videos = videos.filter(
      (v) => v.title.toLowerCase().includes(s) || String(v.tmdb_id).includes(s)
    );
  }

  videos.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const total = videos.length;
  const start = (page - 1) * limit;
  return { videos: videos.slice(start, start + limit), total };
}

export async function getVideoById(id: number): Promise<VideoRecord | null> {
  const db = await loadDb();
  return db.videos.find((v) => v.id === id) ?? null;
}

export async function getVideoByTmdbId(tmdbId: number): Promise<VideoRecord | null> {
  const db = await loadDb();
  return db.videos.find((v) => v.tmdb_id === tmdbId) ?? null;
}

export async function createVideo(data: Omit<VideoRecord, "id" | "created_at" | "updated_at">): Promise<number> {
  const db = await loadDb();
  const now = new Date().toISOString();
  const video: VideoRecord = { ...data, id: nextId(db, "videos"), created_at: now, updated_at: now };
  db.videos.push(video);
  await saveDb(db);
  return video.id;
}

export async function updateVideo(id: number, data: Partial<VideoRecord>): Promise<void> {
  const db = await loadDb();
  const idx = db.videos.findIndex((v) => v.id === id);
  if (idx === -1) return;
  db.videos[idx] = { ...db.videos[idx], ...data, updated_at: new Date().toISOString() };
  await saveDb(db);
}

export async function deleteVideo(id: number): Promise<VideoRecord | null> {
  const db = await loadDb();
  const idx = db.videos.findIndex((v) => v.id === id);
  if (idx === -1) return null;
  const [removed] = db.videos.splice(idx, 1);
  await saveDb(db);
  return removed;
}

export async function upsertVideo(data: Omit<VideoRecord, "id" | "created_at" | "updated_at">): Promise<number> {
  const db = await loadDb();
  const existing = data.tmdb_id ? db.videos.find((v) => v.tmdb_id === data.tmdb_id) : null;
  if (existing) {
    Object.assign(existing, data, { updated_at: new Date().toISOString() });
    await saveDb(db);
    return existing.id;
  }
  return createVideo(data);
}

export async function getVideoStats() {
  const db = await loadDb();
  return {
    total: db.videos.length,
    withTmdbId: db.videos.filter((v) => v.tmdb_id !== null).length,
    withoutTmdbId: db.videos.filter((v) => v.tmdb_id === null).length,
    totalSize: 0,
  };
}

// Scan logs
export async function createScanLog(data: Omit<ScanLog, "id">): Promise<number> {
  const db = await loadDb();
  const id = nextId(db, "scanLogs");
  db.scanLogs.unshift({ ...data, id });
  if (db.scanLogs.length > 50) db.scanLogs = db.scanLogs.slice(0, 50);
  await saveDb(db);
  return id;
}

export async function updateScanLog(id: number, data: Partial<ScanLog>): Promise<void> {
  const db = await loadDb();
  const log = db.scanLogs.find((l) => l.id === id);
  if (log) Object.assign(log, data);
  await saveDb(db);
}

export async function getScanLogs(limit: number = 10): Promise<ScanLog[]> {
  const db = await loadDb();
  return db.scanLogs.slice(0, limit);
}

// Featured
export async function getFeatured(): Promise<FeaturedItem[]> {
  const db = await loadDb();
  return [...db.featured].sort((a, b) => a.position - b.position);
}

export async function addToFeatured(movieId: number, type: string = "hero"): Promise<number> {
  const db = await loadDb();
  const maxPos = db.featured.length > 0 ? Math.max(...db.featured.map((f) => f.position)) : 0;
  const item: FeaturedItem = {
    id: nextId(db, "featured"),
    movie_id: movieId,
    position: maxPos + 1,
    type,
    created_at: new Date().toISOString(),
  };
  db.featured.push(item);
  await saveDb(db);
  return item.position;
}

export async function removeFromFeatured(id: number): Promise<void> {
  const db = await loadDb();
  db.featured = db.featured.filter((f) => f.id !== id);
  await saveDb(db);
}

export async function updateFeaturedPositions(items: { id: number; position: number }[]): Promise<void> {
  const db = await loadDb();
  for (const { id, position } of items) {
    const item = db.featured.find((f) => f.id === id);
    if (item) item.position = position;
  }
  await saveDb(db);
}

export async function clearFeatured(): Promise<void> {
  const db = await loadDb();
  db.featured = [];
  await saveDb(db);
}
