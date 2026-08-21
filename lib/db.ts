import postgres from "postgres";
import bcrypt from "bcryptjs";
import { hmacHash, encrypt, decrypt, safeEqual } from "./crypto";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Create a Neon/Vercel Postgres database and add it to .env");
}

const sql = postgres(DATABASE_URL, {
  ssl: "require",
  max: 5,
  // Keep connections alive longer so active periods don't pay repeated
  // TCP+TLS handshake costs (big win when DB is far away)
  idle_timeout: 300,
  connect_timeout: 10,
  // Required for Neon's PgBouncer pooler (transaction mode)
  prepare: false,
  // Suppress noisy "relation already exists" NOTICEs from CREATE TABLE IF NOT EXISTS
  onnotice: () => {},
});

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

export type AuditLog = {
  id: number;
  action: string;
  detail: string;
  created_at: string;
};

export type UserRecord = {
  id: number;
  google_id: string | null;
  email_hash: string;
  email: string; // decrypted on read
  name: string;
  picture: string | null;
  password_hash: string | null;
  created_at: string;
};

/** Customer-safe shape — the ONLY form of user data allowed in API responses */
export type SafeUser = {
  id: number;
  name: string;
  email: string;
  picture: string | null;
};

export function toSafeUser(user: UserRecord): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    picture: user.picture,
  };
}

type DbVideoRow = Omit<VideoRecord, "created_at" | "updated_at"> & { created_at: Date; updated_at: Date };
type DbUserRow = {
  id: number;
  google_id: string | null;
  email_hash: string;
  email: string;
  name: string;
  picture: string | null;
  password_hash: string | null;
  created_at: Date;
};
type DbScanLogRow = Omit<ScanLog, "started_at" | "completed_at"> & { started_at: Date; completed_at: Date | null };

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapVideo(row: DbVideoRow): VideoRecord {
  return {
    ...row,
    qualities: typeof row.qualities === "string" ? JSON.parse(row.qualities) : row.qualities,
    created_at: iso(row.created_at)!,
    updated_at: iso(row.updated_at)!,
  };
}

function mapScanLog(row: DbScanLogRow): ScanLog {
  return {
    ...row,
    errors: typeof row.errors === "string" ? JSON.parse(row.errors) : row.errors,
    started_at: iso(row.started_at)!,
    completed_at: iso(row.completed_at),
  };
}

function mapUser(row: DbUserRow): UserRecord {
  return { ...row, email: decrypt(row.email), created_at: iso(row.created_at)! };
}

let schemaPromise: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS videos (
        id SERIAL PRIMARY KEY,
        tmdb_id INTEGER UNIQUE,
        title TEXT NOT NULL,
        year TEXT,
        poster_path TEXT,
        backdrop_path TEXT,
        overview TEXT DEFAULT '',
        vote_average REAL DEFAULT 0,
        file TEXT NOT NULL,
        qualities JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS idx_videos_tmdb_id ON videos(tmdb_id)`;
      await sql`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS scan_logs (
        id SERIAL PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'running',
        files_found INTEGER DEFAULT 0,
        matched INTEGER DEFAULT 0,
        unmatched INTEGER DEFAULT 0,
        errors JSONB DEFAULT '[]'::jsonb,
        started_at TIMESTAMPTZ DEFAULT now(),
        completed_at TIMESTAMPTZ
      )`;
      await sql`CREATE TABLE IF NOT EXISTS featured (
        id SERIAL PRIMARY KEY,
        movie_id INTEGER NOT NULL,
        position INTEGER NOT NULL,
        type TEXT DEFAULT 'hero',
        created_at TIMESTAMPTZ DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        detail TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_id TEXT UNIQUE,
        email_hash TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        picture TEXT,
        password_hash TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tmdb_id INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(user_id, tmdb_id)
      )`;
    })();
  }
  return schemaPromise;
}

// Settings
export async function getSetting(key: string): Promise<string | null> {
  await ensureSchema();
  const rows = await sql<{ value: string }[]>`SELECT value FROM settings WHERE key = ${key}`;
  return rows[0]?.value ?? null;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  await ensureSchema();
  const rows = await sql<{ key: string; value: string }[]>`
    SELECT key, value FROM settings WHERE key != 'admin_password' AND key NOT LIKE 'session_%'
  `;
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function updateSettings(settings: Record<string, string>): Promise<void> {
  await ensureSchema();
  for (const [key, value] of Object.entries(settings)) {
    if (key === "admin_password") continue;
    await sql`
      INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${value}, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;
  }
}

// Admin password
export async function getAdminPasswordHash(): Promise<string | null> {
  const hash = await getSetting("admin_password");
  return hash ?? null;
}

export async function initializeAdminPassword(password: string): Promise<boolean> {
  await ensureSchema();
  const existing = await getAdminPasswordHash();
  if (existing) return false;
  const hash = await bcrypt.hash(password, 10);
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES ('admin_password', ${hash}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
  return true;
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  await ensureSchema();
  const hash = await getAdminPasswordHash();
  if (hash) {
    return bcrypt.compare(password, hash);
  }

  const envPassword = process.env.ADMIN_PASSWORD;
  if (envPassword && safeEqual(password, envPassword)) {
    await initializeAdminPassword(envPassword);
    return true;
  }

  return false;
}

export async function hasAdminAccount(): Promise<boolean> {
  const hash = await getAdminPasswordHash();
  return !!(hash || process.env.ADMIN_PASSWORD);
}

// Single round-trip login check: fetches hash once, handles env fallback + seeding
export async function authenticateAdmin(password: string): Promise<{ ok: boolean; needsSetup: boolean }> {
  await ensureSchema();
  const rows = await sql<{ value: string }[]>`SELECT value FROM settings WHERE key = 'admin_password'`;
  const storedHash = rows[0]?.value ?? null;

  if (!storedHash) {
    const envPassword = process.env.ADMIN_PASSWORD;
    if (envPassword && safeEqual(password, envPassword)) {
      await initializeAdminPassword(envPassword);
      return { ok: true, needsSetup: false };
    }
    if (envPassword) return { ok: false, needsSetup: false };
    return { ok: false, needsSetup: true };
  }

  const ok = await bcrypt.compare(password, storedHash);
  return { ok, needsSetup: false };
}

// Videos
export async function getAllVideos(page: number = 1, limit: number = 20, search?: string) {
  await ensureSchema();
  const offset = (page - 1) * limit;

  let where = sql``;
  if (search && search.trim()) {
    const pattern = `%${search.trim()}%`;
    where = sql`WHERE title ILIKE ${pattern} OR CAST(tmdb_id AS TEXT) LIKE ${pattern}`;
  }

  const rows = await sql<DbVideoRow[]>`
    SELECT * FROM videos ${where}
    ORDER BY updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const countRows = await sql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM videos ${where}`;

  return { videos: rows.map(mapVideo), total: countRows[0]?.count ?? 0 };
}

export async function loadAllVideos(): Promise<VideoRecord[]> {
  await ensureSchema();
  const rows = await sql<DbVideoRow[]>`SELECT * FROM videos ORDER BY updated_at DESC`;
  return rows.map(mapVideo);
}

export async function getVideoById(id: number): Promise<VideoRecord | null> {
  await ensureSchema();
  const rows = await sql<DbVideoRow[]>`SELECT * FROM videos WHERE id = ${id}`;
  return rows[0] ? mapVideo(rows[0]) : null;
}

export async function getVideoByTmdbId(tmdbId: number): Promise<VideoRecord | null> {
  await ensureSchema();
  const rows = await sql<DbVideoRow[]>`SELECT * FROM videos WHERE tmdb_id = ${tmdbId}`;
  return rows[0] ? mapVideo(rows[0]) : null;
}

export async function createVideo(data: Omit<VideoRecord, "id" | "created_at" | "updated_at">): Promise<number> {
  await ensureSchema();
  const rows = await sql<{ id: number }[]>`
    INSERT INTO videos (tmdb_id, title, year, poster_path, backdrop_path, overview, vote_average, file, qualities)
    VALUES (${data.tmdb_id}, ${data.title}, ${data.year}, ${data.poster_path}, ${data.backdrop_path},
            ${data.overview}, ${data.vote_average}, ${data.file}, ${sql.json(data.qualities)}::jsonb)
    RETURNING id
  `;
  return rows[0].id;
}

export async function updateVideo(id: number, data: Partial<VideoRecord>): Promise<void> {
  await ensureSchema();
  await sql`
    UPDATE videos SET
      tmdb_id = COALESCE(${data.tmdb_id ?? null}, tmdb_id),
      title = COALESCE(${data.title ?? null}, title),
      year = COALESCE(${data.year ?? null}, year),
      poster_path = COALESCE(${data.poster_path ?? null}, poster_path),
      backdrop_path = COALESCE(${data.backdrop_path ?? null}, backdrop_path),
      overview = COALESCE(${data.overview ?? null}, overview),
      vote_average = COALESCE(${data.vote_average ?? null}, vote_average),
      file = COALESCE(${data.file ?? null}, file),
      qualities = COALESCE(${data.qualities ? sql.json(data.qualities) : null}::jsonb, qualities),
      updated_at = now()
    WHERE id = ${id}
  `;
}

export async function deleteVideo(id: number): Promise<VideoRecord | null> {
  await ensureSchema();
  const rows = await sql<DbVideoRow[]>`DELETE FROM videos WHERE id = ${id} RETURNING *`;
  return rows[0] ? mapVideo(rows[0]) : null;
}

export async function upsertVideo(data: Omit<VideoRecord, "id" | "created_at" | "updated_at">): Promise<number> {
  await ensureSchema();

  if (data.tmdb_id !== null) {
    const rows = await sql<{ id: number }[]>`
      INSERT INTO videos (tmdb_id, title, year, poster_path, backdrop_path, overview, vote_average, file, qualities)
      VALUES (${data.tmdb_id}, ${data.title}, ${data.year}, ${data.poster_path}, ${data.backdrop_path},
              ${data.overview}, ${data.vote_average}, ${data.file}, ${sql.json(data.qualities)}::jsonb)
      ON CONFLICT (tmdb_id) DO UPDATE SET
        title = EXCLUDED.title,
        year = EXCLUDED.year,
        poster_path = EXCLUDED.poster_path,
        backdrop_path = EXCLUDED.backdrop_path,
        overview = EXCLUDED.overview,
        vote_average = EXCLUDED.vote_average,
        file = EXCLUDED.file,
        qualities = EXCLUDED.qualities,
        updated_at = now()
      RETURNING id
    `;
    return rows[0].id;
  }

  return createVideo(data);
}

export async function getVideoStats() {
  await ensureSchema();
  const rows = await sql<{ total: number; with_tmdb: number }[]>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(tmdb_id)::int AS with_tmdb
    FROM videos
  `;
  const total = rows[0]?.total ?? 0;
  const withTmdbId = rows[0]?.with_tmdb ?? 0;
  return {
    total,
    withTmdbId,
    withoutTmdbId: total - withTmdbId,
    totalSize: 0,
  };
}

// Scan logs
export async function createScanLog(data: Omit<ScanLog, "id">): Promise<number> {
  await ensureSchema();
  const rows = await sql<{ id: number }[]>`
    INSERT INTO scan_logs (status, files_found, matched, unmatched, errors)
    VALUES (${data.status}, ${data.files_found}, ${data.matched}, ${data.unmatched}, ${sql.json(data.errors)}::jsonb)
    RETURNING id
  `;
  return rows[0].id;
}

export async function updateScanLog(id: number, data: Partial<ScanLog>): Promise<void> {
  await ensureSchema();
  await sql`
    UPDATE scan_logs SET
      status = COALESCE(${data.status ?? null}, status),
      files_found = COALESCE(${data.files_found ?? null}, files_found),
      matched = COALESCE(${data.matched ?? null}, matched),
      unmatched = COALESCE(${data.unmatched ?? null}, unmatched),
      errors = COALESCE(${data.errors ? sql.json(data.errors) : null}::jsonb, errors),
      completed_at = CASE WHEN ${data.completed_at !== undefined ? true : false} THEN now() ELSE completed_at END
    WHERE id = ${id}
  `;
}

export async function getScanLogs(limit: number = 10): Promise<ScanLog[]> {
  await ensureSchema();
  const rows = await sql<DbScanLogRow[]>`
    SELECT * FROM scan_logs ORDER BY started_at DESC LIMIT ${limit}
  `;
  return rows.map(mapScanLog);
}

// Audit logs
export async function addAuditLog(action: string, detail: string): Promise<void> {
  await ensureSchema();
  // Cleanup only 5% of the time — saves a round-trip on most writes
  if (Math.random() < 0.05) {
    // Transaction: insert + cleanup commit together or roll back together
    await sql.begin(async (tx) => {
      await tx`INSERT INTO audit_logs (action, detail) VALUES (${action}, ${detail})`;
      await tx`
        DELETE FROM audit_logs
        WHERE id NOT IN (SELECT id FROM audit_logs ORDER BY id DESC LIMIT 200)
      `;
    });
  } else {
    await sql`INSERT INTO audit_logs (action, detail) VALUES (${action}, ${detail})`;
  }
}

export async function getAuditLogs(page: number = 1, limit: number = 30) {
  await ensureSchema();
  const offset = (page - 1) * limit;
  const rows = await sql<AuditLog[]>`
    SELECT id, action, detail, created_at FROM audit_logs
    ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}
  `;
  const countRows = await sql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM audit_logs`;
  return {
    logs: rows.map((r) => ({ ...r, created_at: iso(r.created_at)! })),
    total: countRows[0]?.count ?? 0,
  };
}

export async function clearAuditLogs(): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM audit_logs`;
}

// Featured
export async function getFeatured(): Promise<FeaturedItem[]> {
  await ensureSchema();
  const rows = await sql<FeaturedItem[]>`
    SELECT id, movie_id, position, type, created_at FROM featured ORDER BY position ASC
  `;
  return rows.map((r) => ({ ...r, created_at: iso(r.created_at)! }));
}

export async function addToFeatured(movieId: number, type: string = "hero"): Promise<number> {
  await ensureSchema();
  const posRows = await sql<{ pos: number }[]>`
    SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM featured WHERE type = ${type}
  `;
  const position = posRows[0]?.pos ?? 1;
  await sql`INSERT INTO featured (movie_id, position, type) VALUES (${movieId}, ${position}, ${type})`;
  return position;
}

export async function removeFromFeatured(id: number): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM featured WHERE id = ${id}`;
}

export async function updateFeaturedPositions(items: { id: number; position: number }[]): Promise<void> {
  await ensureSchema();
  await sql.begin(async (tx) => {
    for (const { id, position } of items) {
      await tx`UPDATE featured SET position = ${position} WHERE id = ${id}`;
    }
  });
}

export async function clearFeatured(): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM featured`;
}

// Users — PII protection: google_id/email_hash HMAC-hashed, email encrypted at rest
function toPublicUser(stored: DbUserRow): UserRecord {
  return { ...stored, email: decrypt(stored.email), created_at: iso(stored.created_at)! };
}

export async function findUserByGoogleId(googleId: string): Promise<UserRecord | null> {
  await ensureSchema();
  const rows = await sql<DbUserRow[]>`SELECT * FROM users WHERE google_id = ${hmacHash(googleId)}`;
  return rows[0] ? toPublicUser(rows[0]) : null;
}

export async function findUserByEmailHash(emailHash: string): Promise<UserRecord | null> {
  await ensureSchema();
  const rows = await sql<DbUserRow[]>`SELECT * FROM users WHERE email_hash = ${emailHash}`;
  return rows[0] ? toPublicUser(rows[0]) : null;
}

export async function findUserById(id: number): Promise<UserRecord | null> {
  await ensureSchema();
  const rows = await sql<DbUserRow[]>`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] ? toPublicUser(rows[0]) : null;
}

export async function createEmailUser(data: { email: string; name: string; passwordHash: string }): Promise<UserRecord> {
  await ensureSchema();
  const rows = await sql<DbUserRow[]>`
    INSERT INTO users (google_id, email_hash, email, name, picture, password_hash)
    VALUES (NULL, ${hmacHash(data.email.toLowerCase())}, ${encrypt(data.email)}, ${data.name}, NULL, ${data.passwordHash})
    RETURNING *
  `;
  return toPublicUser(rows[0]);
}

export async function upsertGoogleUser(data: { google_id: string; email: string; name: string; picture: string | null }): Promise<UserRecord> {
  await ensureSchema();
  const emailLower = data.email.toLowerCase();
  const rows = await sql<DbUserRow[]>`
    INSERT INTO users (google_id, email_hash, email, name, picture, password_hash)
    VALUES (${hmacHash(data.google_id)}, ${hmacHash(emailLower)}, ${encrypt(data.email)}, ${data.name}, ${data.picture}, NULL)
    ON CONFLICT (google_id) DO UPDATE SET
      email_hash = EXCLUDED.email_hash,
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      picture = EXCLUDED.picture
    RETURNING *
  `;
  return toPublicUser(rows[0]);
}

// Favorites
export async function getUserFavorites(userId: number): Promise<number[]> {
  await ensureSchema();
  const rows = await sql<{ tmdb_id: number }[]>`
    SELECT tmdb_id FROM favorites WHERE user_id = ${userId} ORDER BY created_at ASC
  `;
  return rows.map((r) => r.tmdb_id);
}

export async function addUserFavorite(userId: number, tmdbId: number): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO favorites (user_id, tmdb_id) VALUES (${userId}, ${tmdbId})
    ON CONFLICT (user_id, tmdb_id) DO NOTHING
  `;
}

export async function removeUserFavorite(userId: number, tmdbId: number): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM favorites WHERE user_id = ${userId} AND tmdb_id = ${tmdbId}`;
}
