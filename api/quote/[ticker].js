// ═══════════════════════════════════════════════════════════════
//  VERCEL SERVERLESS — Unified quote endpoint with multi-source
//  fallback. Used by the header tickers (SPY, QQQ, …).
//
//  Cascade: Finnhub → Yahoo (options meta) → CBOE (delayed_quotes).
//  Les fonctions de source vivent dans ../_quoteSources.js (partagées
//  avec le batch ../quotes.js). Response shape (always 200 on success,
//  even if served from fallback):
//    {
//      price, change, changePercent, prevClose, high, low,
//      source: 'finnhub' | 'yahoo' | 'cboe',
//      timestamp: ISO-8601,
//      stale: boolean    // true when derived from delayed/close data
//    }
//  On total failure: 502 with { error, attempts }.
// ═══════════════════════════════════════════════════════════════

import { applyCors } from '../_cors.js';
import { enforceRateLimit } from '../_rateLimit.js';
import { tryFinnhub, tryYahoo, tryCboe, sanitizeSymbol } from '../_quoteSources.js';

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!enforceRateLimit(req, res, { max: 60, windowMs: 60_000, bucket: 'quote' })) return;

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Ticker requis' });

  const symbol = sanitizeSymbol(ticker);
  if (!symbol) return res.status(400).json({ error: 'Ticker invalide' });

  const attempts = [];

  const finnhub = await tryFinnhub(symbol);
  if (finnhub) {
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return res.status(200).json(finnhub);
  }
  attempts.push('finnhub');

  const yahoo = await tryYahoo(symbol);
  if (yahoo) {
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return res.status(200).json(yahoo);
  }
  attempts.push('yahoo');

  const cboe = await tryCboe(symbol);
  if (cboe) {
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(cboe);
  }
  attempts.push('cboe');

  return res.status(502).json({
    error: `Quote indisponible pour ${symbol}`,
    attempts,
  });
}
