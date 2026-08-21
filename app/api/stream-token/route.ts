import { NextResponse } from "next/server";
import crypto from "crypto";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const STREAM_SECRET = process.env.STREAM_SECRET;
const DEFAULT_SECRET = "default-secret-change-me";

export async function GET(request: Request) {
  try {
    // Token-farming protection: legit playback needs a few tokens/hour, not hundreds
    const rl = rateLimit(`stream-token:${getClientIp(request)}`, 30, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests" },
        { status: 429 }
      );
    }

    const secret = STREAM_SECRET || DEFAULT_SECRET;
    const expires = Date.now() + 7200000;
    const hash = crypto.createHash("sha256").update(`${expires}:${secret}`).digest("hex");
    const token = Buffer.from(`${expires}:${hash}`).toString("base64");

    return NextResponse.json({ success: true, data: { token, expiresIn: 7200 } });
  } catch (err) {
    console.error("[StreamToken] Error:", err);
    return NextResponse.json({ success: false, error: "Failed to generate token" }, { status: 500 });
  }
}
