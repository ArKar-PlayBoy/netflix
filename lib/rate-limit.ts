type Bucket = { count: number; resetAt: number; lockedUntil?: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  lockoutMs: number = 0
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (bucket && bucket.lockedUntil && bucket.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((bucket.lockedUntil - now) / 1000) };
  }

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count++;
  if (bucket.count > limit) {
    if (lockoutMs > 0) {
      bucket.lockedUntil = now + lockoutMs;
      return { allowed: false, retryAfterSec: Math.ceil(lockoutMs / 1000) };
    }
    return { allowed: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  if (buckets.size > 10000) {
    for (const [k, v] of buckets) {
      if (v.resetAt < now && (!v.lockedUntil || v.lockedUntil < now)) buckets.delete(k);
    }
  }

  return { allowed: true, retryAfterSec: 0 };
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
