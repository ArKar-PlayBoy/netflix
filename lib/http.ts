import { NextResponse } from "next/server";

/** Parse a JSON body with a hard size ceiling — blocks payload-DoS
 *  (someone posting a 100MB blob into request.json()). */
export async function safeJson<T = Record<string, unknown>>(
  request: Request,
  maxBytes: number = 32 * 1024
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const declared = parseInt(request.headers.get("content-length") || "0", 10);
  if (declared > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Payload too large" },
        { status: 413 }
      ),
    };
  }

  try {
    const text = await request.text();
    if (text.length > maxBytes) {
      return {
        ok: false,
        response: NextResponse.json({ success: false, error: "Payload too large" }, { status: 413 }),
      };
    }
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      ),
    };
  }
}
