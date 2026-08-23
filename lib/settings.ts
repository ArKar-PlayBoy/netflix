import { getAllSettings as dbGetAll, updateSettings as dbUpdate } from "./db";
import { RAW_DEFAULTS } from "./app-settings";

export type SettingKey =
  | "app_name"
  | "default_quality"
  | "network_threshold_wifi"
  | "network_threshold_4g"
  | "network_threshold_3g"
  | "tmdb_region"
  | "video_extensions"
  | "admin_password"
  | "embed_enabled"
  | "embed_movie_template"
  | "embed_tv_template"
  | "embed_servers";

/** Defaults live in app-settings.ts (single source of truth); embed_servers starts unset */
const DEFAULTS: Record<string, string> = { ...RAW_DEFAULTS, embed_servers: "" };

export async function getSetting(key: SettingKey): Promise<string> {
  const settings = await dbGetAll();
  return settings[key] ?? DEFAULTS[key] ?? "";
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const settings = await dbGetAll();
  return { ...DEFAULTS, ...settings };
}

export async function updateSetting(key: SettingKey, value: string): Promise<void> {
  await dbUpdate({ [key]: value });
}

export async function updateSettings(settings: Record<string, string>): Promise<void> {
  await dbUpdate(settings);
}
