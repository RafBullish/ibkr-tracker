// ═══════════════════════════════════════════════════════════════
//  CALENDAR API
//  Earnings + Economic calendars via Finnhub (/api/finnhub proxies)
//  Results cached in sessionStorage for 1 hour to spare rate limits.
// ═══════════════════════════════════════════════════════════════

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const CACHE_PREFIX = 'ibkr_cal_';

function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function cacheSet(key, data) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    /* quota exceeded — ignore */
  }
}

/**
 * Fetch earnings calendar between two YYYY-MM-DD dates.
 * Returns: [{ date, symbol, epsActual, epsEstimate, hour, quarter, year,
 *             revenueActual, revenueEstimate }]
 * `hour` is 'bmo' (before market open), 'amc' (after market close), or ''.
 */
export async function fetchEarningsCalendar(from, to, { symbol = '' } = {}) {
  const key = `earn_${from}_${to}_${symbol}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const params = new URLSearchParams({ from, to });
  if (symbol) params.set('symbol', symbol);

  const response = await fetch(`/api/finnhub/earnings?${params}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  const data = await response.json();
  const list = Array.isArray(data?.earningsCalendar) ? data.earningsCalendar : [];
  cacheSet(key, list);
  return list;
}

/**
 * Fetch economic calendar between two YYYY-MM-DD dates.
 * Returns: [{ time, country, event, impact, actual, estimate, prev, unit }]
 * `impact` is 'low' | 'medium' | 'high'.
 */
export async function fetchEconomicCalendar(from, to) {
  const key = `econ_${from}_${to}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const params = new URLSearchParams({ from, to });
  const response = await fetch(`/api/finnhub/economic?${params}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  const data = await response.json();
  const list = Array.isArray(data?.economicCalendar) ? data.economicCalendar : [];
  cacheSet(key, list);
  return list;
}

/**
 * Clear cached calendar payloads (useful for a manual refresh button).
 */
export function clearCalendarCache() {
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
