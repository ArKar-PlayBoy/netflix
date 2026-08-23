import { describe, it, expect } from "vitest";
import { buildEmbedUrl } from "@/lib/embed";

describe("buildEmbedUrl", () => {
  it("substitutes movie id", () => {
    expect(buildEmbedUrl("https://vidsrc.cc/v3/embed/movie/{id}", { id: 597 })).toBe(
      "https://vidsrc.cc/v3/embed/movie/597"
    );
  });

  it("substitutes tv id, season and episode", () => {
    expect(buildEmbedUrl("https://p.example/tv/{id}/{s}/{e}", { id: 1399, s: 2, e: 5 })).toBe(
      "https://p.example/tv/1399/2/5"
    );
  });

  it("defaults season/episode to 1 for tv templates", () => {
    expect(buildEmbedUrl("https://p.example/tv/{id}/{s}/{e}", { id: 1 })).toBe(
      "https://p.example/tv/1/1/1"
    );
  });

  it("replaces repeated tokens", () => {
    expect(buildEmbedUrl("https://multiembed.mov/?video_id={id}&tmdb=1&s={s}&e={e}", { id: 42, s: 3, e: 7 })).toBe(
      "https://multiembed.mov/?video_id=42&tmdb=1&s=3&e=7"
    );
  });

  it("returns null when template empty (feature disabled)", () => {
    expect(buildEmbedUrl("", { id: 1 })).toBeNull();
  });

  it("rejects non-https schemes", () => {
    expect(buildEmbedUrl("http://evil.com/{id}", { id: 1 })).toBeNull();
    expect(buildEmbedUrl("javascript:alert({id})", { id: 1 })).toBeNull();
    expect(buildEmbedUrl("data:text/html,{id}", { id: 1 })).toBeNull();
  });
});
