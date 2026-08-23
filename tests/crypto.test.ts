import { describe, it, expect } from "vitest";
import { hmacHash, safeEqual, encrypt, decrypt, isEncrypted } from "@/lib/crypto";

describe("hmacHash", () => {
  it("is deterministic for the same input", () => {
    expect(hmacHash("user@example.com")).toBe(hmacHash("user@example.com"));
  });

  it("differs for different inputs", () => {
    expect(hmacHash("a@b.c")).not.toBe(hmacHash("b@a.c"));
  });

  it("produces 64-char hex output", () => {
    expect(hmacHash("x")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("safeEqual", () => {
  it("returns true for identical strings", () => {
    expect(safeEqual("token123", "token123")).toBe(true);
  });

  it("returns false for same-length different strings", () => {
    expect(safeEqual("token123", "token124")).toBe(false);
  });

  it("returns false for different lengths without throwing", () => {
    expect(safeEqual("short", "much-longer-value")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("encrypt/decrypt roundtrip", () => {
  it("recovers plaintext exactly", () => {
    const secret = "sensitive-user-data-123";
    const cipher = encrypt(secret);
    expect(cipher.startsWith("enc:")).toBe(true);
    expect(decrypt(cipher)).toBe(secret);
  });

  it("produces different ciphertext per call (random IV)", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("returns empty string on tampered ciphertext instead of throwing", () => {
    const cipher = encrypt("data");
    const parts = cipher.split(":");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(decrypt(parts.join(":"))).toBe("");
  });
});

describe("isEncrypted", () => {
  it("detects encrypted values and passes through plaintext", () => {
    expect(isEncrypted(encrypt("x"))).toBe(true);
    expect(isEncrypted("plain")).toBe(false);
  });
});
