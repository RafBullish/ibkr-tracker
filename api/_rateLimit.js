// ═══════════════════════════════════════════════════════════════
//  In-memory rate limiter for /api/* endpoints.
//
//  Vercel runs each serverless function in its own short-lived
//  container, so the Map below is per-instance — not a global
//  counter across the fleet. That's intentionally pragmatic:
//    - The only real consumer of this app is the owner.
//    - The goal is to defang accidental loops and casual abuse,
//      not to mount a hardened DoS defense.
//  If we ever need cross-instance state, swap the implementation
//  for @upstash/ratelimit (Redis-backed) without changing callers.
// ═══════════════════════════════════════════════════════════════

const buckets = new Map();
const DEFAULT_MAX = 60;
const DEFAULT_WINDOW_MS = 60_000;

function clientKey(req) {
  // Vercel sets x-forwarded-for to the chain; the leftmost entry is
  // the client. Fall back to the socket remote address for local dev.
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * @param {object} req       - Vercel/Node request.
 * @param {object} [opts]
 * @param {number} [opts.max]       - Max requests per window. Default 60.
 * @param {number} [opts.windowMs]  - Window length in ms. Default 60_000.
 * @param {string} [opts.bucket]    - Optional bucket name to keep
 *                                    different endpoints' counters separate.
 * @returns {{ ok: true } | { ok: false, retryAfter: number, limit: number }}
 */
export function rateLimit(
  req,
  { max = DEFAULT_MAX, windowMs = DEFAULT_WINDOW_MS, bucket = 'default' } = {}
) {
  const key = `${bucket}::${clientKey(req)}`;
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count >= max) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      limit: max,
    };
  }

  entry.count += 1;
  return { ok: true };
}

/**
 * Apply a rate limit and write the standard 429 response if exceeded.
 * Returns true if the caller should continue processing.
 */
export function enforceRateLimit(req, res, opts) {
  const result = rateLimit(req, opts);
  if (result.ok) return true;
  res.setHeader('Retry-After', String(result.retryAfter));
  res.status(429).json({ error: 'Too many requests', retryAfter: result.retryAfter });
  return false;
}

// ───── Test helpers ──────────────────────────────────────────────
// Vitest needs a way to wipe state between tests because the buckets
// Map lives at module scope. Not exported via index.
export function __resetRateLimitForTests() {
  buckets.clear();
}
