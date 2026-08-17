// ═══════════════════════════════════════════════════════════════
//  STOCK PRICE API
//  Source cascade (server-side): Finnhub → Yahoo → CBOE via
//  /api/quote/[ticker]. The server always returns the unified shape
//  documented below, so the client never has to branch on source.
//  API keys stay server-side.
// ═══════════════════════════════════════════════════════════════

/**
 * Fetch current price for a single stock ticker.
 * Returns: {
 *   price, change, changePercent, high, low, prevClose,
 *   source:    'finnhub'|'yahoo'|'cboe',
 *   timestamp: ISO-8601,
 *   stale:     boolean
 * }
 * Throws on total failure (all sources down).
 */
export async function fetchStockQuote(ticker) {
  const symbol = String(ticker || '').toUpperCase();
  if (!symbol) throw new Error('Ticker requis');
  const response = await fetch(`/api/quote/${encodeURIComponent(symbol)}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  const data = await response.json();
  if (data == null || data.price == null) {
    throw new Error(`Pas de quote pour ${ticker}`);
  }
  return {
    price: data.price,
    change: data.change,
    changePercent: data.changePercent,
    high: data.high,
    low: data.low,
    prevClose: data.prevClose,
    source: data.source,
    timestamp: data.timestamp,
    stale: data.stale === true,
  };
}

/**
 * Fetch prices for many tickers in ONE round trip via /api/quotes.
 *
 * Remplace l'ancien fan-out séquentiel (1 requête /api/quote/X par
 * symbole + délai de 200 ms) qui déclenchait le 429 : le bandeau
 * demande ~22 symboles par cycle. Une seule requête → un seul objet
 * de cache CDN partagé côté serveur (cf. api/quotes.js).
 *
 * Les clés de `results` conservent EXACTEMENT le ticker passé par
 * l'appelant (casse comprise) : le serveur normalise en interne mais
 * on remappe sur l'original pour ne rien changer côté consommateurs.
 * Returns: { results: { ticker: { price, ... } }, errors: [{ticker,error}] }
 */
export async function fetchQuotesBatch(tickers) {
  const list = Array.isArray(tickers) ? tickers : [];
  const results = {};
  const errors = [];

  // Déduplique par forme normalisée tout en gardant l'original.
  const wanted = [];
  const seen = new Set();
  for (const t of list) {
    const sym = String(t || '')
      .toUpperCase()
      .replace(/[^A-Z0-9.^=-]/g, '');
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);
    wanted.push({ original: t, sym });
  }
  if (wanted.length === 0) return { results, errors };

  let data;
  try {
    // URL CANONIQUE (symboles TRIÉS) : deux clients demandant le même
    // ensemble, quel que soit l'ordre, produisent la MÊME URL → un seul
    // objet de cache CDN partagé (cf. api/quotes.js). Le remappage
    // ci-dessous se fait sur `wanted` (indépendant de l'ordre).
    const qs = wanted
      .map((w) => w.sym)
      .sort()
      .join(',');
    const response = await fetch(`/api/quotes?symbols=${encodeURIComponent(qs)}`);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${response.status}`);
    }
    data = await response.json();
  } catch (err) {
    // Échec global du batch : chaque ticker demandé remonte en erreur.
    for (const w of wanted) errors.push({ ticker: w.original, error: err.message });
    console.warn('Batch quotes failed:', err.message);
    return { results, errors };
  }

  const quotes = data?.quotes || {};
  const serverErrors = data?.errors || {};
  for (const w of wanted) {
    const q = quotes[w.sym];
    if (q && q.price != null) {
      results[w.original] = {
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
        high: q.high,
        low: q.low,
        prevClose: q.prevClose,
        source: q.source,
        timestamp: q.timestamp,
        stale: q.stale === true,
      };
    } else {
      errors.push({ ticker: w.original, error: serverErrors[w.sym] || 'unavailable' });
    }
  }

  return { results, errors };
}

/**
 * Fetch prices for multiple stock tickers.
 * Délègue au batch (une seule requête réseau). Signature et forme de
 * retour inchangées → les consommateurs (poller useMarketQuotes) ne
 * bougent pas.
 * Returns: { results: { ticker: { price, ... } }, errors: [...] }
 */
export async function fetchMultipleQuotes(tickers) {
  return fetchQuotesBatch(tickers);
}
