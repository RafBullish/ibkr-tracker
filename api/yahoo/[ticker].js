// ═══════════════════════════════════════════════════════════════
//  Yahoo Finance options chain proxy.
//  Auth (cookie + crumb) lives in ../_yahooAuth.js and is shared
//  with the /api/quote cascade.
// ═══════════════════════════════════════════════════════════════

import { applyCors } from '../_cors.js';
import { enforceRateLimit } from '../_rateLimit.js';
import { fetchYahoo } from '../_yahooAuth.js';

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!enforceRateLimit(req, res, { max: 60, windowMs: 60_000, bucket: 'yahoo' })) return;

  const { ticker, date } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Ticker requis' });

  const symbol = ticker.toUpperCase().replace(/[^A-Z]/g, '');

  try {
    let url = `https://query2.finance.yahoo.com/v7/finance/options/${symbol}`;
    if (date) url += `?date=${date}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetchYahoo(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Yahoo Finance: ${response.status} pour ${symbol}`,
      });
    }

    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({
      error: `Yahoo Finance indisponible pour ${symbol}`,
      detail: e.message,
    });
  }
}
