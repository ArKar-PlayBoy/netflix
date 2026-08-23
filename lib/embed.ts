import { getAllSettings } from "./settings";
import { parseAppSettings, type EmbedServer } from "./app-settings";

export type { EmbedServer };

export type EmbedConfig = {
  enabled: boolean;
  /** All validated provider slots (max 4) — powers the multi-server player */
  servers: EmbedServer[];
  /** First server's templates — legacy single-server parity for current consumers */
  movieTemplate: string;
  tvTemplate: string;
};

export async function getEmbedConfig(): Promise<EmbedConfig> {
  const parsed = parseAppSettings(await getAllSettings());
  const first = parsed.embedServers[0];
  return {
    enabled: parsed.embedEnabled && parsed.embedServers.length > 0,
    servers: parsed.embedServers,
    movieTemplate: first?.movie ?? "",
    tvTemplate: first?.tv ?? "",
  };
}

/** Substitute {id}/{s}/{e} tokens; returns null for empty or non-https templates */
export function buildEmbedUrl(
  template: string,
  vars: { id: number; s?: number; e?: number }
): string | null {
  if (!template) return null;
  const url = template
    .replace(/\{id\}/g, String(vars.id))
    .replace(/\{s\}/g, String(vars.s ?? 1))
    .replace(/\{e\}/g, String(vars.e ?? 1));
  return /^https:\/\//i.test(url) ? url : null;
}
