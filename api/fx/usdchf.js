// ═══════════════════════════════════════════════════════════════
//  VERCEL SERVERLESS — USD/CHF FX rate proxy
//  Primary: Twelve Data (requires TWELVE_DATA_KEY server-side)
//  Fallback: Frankfurter (ECB daily, no key)
// ═══════════════════════════════════════════════════════════════

import { applyCors } from '../_cors.js';
import { enforceRateLimit } from '../_rateLimit.js';

const TWELVE_DATA_KEY = process.env.TWELVE_DATA_KEY;

async function fromTwelveData() {
  if (!TWELVE_DATA_KEY) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://api.twelvedata.com/price?symbol=USD/CHF&apikey=${TWELVE_DATA_KEY}`;
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) return null;
    const data = await r.json();
    const rate = parseFloat(data?.price);
    if (!rate || rate <= 0) return null;
    return { rate, source: 'Twelve Data', fetchedAt: new Date().toISOString() };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fromFrankfurter() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch('https://api.frankfurter.app/latest?from=USD&to=CHF', {
      signal: controller.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const rate = data?.rates?.CHF;
    if (!rate || rate <= 0) throw new Error('Unexpected format');
    return { rate, source: 'BCE (daily)', fetchedAt: new Date().toISOString() };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!enforceRateLimit(req, res, { max: 30, windowMs: 60_000, bucket: 'fx' })) return;

  try {
    const primary = await fromTwelveData();
    if (primary) {
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=60');
      return res.status(200).json(primary);
    }
    const fallback = await fromFrankfurter();
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=3600');
    return res.status(200).json(fallback);
  } catch (e) {
    return res.status(502).json({ error: 'FX rate unavailable', detail: e.message });
  }
}
