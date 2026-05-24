// ═══════════════════════════════════════════════════════════════
//  useMarketSparklines — hero strip 7-day sparklines (B1.2)
//
//  Polling séparé de useMarketQuotes : cadence 5 min (data 7-j change
//  peu en intra-day), cache localStorage `ibkr_market_sparklines_v1`
//  (TTL 24 h), pause quand l'onglet est hidden.
//
//  Pour chaque symbol, fetch `/api/chart/[ticker]?range=7d&interval=1d`
//  (proxy Yahoo chart). Retourne `{ sparklines: { [symbol]: { prices,
//  timestamp } }, errors: { [symbol]: string } }`.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';

const CACHE_KEY = 'ibkr_market_sparklines_v1';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const INTER_FETCH_DELAY_MS = 250; // espacement inter-call pour éviter burst

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const now = Date.now();
    const fresh = {};
    Object.entries(parsed).forEach(([symbol, entry]) => {
      if (entry && typeof entry.timestamp === 'number' && now - entry.timestamp < CACHE_MAX_AGE_MS) {
        fresh[symbol] = entry;
      }
    });
    return fresh;
  } catch {
    return {};
  }
}

function persistCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota / disabled — silent */
  }
}

async function fetchSparkline(symbol) {
  const res = await fetch(
    `/api/chart/${encodeURIComponent(symbol)}?range=7d&interval=1d`
  );
  if (!res.ok) throw new Error(`chart fetch ${symbol}: ${res.status}`);
  return res.json();
}

export function useMarketSparklines(symbols) {
  // Clé stable pour les deps : évite de refetch quand l'array reference
  // change mais le contenu non (cf. pattern useMarketQuotes).
  const symbolsKey = (symbols || []).join('|');

  const [sparklines, setSparklines] = useState(() => loadCache());
  const [errors, setErrors] = useState({});
  const inflightRef = useRef(false);
  const cacheRef = useRef(loadCache());
  // Le premier fetch doit toujours s'exécuter, même si le tab est marqué
  // 'hidden' au mount (cas typique : DevTools ouvert juste après load).
  // La garde visibility ne s'applique qu'aux fetchs subséquents du polling.
  const hasInitialFetchedRef = useRef(false);

  const fetchAll = useCallback(async () => {
    if (inflightRef.current) return;
    if (!symbols || symbols.length === 0) return;
    if (
      hasInitialFetchedRef.current &&
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    ) return;

    inflightRef.current = true;
    const next = { ...cacheRef.current };
    const nextErrors = {};

    try {
      for (const symbol of symbols) {
        try {
          const data = await fetchSparkline(symbol);
          next[symbol] = {
            prices: data.prices || [],
            timestamp: data.timestamp || Date.now(),
          };
        } catch (err) {
          console.warn(`[useMarketSparklines] fetch failed for ${symbol}:`, err.message);
          nextErrors[symbol] = err.message;
          // conserve l'ancien cache si présent
        }
        await new Promise((r) => setTimeout(r, INTER_FETCH_DELAY_MS));
      }
      cacheRef.current = next;
      persistCache(next);
      setSparklines({ ...next });
      setErrors(nextErrors);
    } finally {
      inflightRef.current = false;
      hasInitialFetchedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, POLL_INTERVAL_MS);

    // Si le tab redevient visible apres avoir ete cache, re-fire un fetch
    // immediat (au-dela de l'interval 5 min). Aligne avec le pattern de
    // useMarketQuotes.js qui a le meme listener.
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchAll();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      clearInterval(id);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [fetchAll]);

  return { sparklines, errors };
}
