import { NextResponse } from "next/server";
import crypto from "crypto";

const STREAM_SECRET = process.env.STREAM_SECRET;
const DEFAULT_SECRET = "default-secret-change-me";

export async function GET() {
  try {
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
