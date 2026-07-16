// ═══════════════════════════════════════════════════════════════
//  useMarketSparklines — hero strip 7-day sparklines (B1.2)
//
//  Polling séparé de useMarketQuotes : cadence 5 min (data 7-j change
//  peu en intra-day), cache localStorage `ibkr_market_sparklines_v1`
//  (TTL 24 h = anti-flash au reload).
//
//  Pour chaque symbol, fetch `/api/chart/[ticker]?range=7d&interval=1d`
//  (proxy Yahoo chart). Retourne `{ sparklines: { [symbol]: { prices,
//  timestamp } }, errors: { [symbol]: string } }`.
//
//  B1-FIX (2026-05) — éliminations 429 :
//    - FRESH_TTL_MS (5 min) : skip-if-fresh avant chaque fetch. Le 2e
//      reload dans 5 min ne déclenche aucun appel /api/chart (la donnée
//      cachée est servie). CACHE_MAX_AGE_MS (24 h) reste pour la
//      réhydratation anti-flash au reload après plusieurs heures.
//    - Dedup module-scope (`inflightBySymbol`) : 2 montages StrictMode
//      en dev partagent la même Promise par symbol → un seul fetch
//      par ticker même si N hooks le demandent simultanément.
//    - Backoff 429 : lit `Retry-After`, retry une fois après ce délai.
//      Si le 2e échoue, marque l'erreur (dégradé propre, pas de boucle).
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';

const CACHE_KEY = 'ibkr_market_sparklines_v1';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 h — anti-flash réhydratation
const FRESH_TTL_MS = 5 * 60 * 1000; // 5 min — anti-refetch en session
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 min — aligné sur FRESH_TTL
const INTER_FETCH_DELAY_MS = 250; // espacement inter-call pour éviter burst
const RETRY_AFTER_FALLBACK_MS = 2000;
const RETRY_AFTER_MAX_MS = 15_000; // cap defensif si le serveur envoie un très grand délai

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const now = Date.now();
    const fresh = {};
    Object.entries(parsed).forEach(([symbol, entry]) => {
      if (entry && typeof entry.timestamp === 'number' && now - entry.timestamp < CACHE_MAX_AGE_MS) {
        fresh[symbol] = entry;
      }
    });
    return fresh;
  } catch {
    return {};
  }
}

function persistCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota / disabled — silent */
  }
}

// ─── B1.3 — Module-scope in-flight dedup ──────────────────────────
//
// Map<symbol, Promise<chartResponse>>. Si N consommateurs (ou 2 instances
// StrictMode du même hook) demandent le même symbole AVANT que le 1er
// fetch soit résolu, ils partagent la même Promise → 1 seul appel réseau
// pour ce symbole. La map est nettoyée à la résolution / rejet (finally).
//
// Vit au module-scope volontairement : un useRef serait local à
// l'instance et ne partagerait rien entre les 2 montages StrictMode.
const inflightBySymbol = new Map();

function parseRetryAfterMs(header) {
  if (!header) return RETRY_AFTER_FALLBACK_MS;
  // RFC 7231 : Retry-After peut être un entier (secondes) ou une date HTTP.
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

async function rawFetchSparkline(symbol, range = '7d', interval = '1d') {
  const url = `/api/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  let res = await fetch(url);

  // ─── B1.4 — Backoff 429 (one retry only) ──────────────────────────
  // Si on tape le rate limiter malgré tout (cache miss en burst,
  // edge cache pas encore peuplé, etc.), on respecte le Retry-After
  // et on retry UNE seule fois. Pas de boucle infinie.
  if (res.status === 429) {
    const delayMs = parseRetryAfterMs(res.headers.get('Retry-After'));
    await new Promise((r) => setTimeout(r, delayMs));
    res = await fetch(url);
  }

  if (!res.ok) throw new Error(`chart fetch ${symbol}: ${res.status}`);
  return res.json();
}

// Clé de cache : le couple range/interval par défaut garde la clé nue
// (rétro-compat avec le cache existant du tape) ; toute autre série est
// suffixée pour ne JAMAIS entrer en collision avec la série 7 j.
function cacheKeyFor(symbol, range, interval) {
  return range === '7d' && interval === '1d' ? symbol : `${symbol}|${range}|${interval}`;
}

async function fetchSparkline(symbol, range = '7d', interval = '1d') {
  const key = cacheKeyFor(symbol, range, interval);
  const existing = inflightBySymbol.get(key);
  if (existing) return existing;
  const promise = rawFetchSparkline(symbol, range, interval).finally(() => {
    inflightBySymbol.delete(key);
  });
  inflightBySymbol.set(key, promise);
  return promise;
}

// ─── 1.C — Poller partagé module-scope (pattern useMarketQuotes) ──
// N consommateurs avec la MÊME liste (TickerTape + MarketDeck)
// partagent UNE boucle : un seul setInterval, un seul train
// /api/chart, un seul cacheRef (le skip-if-fresh reste cohérent
// entre instances). API du hook inchangée.
const sparkPollers = new Map();

function createSparkPoller(symbols, range = '7d', interval = '1d') {
  // Expose les séries PAR SYMBOLE (le range/interval est porté par le
  // poller) ; le cache localStorage, lui, est suffixé par série.
  const exposeFromCache = (cache) => {
    const out = {};
    for (const symbol of symbols || []) {
      const entry = cache[cacheKeyFor(symbol, range, interval)];
      if (entry) out[symbol] = entry;
    }
    return out;
  };

  const poller = {
    refCount: 0,
    timer: null,
    inFlight: false,
    hasInitialFetched: false,
    cache: loadCache(),
    subscribers: new Set(),
  };
  poller.state = { sparklines: exposeFromCache(poller.cache), errors: {} };

  const notify = () => {
    for (const cb of poller.subscribers) cb(poller.state);
  };

  const fetchAll = async () => {
    if (poller.inFlight) return;
    if (!symbols || symbols.length === 0) return;
    if (
      poller.hasInitialFetched &&
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    ) {
      return;
    }

    poller.inFlight = true;
    const next = { ...poller.cache };
    const nextErrors = {};
    const now = Date.now();

    try {
      for (const symbol of symbols) {
        const cacheKey = cacheKeyFor(symbol, range, interval);
        // ─── B1.2 — Skip si cache frais (FRESH_TTL 5 min) ─────────
        const cached = poller.cache[cacheKey];
        if (cached && typeof cached.timestamp === 'number' && now - cached.timestamp < FRESH_TTL_MS) {
          continue;
        }
        try {
          const data = await fetchSparkline(symbol, range, interval);
          next[cacheKey] = {
            prices: data.prices || [],
            timestamp: data.timestamp || Date.now(),
          };
        } catch (err) {
          console.warn(`[useMarketSparklines] fetch failed for ${symbol}:`, err.message);
          nextErrors[symbol] = err.message;
          // conserve l'ancien cache si présent
        }
        await new Promise((r) => setTimeout(r, INTER_FETCH_DELAY_MS));
      }
      poller.cache = next;
      persistCache(next);
      poller.state = { sparklines: exposeFromCache(next), errors: nextErrors };
      notify();
    } finally {
      poller.inFlight = false;
      poller.hasInitialFetched = true;
    }
  };

  const onVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      fetchAll();
    }
  };

  poller.start = () => {
    fetchAll();
    poller.timer = setInterval(fetchAll, POLL_INTERVAL_MS);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
  };

  poller.stop = () => {
    if (poller.timer) clearInterval(poller.timer);
    poller.timer = null;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };

  return poller;
}

export function useMarketSparklines(symbols, range = '7d', interval = '1d') {
  // Clé stable pour les deps : évite de refetch quand l'array reference
  // change mais le contenu non (cf. pattern useMarketQuotes).
  // Le couple range/interval fait partie de l'identité du poller : deux
  // séries du même symbole (7j/1d du tape, 1d/5m des tuiles) coexistent
  // sans se marcher dessus.
  const symbolsKey = (symbols || []).join('|');
  const pollerKey = `${symbolsKey}::${range}::${interval}`;

  const [state, setState] = useState(() => {
    const existing = sparkPollers.get(pollerKey);
    if (existing) return existing.state;
    // Réhydratation anti-flash (B1.2) conservée, par clé de série.
    const cache = loadCache();
    const sparklines = {};
    for (const s of symbols || []) {
      const entry = cache[cacheKeyFor(s, range, interval)];
      if (entry) sparklines[s] = entry;
    }
    return { sparklines, errors: {} };
  });

  useEffect(() => {
    let poller = sparkPollers.get(pollerKey);
    if (!poller) {
      poller = createSparkPoller(symbolsKey ? symbolsKey.split('|') : [], range, interval);
      sparkPollers.set(pollerKey, poller);
    }
    poller.subscribers.add(setState);
    poller.refCount += 1;
    setState(poller.state);
    if (poller.refCount === 1) poller.start();

    return () => {
      poller.subscribers.delete(setState);
      poller.refCount -= 1;
      if (poller.refCount === 0) {
        poller.stop();
        sparkPollers.delete(pollerKey);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollerKey]);

  return state;
}
