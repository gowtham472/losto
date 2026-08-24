/**
 * A small per-caller budget for the two routes that reach out to other sites.
 *
 * It exists to stop Losto behaving like a scraper if a link is hammered or the
 * deployment is shared, which keeps the app a good neighbour and keeps the
 * operator out of trouble. In-memory, so each server instance keeps its own
 * count - enough for the traffic a personal deployment sees.
 */

interface Bucket {
  tokens: number;
  updated: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

export interface Limit {
  /** Requests allowed per window. */
  capacity: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export const EXTRACT_LIMIT: Limit = { capacity: 30, windowMs: 60_000 };
export const ASSET_LIMIT: Limit = { capacity: 300, windowMs: 60_000 };

export interface LimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function consume(key: string, limit: Limit): LimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key) ?? { tokens: limit.capacity, updated: now };
  // Refill continuously rather than in steps, so a burst does not reset badly.
  const refill = ((now - bucket.updated) / limit.windowMs) * limit.capacity;
  bucket.tokens = Math.min(limit.capacity, bucket.tokens + refill);
  bucket.updated = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    const waitMs = ((1 - bucket.tokens) / limit.capacity) * limit.windowMs;
    return { ok: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)) };
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return { ok: true, remaining: Math.floor(bucket.tokens), retryAfterSeconds: 0 };
}

function sweep(now: number) {
  if (now - lastSweep < 5 * 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.updated > 10 * 60_000) buckets.delete(key);
  }
}

/** Best-effort caller identity behind the usual proxy headers. */
export function callerKey(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "anonymous"
  );
}

export function tooManyRequests(result: LimitResult) {
  return Response.json(
    {
      ok: false,
      code: "rate_limited",
      error: "Too many requests from this device. Give it a moment and try again.",
    },
    {
      status: 429,
      headers: {
        "cache-control": "no-store",
        "retry-after": String(result.retryAfterSeconds),
      },
    },
  );
}
