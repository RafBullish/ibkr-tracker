// ═══════════════════════════════════════════════════════════════
//  SOURCES DE QUOTE — cascade partagée (Finnhub → Yahoo → CBOE).
//
//  Factorisé pour être consommé par DEUX routes :
//    • api/quote/[ticker].js  — une quote (compat historique)
//    • api/quotes.js          — batch (1 requête client → N amont)
//
//  Chaque `try*` renvoie la forme unifiée { price, change,
//  changePercent, prevClose, high, low, source, timestamp, stale }
//  ou null. `resolveQuote` enchaîne la cascade et renvoie la
//  première source vivante (ou null si toutes tombent).
// ═══════════════════════════════════════════════════════════════

import { fetchYahoo } from './_yahooAuth.js';

const FINNHUB_KEY = process.env.FINNHUB_KEY;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/** Normalise un symbole entrant (majuscules + charset broker/indice). */
export function sanitizeSymbol(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9.^=-]/g, '');
}

export async function tryFinnhub(symbol) {
  if (!FINNHUB_KEY) return null;
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 4000);
  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`,
      { signal: controller.signal }
    );
    clearTimeout(to);
    if (!r.ok) return null;
    const data = await r.json();
    if (!data || data.c == null || data.c === 0) return null;
    return {
      price: data.c,
      change: data.d,
      changePercent: data.dp,
      prevClose: data.pc,
      high: data.h,
      low: data.l,
      source: 'finnhub',
      timestamp: new Date((data.t || Date.now() / 1000) * 1000).toISOString(),
      stale: false,
    };
  } catch {
    clearTimeout(to);
    return null;
  }
}

export async function tryYahoo(symbol) {
  const controller = new AbortController();
  // 6 s leaves room for the cookie+crumb bootstrap on a cold cache
  // (one extra round-trip to fc.yahoo.com + getcrumb).
  const to = setTimeout(() => controller.abort(), 6000);
  try {
    // query2 is the authenticated host that accepts a crumb token;
    // the options endpoint's `meta.quote` carries a live quote for
    // both equities and indices (^GSPC, ^NDX, ^DJI) and crypto
    // (BTC-USD) even when the chain itself is empty.
    const r = await fetchYahoo(
      `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(symbol)}`,
      { headers: { Accept: 'application/json' }, signal: controller.signal }
    );
    clearTimeout(to);
    if (!r.ok) return null;
    const data = await r.json();
    const meta = data?.optionChain?.result?.[0]?.quote;
    if (!meta || meta.regularMarketPrice == null) return null;
    const price = meta.regularMarketPrice;
    const change = meta.regularMarketChange ?? 0;
    const pct =
      meta.regularMarketChangePercent ??
      (meta.regularMarketPreviousClose ? (change / meta.regularMarketPreviousClose) * 100 : 0);
    return {
      price,
      change,
      changePercent: pct,
      prevClose: meta.regularMarketPreviousClose ?? null,
      high: meta.regularMarketDayHigh ?? null,
      low: meta.regularMarketDayLow ?? null,
      source: 'yahoo',
      timestamp: new Date(
        (meta.regularMarketTime || Math.floor(Date.now() / 1000)) * 1000
      ).toISOString(),
      stale: false,
    };
  } catch {
    clearTimeout(to);
    return null;
  }
}

export async function tryCboe(symbol) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch(
      `https://cdn.cboe.com/api/global/delayed_quotes/options/${encodeURIComponent(symbol)}.json`,
      {
        headers: {
          Accept: 'application/json, text/plain, */*',
          'User-Agent': UA,
          Referer: 'https://www.cboe.com/',
          Origin: 'https://www.cboe.com',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(to);
    if (!r.ok) return null;
    const data = await r.json();
    const d = data?.data;
    if (!d || d.close == null) return null;
    const price = d.last ?? d.close;
    const prev = d.prev_day_close ?? d.close;
    const change = prev ? price - prev : 0;
    const pct = prev ? (change / prev) * 100 : 0;
    return {
      price,
      change,
      changePercent: pct,
      prevClose: prev,
      high: d.high ?? null,
      low: d.low ?? null,
      source: 'cboe',
      timestamp: new Date().toISOString(),
      stale: true, // CBOE delayed_quotes are ~15 min delayed
    };
  } catch {
    clearTimeout(to);
    return null;
  }
}

/**
 * Cascade complète pour un symbole : renvoie la première source
 * vivante, sinon null. `cacheHint` indique la fraîcheur maximale
 * cacheable (30 s live, 300 s si servi depuis le délai CBOE).
 */
export async function resolveQuote(symbol) {
  const finnhub = await tryFinnhub(symbol);
  if (finnhub) return finnhub;
  const yahoo = await tryYahoo(symbol);
  if (yahoo) return yahoo;
  const cboe = await tryCboe(symbol);
  if (cboe) return cboe;
  return null;
}
