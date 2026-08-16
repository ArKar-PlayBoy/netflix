import { cookies } from "next/headers";
import crypto from "crypto";
import { getAdminPasswordHash, initializeAdminPassword as dbInit, verifyAdminPassword as dbVerify, hasAdminAccount as dbHasAdmin } from "./db";

const SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE = 24 * 60 * 60;
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.STREAM_SECRET || "admin-session-secret-change-me";

export async function initializeAdminPassword(password: string): Promise<boolean> {
  return dbInit(password);
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  return dbVerify(password);
}

export async function hasAdminAccount(): Promise<boolean> {
  return dbHasAdmin();
}

function createSignedToken(): string {
  const payload = `${Date.now()}:${crypto.randomBytes(16).toString("hex")}`;
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64");
}

function verifySignedToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length < 3) return false;
    const signature = parts.pop()!;
    const payload = parts.join(":");
    const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
    if (signature !== expected) return false;
    const ts = parseInt(parts[0]);
    if (Date.now() - ts > SESSION_MAX_AGE * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

export async function createSession(): Promise<string> {
  const token = createSignedToken();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return token;
}

export async function validateSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  return verifySignedToken(token);
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function requireAdmin(): Promise<void> {
  const isValid = await validateSession();
  if (!isValid) throw new Error("Unauthorized");
}
