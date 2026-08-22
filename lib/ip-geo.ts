/** True for public/routable IPs — false for localhost & private ranges */
export function isPublicIp(ip: string): boolean {
  if (!ip) return false;
  if (ip === "::1" || ip === "127.0.0.1" || ip.startsWith("::ffff:127.")) return false;
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("169.254.")) return false;
  if (ip.startsWith("172.")) {
    const second = parseInt(ip.split(".")[1] ?? "0", 10);
    if (second >= 16 && second <= 31) return false;
  }
  if (ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd")) return false; // IPv6 private
  return true;
}

export type GeoLookup = {
  country: string;
  country_code: string;
  city: string;
  isp: string;
  flag: string;
};

/** Free geolocation via ipwho.is (HTTPS, no key). 12s timeout, safe-fail. */
export async function lookupGeo(ip: string): Promise<GeoLookup | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const d = await res.json();
    if (!d.success && d.success !== undefined) return null;
    return {
      country: d.country ?? "",
      country_code: d.country_code ?? "",
      city: d.city ?? "",
      isp: d.connection?.isp ?? "",
      flag: d.flag?.emoji ?? "",
    };
  } catch {
    return null;
  }
}
