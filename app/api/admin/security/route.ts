import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getSecurityEvents, clearSecurityEvents, setSecurityGeo, type GeoInfo } from "@/lib/db";
import { isPublicIp, lookupGeo, type GeoLookup } from "@/lib/ip-geo";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const since = parseInt(url.searchParams.get("since") || "0", 10) || 0;
    const data = await getSecurityEvents(since, 50);

    // Lazily geolocate attacker IPs (one-time per event, cached in DB)
    const need = data.events.filter((e) => !e.geo && isPublicIp(e.ip)).slice(0, 5);
    if (need.length > 0) {
      const lookups = await Promise.all(
        need.map(async (e) => ({ e, geo: await lookupGeo(e.ip) }))
      );
      for (const { e, geo } of lookups) {
        if (geo) {
          await setSecurityGeo(e.id, geo);
          e.geo = geo;
        }
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Failed to load security events" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await requireAdmin();
    await clearSecurityEvents();
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Failed to clear events" }, { status: 500 });
  }
}
