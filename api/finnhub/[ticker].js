// ═══════════════════════════════════════════════════════════════
//  VERCEL SERVERLESS — Finnhub stock quote proxy
//  Keeps FINNHUB_KEY server-side (never shipped to the client bundle)
// ═══════════════════════════════════════════════════════════════

import { applyCors } from '../_cors.js';
import { enforceRateLimit } from '../_rateLimit.js';

const FINNHUB_KEY = process.env.FINNHUB_KEY;

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!enforceRateLimit(req, res, { max: 60, windowMs: 60_000, bucket: 'finnhub' })) return;

  if (!FINNHUB_KEY) {
    return res.status(500).json({ error: 'FINNHUB_KEY non configuré côté serveur' });
  }

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Ticker requis' });

  const symbol = String(ticker)
    .toUpperCase()
    .replace(/[^A-Z.-]/g, '');
  if (!symbol) return res.status(400).json({ error: 'Ticker invalide' });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).json({ error: `Finnhub: ${response.status}` });
    }

    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=30');
    return res.status(200).json(data);
  } catch (e) {
    return res
      .status(502)
      .json({ error: `Finnhub indisponible pour ${symbol}`, detail: e.message });
  }
}
