// ═══════════════════════════════════════════════════════════════
//  VERCEL SERVERLESS — Finnhub health probe
//  Source-of-truth endpoint consumed by both /settings/api and
//  /insights/calendar so the two pages can never diverge.
//
//  Response (200 OK in every path — the client reads `ok`):
//    { ok: boolean, reason: string|null, latency: number|null,
//      checkedAt: ISO-8601 string }
// ═══════════════════════════════════════════════════════════════

import { applyCors } from '../_cors.js';
import { enforceRateLimit } from '../_rateLimit.js';

const FINNHUB_KEY = process.env.FINNHUB_KEY;

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!enforceRateLimit(req, res, { max: 60, windowMs: 60_000, bucket: 'health' })) return;

  const checkedAt = new Date().toISOString();
  const t0 = Date.now();

  if (!FINNHUB_KEY) {
    return res.status(200).json({
      ok: false,
      reason: 'FINNHUB_KEY non configurée côté serveur',
      latency: null,
      checkedAt,
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    // SPY quote is the cheapest low-latency endpoint that exercises the full
    // auth path — a 401 here tells us the key is stale.
    const url = `https://finnhub.io/api/v1/quote?symbol=SPY&token=${FINNHUB_KEY}`;
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const latency = Date.now() - t0;

    if (!r.ok) {
      return res.status(200).json({
        ok: false,
        reason: `Finnhub HTTP ${r.status}`,
        latency,
        checkedAt,
      });
    }

    const body = await r.json();
    if (!body || body.c == null) {
      return res.status(200).json({
        ok: false,
        reason: 'Réponse Finnhub invalide',
        latency,
        checkedAt,
      });
    }

    // 60 s edge cache — keeps latency low for repeat polls while still
    // refreshing often enough to catch outages.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60');
    return res.status(200).json({ ok: true, reason: null, latency, checkedAt });
  } catch (e) {
    return res.status(200).json({
      ok: false,
      reason: e?.name === 'AbortError' ? 'Finnhub timeout' : e?.message || 'Erreur réseau',
      latency: Date.now() - t0,
      checkedAt,
    });
  }
}
