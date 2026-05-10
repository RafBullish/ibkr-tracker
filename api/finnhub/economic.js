// ═══════════════════════════════════════════════════════════════
//  VERCEL SERVERLESS — Finnhub economic calendar proxy
//  Query params:
//    from = YYYY-MM-DD (default: today)
//    to   = YYYY-MM-DD (default: today + 60 days)
// ═══════════════════════════════════════════════════════════════

import { applyCors } from '../_cors.js';
import { enforceRateLimit } from '../_rateLimit.js';

const FINNHUB_KEY = process.env.FINNHUB_KEY;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!enforceRateLimit(req, res, { max: 60, windowMs: 60_000, bucket: 'finnhub' })) return;

  if (!FINNHUB_KEY) {
    return res.status(500).json({ error: 'FINNHUB_KEY non configuré côté serveur' });
  }

  const from = DATE_RE.test(req.query.from || '') ? req.query.from : isoDate(0);
  const to = DATE_RE.test(req.query.to || '') ? req.query.to : isoDate(60);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const url = `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${FINNHUB_KEY}`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).json({ error: `Finnhub: ${response.status}` });
    }

    const data = await response.json();
    // Cache 1 hour at edge — macro events publish schedule rarely changes
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=3600');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({
      error: 'Finnhub economic calendar indisponible',
      detail: e.message,
    });
  }
}
