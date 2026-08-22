import { cookies } from "next/headers";
import crypto from "crypto";
import { findUserById, toSafeUser, type SafeUser } from "./db";
import { safeEqual } from "./crypto";

const SESSION_COOKIE = "user_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
const SECRET = process.env.SESSION_SECRET || process.env.STREAM_SECRET || "user-session-secret-change-me";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const config = getGoogleConfig();
  if (!config) throw new Error("Google OAuth not configured");
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

/** Session token = base64(userId : sessionVer : timestamp : signature).
 *  sessionVer lives in the users row; bumping it (logout) revokes every
 *  issued session of that user across all devices. */
export async function createUserSession(userId: number, sessionVer: number): Promise<void> {
  const payload = `${userId}:${sessionVer}:${Date.now()}`;
  const token = Buffer.from(`${payload}:${sign(payload)}`).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

/** Returns the signed-in customer stripped of ALL sensitive fields
 *  (password_hash, google_id, email_hash never leave this function) */
export async function getCurrentUser(): Promise<SafeUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return null;

    const [userIdStr, verStr, ts, signature] = parts;
    if (!safeEqual(sign(`${userIdStr}:${verStr}:${ts}`), signature)) return null;
    if (Date.now() - parseInt(ts) > SESSION_MAX_AGE * 1000) return null;

    const user = await findUserById(parseInt(userIdStr));
    if (!user) return null;

    // Revocation check
    if (user.session_ver !== parseInt(verStr)) return null;

    return toSafeUser(user);
  } catch {
    return null;
  }
}

export async function destroyUserSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
