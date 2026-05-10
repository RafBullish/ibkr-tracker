// ═══════════════════════════════════════════════════════════════
//  useMarketQuotes — header market ticker feed
//
//  Polls the serverless /api/quote/:ticker endpoint (cascade
//  Finnhub → Yahoo → CBOE) for a small fixed list of symbols used
//  by the global header (SPX, NDX, DJI, BTC).
//
//  Behaviour:
//    • Initial hydration from localStorage cache
//      (key "ibkr_market_tickers_v1") — instant paint, no layout
//      shift.
//    • Live fetch on mount, then every 60 s.
//    • Pauses while document.hidden is true; resumes on visible.
//    • Deduplicated by symbol; failures per-symbol don't poison
//      the others (fetchMultipleQuotes already returns partial
//      results + errors[]).
//
//  Returned shape:
//    {
//      quotes:         { [symbol]: Quote },
//      errors:         { [symbol]: string },
//      loadingInitial: boolean,   // true only until first network
//                                 // response arrives (cache doesn't
//                                 // count — caller wants a shimmer
//                                 // until a real number is fresh)
//      lastUpdate:     ISO-8601 | null,
//    }
//
//  Quote shape mirrors stockApi.fetchStockQuote:
//    { price, change, changePercent, source, timestamp, stale }
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { fetchMultipleQuotes } from '../utils/stockApi';
import { POLLING, TIME } from '../constants/timing';

const CACHE_KEY = 'ibkr_market_tickers_v1';
const DEFAULT_REFRESH_MS = POLLING.MARKET_QUOTES_MS;
const CACHE_MAX_AGE_MS = 24 * TIME.ONE_HOUR_MS; // Ignore stale cache >24 h

function readCache() {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const writtenAt = parsed.writtenAt ? new Date(parsed.writtenAt).getTime() : 0;
    if (!writtenAt || Date.now() - writtenAt > CACHE_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(quotes) {
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ writtenAt: new Date().toISOString(), quotes })
    );
  } catch {
    /* quota / disabled — silent */
  }
}

export default function useMarketQuotes(symbols, { refreshMs = DEFAULT_REFRESH_MS } = {}) {
  // Lock the symbols reference so identity churn in the caller
  // (re-rendered array literal) doesn't restart the polling loop.
  const symbolsKey = symbols.join('|');

  const [state, setState] = useState(() => {
    const cache = readCache();
    return {
      quotes: cache?.quotes || {},
      errors: {},
      loadingInitial: !cache,
      lastUpdate: null,
    };
  });

  const aliveRef = useRef(true);
  const timerRef = useRef(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;

    const run = async () => {
      if (inFlightRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      inFlightRef.current = true;
      try {
        const { results, errors } = await fetchMultipleQuotes(symbols);
        if (!aliveRef.current) return;

        const errorMap = {};
        for (const { ticker, error } of errors) errorMap[ticker] = error;

        setState((prev) => {
          const nextQuotes = { ...prev.quotes, ...results };
          writeCache(nextQuotes);
          return {
            quotes: nextQuotes,
            errors: errorMap,
            loadingInitial: false,
            lastUpdate: new Date().toISOString(),
          };
        });
      } finally {
        inFlightRef.current = false;
      }
    };

    // Kick off immediately on mount / symbol change.
    run();

    const schedule = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(run, refreshMs);
    };
    schedule();

    const onVisibility = () => {
      if (document.hidden) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else {
        // On resume, refresh immediately then re-arm.
        run();
        schedule();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, refreshMs]);

  return state;
}
