/**
 * Single source of truth for app settings: types, defaults, parsers, validators.
 * Pure module — no DB/network imports — so both server code and tests consume it.
 *
 * Storage format stays a flat Record<string,string> in Postgres (see lib/settings.ts).
 * This module owns parsing/validation; lib/settings.ts delegates to it.
 */

export type QualityTier = "auto" | "4k" | "1080p" | "720p" | "480p";

export type EmbedServer = {
  name: string;
  movie: string;
  tv: string;
};

export type AppSettings = {
  appName: string;
  defaultQuality: QualityTier;
  networkThresholdWifi: "4k" | "1080p" | "720p";
  networkThreshold4G: "1080p" | "720p" | "480p";
  networkThreshold3G: "720p" | "480p";
  tmdbRegion: string;
  videoExtensions: string;
  adminPassword?: string;
  embedEnabled: boolean;
  embedServers: EmbedServer[];
};

/** Raw storage-layer defaults — single source of truth */
export const RAW_DEFAULTS: Record<string, string> = {
  app_name: "Vionix",
  default_quality: "auto",
  network_threshold_wifi: "4k",
  network_threshold_4g: "1080p",
  network_threshold_3g: "720p",
  tmdb_region: "US",
  video_extensions: ".mp4,.mkv,.webm,.avi,.mov",
  embed_enabled: "off",
  embed_movie_template: "",
  embed_tv_template: "",
};

const QUALITY_TIERS: ReadonlySet<string> = new Set(["auto", "4k", "1080p", "720p", "480p"]);

/** Legal values per threshold key — mirrors the admin settings UI exactly */
const WIFI_TIERS: ReadonlySet<string> = new Set(["4k", "1080p", "720p"]);
const FOUR_G_TIERS: ReadonlySet<string> = new Set(["1080p", "720p", "480p"]);
const THREE_G_TIERS: ReadonlySet<string> = new Set(["720p", "480p"]);

function oneOf<T extends string>(value: string | undefined, legal: ReadonlySet<string>, fallback: T): T {
  return value && legal.has(value) ? (value as T) : fallback;
}

export const MAX_EMBED_SERVERS = 4;

function isHttps(url: unknown): url is string {
  return typeof url === "string" && /^https:\/\//i.test(url);
}

/**
 * Parse the embed-servers JSON blob into validated server entries.
 * - Invalid JSON / non-array → []
 * - Entries without any https URL are dropped
 * - Unnamed entries get "Server N"
 * - Capped at MAX_EMBED_SERVERS
 */
export function parseEmbedServers(rawJson: string | undefined | null): EmbedServer[] {
  if (!rawJson) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(rawJson);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .slice(0, MAX_EMBED_SERVERS)
    .map((s, i): EmbedServer => {
      const srv = s as Partial<EmbedServer>;
      return {
        name: typeof srv.name === "string" && srv.name.trim() ? srv.name.trim().slice(0, 40) : `Server ${i + 1}`,
        movie: isHttps(srv.movie) ? srv.movie : "",
        tv: isHttps(srv.tv) ? srv.tv : "",
      };
    })
    .filter((s) => s.movie || s.tv);
}

/**
 * Legacy migration: the two fixed template keys predate embed_servers.
 * Returns them as a single "Server 1" entry when embed_servers is absent/empty.
 */
export function parseLegacyEmbedTemplates(rec: Record<string, string>): EmbedServer[] {
  const movie = rec.embed_movie_template ?? "";
  const tv = rec.embed_tv_template ?? "";
  if (!movie && !tv) return [];
  return [
    {
      name: "Server 1",
      movie: isHttps(movie) ? movie : "",
      tv: isHttps(tv) ? tv : "",
    },
  ].filter((s) => s.movie || s.tv);
}

export function parseAppSettings(raw: Record<string, string>): AppSettings {
  const embedServers = parseEmbedServers(raw.embed_servers);
  const legacy = embedServers.length === 0 ? parseLegacyEmbedTemplates(raw) : [];
  return {
    appName: raw.app_name ?? RAW_DEFAULTS.app_name,
    defaultQuality: oneOf(raw.default_quality, QUALITY_TIERS, "auto"),
    networkThresholdWifi: oneOf(raw.network_threshold_wifi, WIFI_TIERS, "4k"),
    networkThreshold4G: oneOf(raw.network_threshold_4g, FOUR_G_TIERS, "1080p"),
    networkThreshold3G: oneOf(raw.network_threshold_3g, THREE_G_TIERS, "720p"),
    tmdbRegion: raw.tmdb_region ?? RAW_DEFAULTS.tmdb_region,
    videoExtensions: raw.video_extensions ?? RAW_DEFAULTS.video_extensions,
    adminPassword: raw.admin_password,
    embedEnabled: raw.embed_enabled === "on",
    embedServers: embedServers.length > 0 ? embedServers : legacy,
  };
}
