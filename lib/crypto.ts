import crypto from "crypto";

const RAW_KEY =
  process.env.DATA_ENCRYPTION_KEY ||
  process.env.SESSION_SECRET ||
  process.env.STREAM_SECRET ||
  "";

function getKey(): Buffer {
  return crypto.createHash("sha256").update(`data-protect:${RAW_KEY}`).digest();
}

export function hmacHash(value: string): string {
  const key = getKey();
  return crypto.createHmac("sha256", key).update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext.startsWith("enc:")) return ciphertext;
  try {
    const [, ivB64, tagB64, dataB64] = ciphertext.split(":");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf-8");
  } catch {
    return "";
  }
}

export function isEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith("enc:");
}
