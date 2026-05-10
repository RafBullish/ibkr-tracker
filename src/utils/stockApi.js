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
 * Fetch prices for multiple stock tickers
 * Adds a small delay between calls to respect rate limits
 * Returns: { ticker: { price, ... }, ... }
 */
export async function fetchMultipleQuotes(tickers) {
  const results = {};
  const errors = [];

  for (const ticker of tickers) {
    try {
      results[ticker] = await fetchStockQuote(ticker);
      // Small delay to be respectful of rate limits (60/min = 1/sec max)
      if (tickers.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (err) {
      errors.push({ ticker, error: err.message });
      console.warn(`Failed to fetch ${ticker}:`, err.message);
    }
  }

  return { results, errors };
}

/**
 * Stock API is always reachable via the serverless proxy.
 * The proxy returns 500 if FINNHUB_KEY is missing server-side.
 */
export function isStockApiConfigured() {
  return true;
}
