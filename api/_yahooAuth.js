// ═══════════════════════════════════════════════════════════════
//  Shared Yahoo Finance cookie + crumb auth for /api/* handlers.
//
//  Since ~2023 Yahoo's finance JSON endpoints (both query1 and
//  query2 hosts) require a pair of credentials obtained in two
//  steps:
//    1. GET fc.yahoo.com/   → Set-Cookie (A3, …)
//    2. GET query2.finance.yahoo.com/v1/test/getcrumb  (with cookie)
//       → plain-text crumb token
//  The crumb must then be forwarded with every subsequent request
//  as `?crumb=<token>` AND the cookie as a Cookie header.
//
//  Both /api/yahoo/[ticker] and /api/quote/[ticker] (tryYahoo
//  cascade step) use this helper so the logic lives in exactly
//  one place.
// ═══════════════════════════════════════════════════════════════

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedAuth = null;
let cacheTime = 0;

export function clearYahooAuth() {
  cachedAuth = null;
  cacheTime = 0;
}

export async function getYahooAuth() {
  if (cachedAuth && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cachedAuth;
  }

  // Step 1 — cookie
  const initRes = await fetch('https://fc.yahoo.com/', {
    redirect: 'manual',
    headers: { 'User-Agent': UA },
  });

  const setCookies = initRes.headers.getSetCookie?.() || [];
  const rawCookies =
    setCookies.length > 0
      ? setCookies
      : (initRes.headers.get('set-cookie') || '').split(/,(?=[^ ])/);

  const cookieStr = rawCookies
    .map((c) => c.split(';')[0])
    .filter(Boolean)
    .join('; ');

  if (!cookieStr) throw new Error('Yahoo cookie bootstrap failed');

  // Step 2 — crumb
  const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookieStr },
  });

  if (!crumbRes.ok) throw new Error(`Yahoo crumb request failed: ${crumbRes.status}`);

  const crumb = await crumbRes.text();
  if (!crumb || crumb.includes('<')) throw new Error('Invalid Yahoo crumb response');

  cachedAuth = { cookie: cookieStr, crumb, ua: UA };
  cacheTime = Date.now();
  return cachedAuth;
}

/**
 * fetch() wrapper that injects the current Yahoo cookie + crumb.
 * On 401/403 (expired crumb) it clears the cache and retries once
 * with fresh credentials. Headers passed via init are merged; the
 * helper always sets User-Agent and Cookie.
 */
export async function fetchYahoo(url, init = {}, { _retried = false } = {}) {
  const auth = await getYahooAuth();
  const sep = url.includes('?') ? '&' : '?';
  const authUrl = `${url}${sep}crumb=${encodeURIComponent(auth.crumb)}`;

  const response = await fetch(authUrl, {
    ...init,
    headers: {
      ...(init.headers || {}),
      'User-Agent': auth.ua,
      Cookie: auth.cookie,
    },
  });

  if ((response.status === 401 || response.status === 403) && !_retried) {
    clearYahooAuth();
    return fetchYahoo(url, init, { _retried: true });
  }
  return response;
}
