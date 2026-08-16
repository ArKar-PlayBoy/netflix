import { getAllSettings as dbGetAll, updateSettings as dbUpdate } from "./db";

export type SettingKey =
  | "app_name"
  | "default_quality"
  | "network_threshold_wifi"
  | "network_threshold_4g"
  | "network_threshold_3g"
  | "tmdb_region"
  | "video_extensions"
  | "admin_password";

const DEFAULTS: Record<string, string> = {
  app_name: "MovieApp",
  default_quality: "auto",
  network_threshold_wifi: "4k",
  network_threshold_4g: "1080p",
  network_threshold_3g: "720p",
  tmdb_region: "US",
  video_extensions: ".mp4,.mkv,.webm,.avi,.mov",
};

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
