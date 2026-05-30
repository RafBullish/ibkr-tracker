// ═══════════════════════════════════════════════════════════════
//  GREEKS API — LOCAL Black-Scholes solver + cascade IV
//
//  Greeks are computed entirely client-side. Le calcul délégué à
//  `positionGreeks` (utils/positionGreeks.js) qui applique la cascade
//  σ (mark → chain cache → 0.30 default). Cette refonte fait passer
//  le taux de couverture de 2/5 à 5/5 sur les positions du compte :
//  les marks ITM stales (CVX/AVGO/XOM exemple-type) ne sortent plus
//  rien — ils sont marqués `source: 'default'` + `ivEstimated: true`
//  et propagent à l'UI un badge discret.
//
//  SOURCES DU CALCUL :
//    - S (spot)   : /api/quote/[underlying] — Finnhub primary (B1).
//    - K (strike) : pos.st (CSV).
//    - T (years)  : (pos.ex − now) / 365.
//    - r          : RISK_FREE_RATE = 0.04 (taux unique repo).
//    - σ          : cascade positionGreeks (a)→(b)→(c).
//
//  DEDUP / MEMO :
//    Trois callsites consomment getGreeksForAllPositions (Greeks
//    page, Positions page, useGreeksAggregate). Le résultat est
//    memoizé par identité des positions (id+pc+st+ex+ty+ct+dir)
//    avec TTL 30 s. Concurrents partagent l'inflight promise.
//    Source unique de vérité pour les 3 consumers + l'agrégateur.
// ═══════════════════════════════════════════════════════════════

import { positionGreeks, readChainIvCache } from './positionGreeks';

const UNAVAILABLE = Object.freeze({
  delta: null,
  gamma: null,
  theta: null,
  vega: null,
  iv: null,
  sigma: null,
  spot: null,
  bid: null,
  ask: null,
  ivEstimated: false,
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
  if (!res.ok) return null;
  let data;
  try {
    data = await res.json();
  } catch {
    return null;
  }
  return Number.isFinite(data?.price) && data.price > 0 ? data.price : null;
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

function computeGreeksForPosition(pos, spot, chainIv) {
  if (!Number.isFinite(spot) || spot <= 0) {
    return { ...UNAVAILABLE };
  }

  const g = positionGreeks(pos, { spot, chainIv });
  if (!g) return { ...UNAVAILABLE, spot };

  return {
    delta: g.delta,
    gamma: g.gamma,
    theta: g.theta,
    vega: g.vega,
    iv: g.iv,
    sigma: g.sigma,
    spot: g.spot,
    bid: null,
    ask: null,
    ivEstimated: g.ivEstimated,
    source: g.source, // 'mark' | 'chain' | 'default'
  };
}

// ─── Map-level memo (single-source-of-truth) ──────────────────────
//
// 3 React callsites peuvent appeler getGreeksForAllPositions à la
// même tick (Greeks page, Positions page, useGreeksAggregate). On
// dedup via clé sur identité des positions + TTL 30 s. Les concurrents
// partagent l'inflight promise.

const MEMO_TTL_MS = 30_000;
let _memo = { key: null, map: null, timestamp: 0, inflight: null, inflightKey: null };

function positionsKey(list) {
  return list
    .filter((p) => p && p.as === 'Option')
    .map((p) => `${p.id}:${p.tk}:${p.ty}:${p.st}:${p.ex}:${p.pc}:${p.ct}:${p.dir}`)
    .join('|');
}

/**
 * Permet à Chain.jsx d'invalider la memo après écriture du cache
 * chainIv, pour que les fallbacks (b) prennent effet immédiatement.
 */
export function invalidateGreeksMemo() {
  _memo = { key: null, map: null, timestamp: 0, inflight: null, inflightKey: null };
}

async function computeGreeksMap(options) {
  const result = new Map();
  if (options.length === 0) return result;

  const uniqueTickers = Array.from(new Set(options.map((p) => p.tk)));
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

  // Chain IV cache lookup, one read per underlying (cheap localStorage).
  const chainIvByTicker = {};
  for (const tk of uniqueTickers) {
    chainIvByTicker[tk] = readChainIvCache(tk);
  }

  for (const pos of options) {
    result.set(pos.id, computeGreeksForPosition(pos, spotByTicker[pos.tk], chainIvByTicker[pos.tk]));
  }
  return result;
}

/**
 * Compute Greeks for all open option positions, locally via Black-Scholes.
 *
 * Cascade σ (a) mark → (b) chainIv cache → (c) 0.30 default. Toutes les
 * positions option valides obtiennent un greeks ; flag `ivEstimated:true`
 * + `source:'default'` quand la cascade tombe sur (c).
 *
 * Signature préservée (positions) → Promise<Map<positionId, greeks>> pour
 * que les consumers existants (useGreeksAggregate, Positions.jsx,
 * Greeks.jsx) marchent transparently. Plus de fallback `unavailable`
 * silencieux pour les marks ITM stales — seul cas restant : spot KO
 * (réseau down) ou contrat inexploitable (expiry < now, strike absent).
 *
 * @param {Array<Object>} positions
 * @returns {Promise<Map<string, Object>>}
 */
export async function getGreeksForAllPositions(positions) {
  const list = Array.isArray(positions) ? positions : [];
  const options = list.filter((p) => p && p.as === 'Option' && p.tk && p.ty && p.st && p.ex);
  if (options.length === 0) return new Map();

  const key = positionsKey(options);
  const now = Date.now();

  // Synchronous cache hit.
  if (_memo.key === key && _memo.map && now - _memo.timestamp < MEMO_TTL_MS) {
    return _memo.map;
  }

  // In-flight dedup for concurrent callers.
  if (_memo.inflightKey === key && _memo.inflight) return _memo.inflight;

  _memo.inflightKey = key;
  _memo.inflight = (async () => {
    const map = await computeGreeksMap(options);
    if (_memo.inflightKey === key) {
      _memo.key = key;
      _memo.map = map;
      _memo.timestamp = Date.now();
      _memo.inflight = null;
      _memo.inflightKey = null;
    }
    return map;
  })();

  return _memo.inflight;
}

// ─── Test seam ────────────────────────────────────────────────────
// Reset module-scope state between tests (vitest only).
export function __resetGreeksApiForTests() {
  inflightSpotByTicker.clear();
  for (const key of Object.keys(spotCache)) delete spotCache[key];
  invalidateGreeksMemo();
}
