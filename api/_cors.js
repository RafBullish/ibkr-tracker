// ═══════════════════════════════════════════════════════════════
//  Shared CORS helper for all /api/* serverless functions.
//
//  Allowlist (production):
//    1. ALLOWED_ORIGINS (comma-separated, explicit)
//    2. https://${VERCEL_URL} (Vercel preview / branch deployments)
//
//  Allowlist (development, NODE_ENV !== 'production'):
//    - http://localhost:5173 (Vite dev server)
//    - http://localhost:3000 (Next-style dev server)
//
//  Same-origin requests (Origin header absent) are always allowed.
//
//  No permissive fallback: if ALLOWED_ORIGINS and VERCEL_URL are
//  both empty in production, every cross-origin request is refused.
// ═══════════════════════════════════════════════════════════════

const isProd = process.env.NODE_ENV === 'production';

function buildAllowlist() {
  const list = [];
  if (isProd) {
    const explicit = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.startsWith('http') ? s : `https://${s}`));
    list.push(...explicit);
    if (process.env.VERCEL_URL) {
      const vercel = process.env.VERCEL_URL.startsWith('http')
        ? process.env.VERCEL_URL
        : `https://${process.env.VERCEL_URL}`;
      list.push(vercel);
    }
  } else {
    list.push('http://localhost:5173', 'http://localhost:3000');
  }
  return list;
}

const allowlist = buildAllowlist();

/**
 * Apply CORS headers, or reject if the origin is not allowlisted.
 * Returns true if the request is allowed to continue, false if rejected.
 */
export function applyCors(req, res, { methods = 'GET, OPTIONS', headers = 'Content-Type' } = {}) {
  const origin = req.headers.origin || '';

  // Same-origin or non-browser request — no Origin header to validate.
  if (!origin) {
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', headers);
    return true;
  }

  if (!allowlist.includes(origin)) {
    if (isProd) {
      // Audit log — origin is attacker-controlled but we want a record.
      console.warn(`[cors] rejected origin: ${origin}`);
    }
    res.status(403).json({ error: 'Origin not allowed' });
    return false;
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', headers);
  return true;
}
