// ═══════════════════════════════════════════════════════════════
//  VERCEL SERVERLESS — Yahoo Finance chart proxy (B1.2)
//  GET /api/chart/[ticker]?range=7d&interval=1d
//
//  Used by useMarketSparklines (hero strip 7-day sparklines).
//
//  Response shape (always 200 on success) :
//    {
//      symbol:    string     (resolved + sanitized)
//      prices:    number[]   (closes, NaN/null filtered, oldest→newest)
//      timestamp: number     (Date.now() at fetch time, ms)
//    }
//  On total failure: 502 with { error, detail }.
//
//  Cache-Control : s-maxage=300 stale-while-revalidate=600 — la 7-day
//  window ne change intra-day qu'au close, donc 5 min CDN cache est
//  généreux et safe.
//
//  Rate limit : bucket 'chart', max 90/min — séparé du bucket 'quote'
//  (les deux buckets sont DISJOINTS dans _rateLimit.js, clé
//  `bucket::ip` distincte — augmenter chart n'affecte PAS le budget
//  de quote). 90/min couvre ~15 tickers × 2 instances StrictMode dev +
//  marge pour visibility refetch et remounts. B1 audit (2026-05) a
//  identifié 30 comme la cause principale du 429 chronique.
// ═══════════════════════════════════════════════════════════════

import { applyCors } from '../_cors.js';
import { enforceRateLimit } from '../_rateLimit.js';
import { fetchYahoo } from '../_yahooAuth.js';

const FETCH_TIMEOUT_MS = 8000;
const isProd = process.env.NODE_ENV === 'production';

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!enforceRateLimit(req, res, { max: 90, windowMs: 60_000, bucket: 'chart' })) return;

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Ticker requis' });

  // Même whitelist de caractères que /api/quote (A-Z0-9 + . ^ = -)
  const symbol = String(ticker)
    .toUpperCase()
    .replace(/[^A-Z0-9.^=-]/g, '');
  if (!symbol) return res.status(400).json({ error: 'Ticker invalide' });

  // Range / interval whitelisté (alphanum only) avec défauts spec B1.2.
  const range = String(req.query.range || '7d').replace(/[^a-z0-9]/gi, '');
  const interval = String(req.query.interval || '1d').replace(/[^a-z0-9]/gi, '');

  const url =
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${range}&interval=${interval}&includePrePost=false`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const yRes = await fetchYahoo(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!yRes.ok) {
      // 401 propagé tel quel (le _yahooAuth tentera de re-bootstrap au prochain call).
      const status = yRes.status === 401 ? 401 : 502;
      return res.status(status).json({
        error: `Yahoo chart ${yRes.status} pour ${symbol}`,
      });
    }

    const data = await yRes.json();
    const result = data?.chart?.result?.[0];
    const closes = result?.indicators?.quote?.[0]?.close;
    if (!Array.isArray(closes) || closes.length === 0) {
      return res.status(502).json({ error: `Yahoo chart vide pour ${symbol}` });
    }

    // Filtre les bougies sans close (jours fériés, opens incomplets, etc.).
    const prices = closes.filter((v) => Number.isFinite(v));
    if (prices.length === 0) {
      return res.status(502).json({ error: `Yahoo chart sans valeurs pour ${symbol}` });
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ symbol, prices, timestamp: Date.now() });
  } catch (e) {
    clearTimeout(timeoutId);
    if (!isProd) console.error(`[chart/${symbol}] error:`, e);
    return res.status(502).json({
      error: `Yahoo chart indisponible pour ${symbol}`,
      detail: e?.message || String(e),
    });
  }
}
