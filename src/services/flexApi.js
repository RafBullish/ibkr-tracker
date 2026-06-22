// ═══════════════════════════════════════════════════════════════
//  Flex Web Service API
//  Calls Vercel serverless proxy /api/flex/sync to fetch IBKR data
//
//  Storage split:
//    - queryId  → localStorage (not sensitive, auto-populated each session)
//    - token    → sessionStorage (cleared when tab closes, reduces XSS window)
//
//  Any XSS can still read sessionStorage from the same tab, but at least a
//  stolen token doesn't persist across restarts for the attacker's bot to pick
//  up later.
// ═══════════════════════════════════════════════════════════════

const QUERY_KEY = 'ibkr_flex_queryid';
const TOKEN_KEY = 'ibkr_flex_token';
// Legacy key retained for one-shot migration — older versions wrote both fields.
const LEGACY_KEY = 'ibkr_flex_config';

function migrateLegacyIfPresent() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const cfg = JSON.parse(raw);
    if (cfg?.queryId && !localStorage.getItem(QUERY_KEY)) {
      localStorage.setItem(QUERY_KEY, cfg.queryId);
    }
    if (cfg?.token && !sessionStorage.getItem(TOKEN_KEY)) {
      sessionStorage.setItem(TOKEN_KEY, cfg.token);
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* corrupted legacy blob — ignore */
  }
}
migrateLegacyIfPresent();

/** Save Flex token (session-scoped) + query ID (persistent). */
export function configureFlex(token, queryId) {
  if (queryId) localStorage.setItem(QUERY_KEY, queryId);
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  return Promise.resolve({ configured: true });
}

/** Get stored config — token only present if the tab was used this session. */
export function getFlexConfig() {
  return {
    token: sessionStorage.getItem(TOKEN_KEY) || '',
    queryId: localStorage.getItem(QUERY_KEY) || '',
  };
}

/**
 * Call Vercel proxy to fetch Flex CSV from IBKR.
 * Credentials travel in custom headers (not the body) so they don't end up
 * in any cached request payloads or proxy access logs that record bodies.
 * Returns the raw CSV string.
 */
export async function syncFlex(token, queryId) {
  const res = await fetch('/api/flex/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-IBKR-Flex-Token': token,
      'X-IBKR-Flex-Query-Id': queryId,
    },
    body: '{}',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.csv;
}
