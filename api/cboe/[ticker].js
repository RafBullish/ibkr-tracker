import { applyCors } from '../_cors.js';
import { enforceRateLimit } from '../_rateLimit.js';

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!enforceRateLimit(req, res, { max: 30, windowMs: 60_000, bucket: 'cboe' })) return;

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Ticker requis' });

  // Index symbols use the ^XYZ form (e.g. ^SPX) — strip a leading caret
  // before sanitising letters. CBOE's URL prefixes index symbols with an
  // underscore (`_SPX.json`), so we just need a clean A–Z body to drop in.
  const raw = String(ticker).toUpperCase();
  const isIndex = raw.startsWith('^');
  const symbol = (isIndex ? raw.slice(1) : raw).replace(/[^A-Z]/g, '');
  if (!symbol) return res.status(400).json({ error: 'Ticker invalide' });

  // For indices the underscored URL is the correct one and the bare one
  // is guaranteed 404 — don't waste a round-trip there.
  const urls = isIndex
    ? [`https://cdn.cboe.com/api/global/delayed_quotes/options/_${symbol}.json`]
    : [
        `https://cdn.cboe.com/api/global/delayed_quotes/options/${symbol}.json`,
        `https://cdn.cboe.com/api/global/delayed_quotes/options/_${symbol}.json`,
      ];

  // Multiple header strategies in case CBOE blocks certain patterns
  const headerSets = [
    {
      name: 'chrome-desktop',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Referer: 'https://www.cboe.com/',
        Origin: 'https://www.cboe.com',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    },
    {
      name: 'minimal',
      headers: {
        Accept: 'application/json',
      },
    },
    {
      name: 'safari-mobile',
      headers: {
        Accept: '*/*',
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    },
  ];

  const attempts = [];

  for (const url of urls) {
    for (const { name, headers } of headerSets) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timeout);

        const status = response.status;
        const contentType = response.headers.get('content-type') || '';

        attempts.push({ url, headers: name, status, contentType });

        if (response.ok && contentType.includes('json')) {
          const data = await response.json();
          if (data?.data?.options) {
            res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
            return res.status(200).json(data);
          }
          attempts[attempts.length - 1].note = 'JSON OK but no options data';
        } else if (response.ok) {
          const body = await response.text();
          attempts[attempts.length - 1].note =
            `OK but content-type=${contentType}, body[0:100]=${body.slice(0, 100)}`;
        }
      } catch (e) {
        attempts.push({ url, headers: name, error: e.message });
      }

      // If we got a successful attempt for this URL (even with wrong content),
      // don't try other header sets for same URL
      const lastAttempt = attempts[attempts.length - 1];
      if (lastAttempt.status === 200) break;
    }
  }

  return res.status(502).json({
    error: `CBOE indisponible pour ${symbol}`,
    attempts,
    tip: 'Si toutes les tentatives retournent 403, CBOE bloque les IP Vercel (AWS). Une alternative serait nécessaire.',
  });
}
