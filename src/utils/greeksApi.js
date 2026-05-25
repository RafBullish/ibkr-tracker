// ═══════════════════════════════════════════════════════════════
//  GREEKS API — LOCAL Black-Scholes solver (B2, voie A v1)
//
//  Greeks are computed entirely client-side from blackScholes.js. No
//  options chain endpoint is called. Only the underlying SPOT is
//  fetched (Finnhub via /api/quote/[ticker]).
//
//  IV INPUT — "mark-implied", figé à l'import :
//    L'IV est INVERSÉE depuis le mark du contrat tel qu'IBKR Flex
//    l'a exporté (pos.pc, mappé depuis la colonne MarkPrice du CSV).
//    Cette valeur est FIGÉE au moment de l'import — elle ne se met
//    pas à jour en cours de session. Le store ne persiste pas (au
//    moment d'écriture) de timestamp d'import propre, donc la
//    fraîcheur de l'IV ne peut pas être affichée explicitement en v1.
//    Limitation tracée pour B-tard : exposer `lastImportAt` dans
//    settings au moment du merge, et un badge "IV @ import" discret
//    dans l'UI Greeks. Pour v1, le champ `source: 'computed'` signale
//    sans ambiguïté la provenance locale (≠ 'unavailable', ≠ 'bs').
//
//  SOURCES DU CALCUL :
//    - S (spot)   : /api/quote/[underlying] — Finnhub primary (B1).
//    - K (strike) : pos.st (CSV).
//    - T (years)  : (pos.ex − now) / 365.
//    - r          : RISK_FREE_RATE = 0.04 (blackScholes.js).
//    - marketPrice: pos.pc (CSV MarkPrice).
//    - type       : pos.ty (CALL ou PUT).
//    - σ          : bsImpliedVol(...) — Newton-Raphson + fallback
//                   bisection. Retourne null sur OTM-trop-lointain
//                   (vega≈0), mark=0, T<=0, hors bracket no-arbitrage.
//
//  MODE "unavailable" — produit propre par aggregateGreeks consumer :
//    `source: 'unavailable'` quand le calcul ne converge pas ou que
//    l'un des inputs critiques manque (spot, mark, expiry passée).
//    `aggregateGreeks` (greeks.js, sign-aware A3c) skip ces positions
//    sans NaN bleed. Les Greeks ne sont JAMAIS inventés.
// ═══════════════════════════════════════════════════════════════

import { bsGreeks, bsImpliedVol, RISK_FREE_RATE } from './options/blackScholes';

const UNAVAILABLE = Object.freeze({
  delta: null,
  gamma: null,
  theta: null,
  vega: null,
  iv: null,
  spot: null,
  bid: null,
  ask: null,
  source: 'unavailable',
});

// ─── Spot cache + dedup (pattern B1.2 / B1.3) ─────────────────────
//
// FRESH_TTL : skip-if-fresh — un 2e calcul Greeks dans 5 min ne
// retape pas /api/quote. Anti-flash + anti-refetch en session.

const SPOT_CACHE_KEY = 'ibkr_spot_cache_v1';
const SPOT_FRESH_TTL_MS = 5 * 60 * 1000; // 5 min
const SPOT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 h — anti-flash hydratation
const RETRY_AFTER_FALLBACK_MS = 2000;
const RETRY_AFTER_MAX_MS = 15_000;

function loadSpotCache() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SPOT_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const now = Date.now();
    const fresh = {};
    for (const [tk, entry] of Object.entries(parsed)) {
      if (
        entry &&
        Number.isFinite(entry.spot) &&
        Number.isFinite(entry.timestamp) &&
        now - entry.timestamp < SPOT_MAX_AGE_MS
      ) {
        fresh[tk] = entry;
      }
    }
    return fresh;
  } catch {
    return {};
  }
}

function persistSpotCache(cache) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SPOT_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota / disabled — silent */
  }
}

const spotCache = loadSpotCache();
const inflightSpotByTicker = new Map();

function parseRetryAfterMs(header) {
  if (!header) return RETRY_AFTER_FALLBACK_MS;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, RETRY_AFTER_MAX_MS);
  }
  const date = Date.parse(header);
  if (Number.isFinite(date)) {
    return Math.min(Math.max(0, date - Date.now()), RETRY_AFTER_MAX_MS);
  }
  return RETRY_AFTER_FALLBACK_MS;
}

async function rawFetchSpot(ticker) {
  const url = `/api/quote/${encodeURIComponent(ticker)}`;
  let res = await fetch(url);
  if (res.status === 429) {
    const delayMs = parseRetryAfterMs(res.headers.get('Retry-After'));
    await new Promise((r) => setTimeout(r, delayMs));
    res = await fetch(url);
  }
  if (!res.ok) {
    // TEMP B2-PATCH — log the upstream cascade failure so the user can
    // see WHY a particular ticker's spot didn't resolve. Remove together
    // with the snapshot table below.
    console.warn(
      `[B2-PATCH] /api/quote/${ticker} → HTTP ${res.status} (Finnhub→Yahoo→CBOE cascade exhausted)`
    );
    return null;
  }
  let data;
  try {
    data = await res.json();
  } catch {
    console.warn(`[B2-PATCH] /api/quote/${ticker} → invalid JSON body`);
    return null;
  }
  if (!Number.isFinite(data?.price) || !(data.price > 0)) {
    console.warn(
      `[B2-PATCH] /api/quote/${ticker} → 200 OK but price missing/invalid (data: ${JSON.stringify(data)?.slice(0, 200)})`
    );
    return null;
  }
  return data.price;
}

async function fetchSpot(ticker) {
  const existing = inflightSpotByTicker.get(ticker);
  if (existing) return existing;
  const promise = rawFetchSpot(ticker).finally(() => {
    inflightSpotByTicker.delete(ticker);
  });
  inflightSpotByTicker.set(ticker, promise);
  return promise;
}

async function getSpot(ticker) {
  const now = Date.now();
  const cached = spotCache[ticker];
  if (cached && Number.isFinite(cached.spot) && now - cached.timestamp < SPOT_FRESH_TTL_MS) {
    return cached.spot;
  }
  const spot = await fetchSpot(ticker);
  if (Number.isFinite(spot) && spot > 0) {
    spotCache[ticker] = { spot, timestamp: now };
    persistSpotCache(spotCache);
    return spot;
  }
  // Fall back to the stale (>5min, <24h) cache value if we just couldn't
  // refresh — better than failing the whole calculation.
  if (cached && Number.isFinite(cached.spot) && now - cached.timestamp < SPOT_MAX_AGE_MS) {
    return cached.spot;
  }
  return null;
}

// ─── Per-position Greeks compute ──────────────────────────────────

function computeGreeksForPosition(pos, spot) {
  if (!Number.isFinite(spot) || spot <= 0) {
    return { ...UNAVAILABLE };
  }
  const K = parseFloat(pos.st);
  const mark = parseFloat(pos.pc);
  const type = pos.ty === 'PUT' ? 'put' : 'call';

  if (!Number.isFinite(K) || K <= 0) return { ...UNAVAILABLE, spot };
  if (!Number.isFinite(mark) || mark <= 0) return { ...UNAVAILABLE, spot };

  const expiryMs = Date.parse(pos.ex + 'T12:00:00');
  if (!Number.isFinite(expiryMs)) return { ...UNAVAILABLE, spot };
  const T = (expiryMs - Date.now()) / (365 * 86_400_000);
  if (!(T > 0)) return { ...UNAVAILABLE, spot };

  const sigma = bsImpliedVol({
    S: spot,
    K,
    T,
    r: RISK_FREE_RATE,
    marketPrice: mark,
    type,
  });
  if (!Number.isFinite(sigma) || sigma <= 0) {
    return { ...UNAVAILABLE, spot };
  }

  const g = bsGreeks({ S: spot, K, T, r: RISK_FREE_RATE, sigma, type });
  if (!g) return { ...UNAVAILABLE, spot, iv: sigma };

  // Per-share BSM Greeks. theta is per-YEAR, vega per 1.00-sigma — the
  // canonical aggregateGreeks (greeks.js) applies /365 and /100 + sign
  // when summing. Do NOT pre-divide here.
  return {
    delta: g.delta,
    gamma: g.gamma,
    theta: g.theta,
    vega: g.vega,
    iv: sigma,
    spot,
    bid: null,
    ask: null,
    source: 'computed',
  };
}

/**
 * Compute Greeks for all open option positions, locally via Black-Scholes.
 *
 * Signature preserved (positions) → Promise<Map<positionId, greeks>> so
 * upstream consumers (useGreeksAggregate, Positions.jsx, Greeks.jsx) and
 * the downstream aggregator (aggregateGreeks, greeks.js) don't change.
 *
 * Behaviour :
 *   - Stocks and positions missing tk/ty/st/ex are skipped (not in Map).
 *   - One /api/quote per unique underlying (deduplicated, cached 5 min).
 *   - IV inversée du mark CSV (figé à l'import) via Newton-Raphson +
 *     fallback bisection. Returns 'unavailable' when inversion fails.
 *
 * @param {Array<Object>} positions
 * @returns {Promise<Map<string, Object>>}
 */
export async function getGreeksForAllPositions(positions) {
  const result = new Map();
  const list = Array.isArray(positions) ? positions : [];

  // Filter to valid option positions only.
  const options = list.filter(
    (p) => p && p.as === 'Option' && p.tk && p.ty && p.st && p.ex
  );
  if (options.length === 0) return result;

  // Unique underlyings — one /api/quote per underlying, not per position.
  const uniqueTickers = Array.from(new Set(options.map((p) => p.tk)));

  // Fetch spots in parallel. fetchSpot is module-dedup'd : 2 concurrent
  // mounts (StrictMode) share the same in-flight promise.
  const spotEntries = await Promise.all(
    uniqueTickers.map(async (tk) => {
      try {
        return [tk, await getSpot(tk)];
      } catch {
        return [tk, null];
      }
    })
  );
  const spotByTicker = Object.fromEntries(spotEntries);

  for (const pos of options) {
    const greeks = computeGreeksForPosition(pos, spotByTicker[pos.tk]);
    result.set(pos.id, greeks);
  }

  // ── TEMP B2-PATCH instrumentation — REMOVE after CVX/AVGO/XOM ────
  // unavailable cause confirmed. Logs one snapshot per session so the
  // Network tab + console together explain why some positions land in
  // 'unavailable'. Idempotent via __b2pLogged flag.
  if (typeof window !== 'undefined' && !window.__b2pLogged) {
    window.__b2pLogged = true;
    const rows = options.map((p) => {
      const g = result.get(p.id) || {};
      const spot = spotByTicker[p.tk];
      const mark = parseFloat(p.pc);
      const K = parseFloat(p.st);
      const expiryMs = Date.parse((p.ex || '') + 'T12:00:00');
      const T = Number.isFinite(expiryMs)
        ? (expiryMs - Date.now()) / (365 * 86_400_000)
        : null;
      return {
        id: p.id,
        ticker: p.tk,
        type: p.ty,
        strike: K,
        mark,
        expiry: p.ex,
        T_years: T == null ? null : Number(T.toFixed(4)),
        spot,
        spot_status:
          spot == null
            ? 'NULL (quote fetch failed)'
            : !(spot > 0)
              ? 'NOT_POSITIVE'
              : 'OK',
        sigma: g.iv,
        sigma_status:
          g.iv == null
            ? 'NULL (bsImpliedVol failed)'
            : 'OK',
        source: g.source,
      };
    });
    console.group('[B2-PATCH] Greeks compute snapshot');
    console.table(rows);
    console.groupEnd();
  }

  return result;
}

// ─── Test seam ────────────────────────────────────────────────────
// Reset module-scope state between tests (vitest only).
export function __resetGreeksApiForTests() {
  inflightSpotByTicker.clear();
  for (const key of Object.keys(spotCache)) delete spotCache[key];
}
