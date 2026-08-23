import { describe, it, expect } from "vitest";
import {
  parseEmbedServers,
  parseLegacyEmbedTemplates,
  parseAppSettings,
  MAX_EMBED_SERVERS,
} from "@/lib/app-settings";

describe("parseEmbedServers", () => {
  it("parses a valid multi-server JSON blob", () => {
    const json = JSON.stringify([
      { name: "MultiEmbed", movie: "https://multiembed.mov/?video_id={id}&tmdb=1", tv: "https://multiembed.mov/?video_id={id}&tmdb=1&s={s}&e={e}" },
      { name: "VidSrc", movie: "https://vidsrc.cc/v3/embed/movie/{id}", tv: "" },
    ]);
    const out = parseEmbedServers(json);
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe("MultiEmbed");
    expect(out[1].movie).toBe("https://vidsrc.cc/v3/embed/movie/{id}");
  });

  it("returns [] for invalid JSON, empty input, and non-arrays", () => {
    expect(parseEmbedServers(undefined)).toEqual([]);
    expect(parseEmbedServers(null)).toEqual([]);
    expect(parseEmbedServers("")).toEqual([]);
    expect(parseEmbedServers("{not json")).toEqual([]);
    expect(parseEmbedServers('{"a":1}')).toEqual([]);
    expect(parseEmbedServers('"just a string"')).toEqual([]);
    expect(parseEmbedServers("42")).toEqual([]);
  });

  it("caps the list at MAX_EMBED_SERVERS", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({
      name: `S${i}`,
      movie: `https://s${i}.example/m/{id}`,
      tv: "",
    }));
    expect(parseEmbedServers(JSON.stringify(six))).toHaveLength(MAX_EMBED_SERVERS);
  });

  it("drops non-https URLs inside entries, keeps the https one", () => {
    const out = parseEmbedServers(
      JSON.stringify([{ name: "Mixed", movie: "http://insecure.com/{id}", tv: "https://ok.tv/{id}/{s}/{e}" }])
    );
    expect(out[0].movie).toBe("");
    expect(out[0].tv).toBe("https://ok.tv/{id}/{s}/{e}");
  });

  it("drops entries with no usable URL at all", () => {
    const out = parseEmbedServers(
      JSON.stringify([
        { name: "Empty", movie: "", tv: "" },
        { name: "Good", movie: "https://good.example/{id}", tv: "" },
      ])
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Good");
  });

  it("names unnamed entries Server N and trims/caps names", () => {
    const out = parseEmbedServers(
      JSON.stringify([{ movie: "https://a.example/{id}" }, { name: "   ".padEnd(3) + "X".repeat(60), movie: "https://b.example/{id}" }])
    );
    expect(out[0].name).toBe("Server 1");
    expect(out[1].name.length).toBeLessThanOrEqual(40);
  });
});

describe("parseLegacyEmbedTemplates", () => {
  it("returns [] when no legacy keys exist", () => {
    expect(parseLegacyEmbedTemplates({})).toEqual([]);
    expect(parseLegacyEmbedTemplates({ embed_movie_template: "", embed_tv_template: "" })).toEqual([]);
  });

  it("imports legacy keys as Server 1 (your saved MultiEmbed config)", () => {
    const out = parseLegacyEmbedTemplates({
      embed_movie_template: "https://multiembed.mov/?video_id={id}&tmdb=1",
      embed_tv_template: "https://multiembed.mov/?video_id={id}&tmdb=1&s={s}&e={e}",
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      name: "Server 1",
      movie: "https://multiembed.mov/?video_id={id}&tmdb=1",
      tv: "https://multiembed.mov/?video_id={id}&tmdb=1&s={s}&e={e}",
    });
  });

  it("yields [] if legacy values are all non-https garbage", () => {
    expect(parseLegacyEmbedTemplates({ embed_movie_template: "javascript:x" })).toEqual([]);
  });
});

describe("parseAppSettings", () => {
  it("applies defaults to an empty record", () => {
    const s = parseAppSettings({});
    expect(s.appName).toBe("Vionix");
    expect(s.defaultQuality).toBe("auto");
    expect(s.networkThresholdWifi).toBe("4k");
    expect(s.embedEnabled).toBe(false);
    expect(s.embedServers).toEqual([]);
  });

  it("rejects invalid quality tiers by falling back", () => {
    const s = parseAppSettings({ default_quality: "8k", network_threshold_4g: "4k", network_threshold_3g: "1080p" });
    expect(s.defaultQuality).toBe("auto");
    expect(s.networkThreshold4G).toBe("1080p");
    expect(s.networkThreshold3G).toBe("720p");
  });

  it("treats only 'on' as enabled", () => {
    expect(parseAppSettings({ embed_enabled: "on" }).embedEnabled).toBe(true);
    expect(parseAppSettings({ embed_enabled: "true" }).embedEnabled).toBe(false);
  });

  it("prefers embed_servers JSON over legacy templates", () => {
    const rec = {
      embed_servers: JSON.stringify([{ name: "New", movie: "https://new.example/{id}", tv: "" }]),
      embed_movie_template: "https://legacy.example/{id}",
    };
    const s = parseAppSettings(rec);
    expect(s.embedServers[0].name).toBe("New");
  });

  it("falls back to legacy templates when embed_servers is absent (migration path)", () => {
    const s = parseAppSettings({ embed_movie_template: "https://multiembed.mov/?video_id={id}&tmdb=1" });
    expect(s.embedEnabled).toBe(false);
    expect(s.embedServers[0].name).toBe("Server 1");
  });
});
