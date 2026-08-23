import { describe, it, expect } from "vitest";
import { generateStorageKey } from "@/lib/r2";

describe("generateStorageKey", () => {
  it("keeps the file extension lowercased", () => {
    const key = generateStorageKey("Movie.Name.2023.MKV");
    expect(key.endsWith(".mkv")).toBe(true);
  });

  it("sanitizes unsafe characters to single dashes", () => {
    const key = generateStorageKey("weird   name!!!file---mp4.mp4".replace("---mp4", ""));
    const base = key.slice(13); // skip 12-char random prefix + dash
    expect(base).not.toMatch(/[^a-zA-Z0-9._-]/);
    expect(base).not.toContain("--");
  });

  it("prefixes a 12-hex-char capability token that differs per call", () => {
    const a = generateStorageKey("same.mp4");
    const b = generateStorageKey("same.mp4");
    expect(a).toMatch(/^[0-9a-f]{12}-/);
    expect(b).toMatch(/^[0-9a-f]{12}-/);
    expect(a).not.toBe(b);
  });

  it("truncates very long basenames to keep keys bounded", () => {
    const key = generateStorageKey(`${"x".repeat(300)}.mp4`);
    expect(key.length).toBeLessThan(120);
  });

  it("preserves dotless names fully (last char becomes the 'extension')", () => {
    const key = generateStorageKey("noext");
    expect(key).toMatch(/^[0-9a-f]{12}-noext$/);
  });
});
