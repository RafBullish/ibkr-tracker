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
//  1.C — POLLER PARTAGÉ MODULE-SCOPE : N consommateurs avec la MÊME
//  liste de symboles (TickerTape + MarketDeck) partagent UNE seule
//  boucle de polling (subscribe/notify). Un seul setInterval, un seul
//  train de requêtes /api/quote quel que soit le nombre d'instances.
//  API du hook inchangée. Le poller s'éteint quand le dernier abonné
//  se démonte (refCount).
//
//  Returned shape:
//    {
//      quotes:         { [symbol]: Quote },
//      errors:         { [symbol]: string },
//      loadingInitial: boolean,
//      lastUpdate:     ISO-8601 | null,
//    }
//
//  Quote shape mirrors stockApi.fetchStockQuote:
//    { price, change, changePercent, source, timestamp, stale }
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
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

// ─── Pollers partagés, un par (symbolsKey, refreshMs) ─────────────
const pollers = new Map();

function createPoller(symbols, refreshMs) {
  const cache = readCache();
  const poller = {
    refCount: 0,
    timer: null,
    inFlight: false,
    state: {
      quotes: cache?.quotes || {},
      errors: {},
      loadingInitial: !cache,
      lastUpdate: null,
    },
    subscribers: new Set(),
    // 1.C.2 — symboles ADDITIONNELS injectés dans le MÊME batch par des
    // consommateurs tiers (futures ES/NQ/YM hors RTH, cf.
    // useQuoteBatchExtras). Même train fetchMultipleQuotes, même
    // interval — aucune boucle nouvelle.
    extras: new Map(),
  };

  const notify = () => {
    for (const cb of poller.subscribers) cb(poller.state);
  };

  const run = async () => {
    if (poller.inFlight) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    poller.inFlight = true;
    try {
      const extraList = [...new Set([...poller.extras.values()].flat())].filter(
        (s) => !symbols.includes(s)
      );
      const batch = extraList.length ? [...symbols, ...extraList] : symbols;
      const { results, errors } = await fetchMultipleQuotes(batch);
      if (poller.refCount === 0) return;

      const errorMap = {};
      for (const { ticker, error } of errors) errorMap[ticker] = error;

      const nextQuotes = { ...poller.state.quotes, ...results };
      writeCache(nextQuotes);
      poller.state = {
        quotes: nextQuotes,
        errors: errorMap,
        loadingInitial: false,
        lastUpdate: new Date().toISOString(),
      };
      notify();
    } finally {
      poller.inFlight = false;
    }
  };

  const schedule = () => {
    if (poller.timer) clearInterval(poller.timer);
    poller.timer = setInterval(run, refreshMs);
  };

  const onVisibility = () => {
    if (document.hidden) {
      if (poller.timer) {
        clearInterval(poller.timer);
        poller.timer = null;
      }
    } else {
      run();
      schedule();
    }
  };

  poller.start = () => {
    run();
    schedule();
    document.addEventListener('visibilitychange', onVisibility);
  };

  poller.stop = () => {
    if (poller.timer) clearInterval(poller.timer);
    poller.timer = null;
    document.removeEventListener('visibilitychange', onVisibility);
  };

  // Rafraîchissement immédiat à la (dé)registration d'extras : le batch
  // suivant part tout de suite (une seule fois), l'interval reste le même.
  poller.kick = () => {
    run();
  };

  return poller;
}

/**
 * 1.C.2 — Enregistre des symboles ADDITIONNELS sur le poller partagé
 * d'une liste de base déjà active (ex. le batch du TickerTape). Les
 * extras rejoignent le MÊME train /api/quote à la MÊME cadence — zéro
 * interval ni boucle supplémentaire. Extras vides → no-op total.
 * Le composant appelant doit AUSSI consommer useMarketQuotes(baseSymbols)
 * (garantit l'existence du poller et la réception des quotes).
 */
export function useQuoteBatchExtras(baseSymbols, extraSymbols, { refreshMs = DEFAULT_REFRESH_MS } = {}) {
  const pollerKey = `${baseSymbols.join('|')}|${refreshMs}`;
  const extrasKey = (extraSymbols || []).join('|');

  useEffect(() => {
    if (!extrasKey) return undefined;
    const poller = pollers.get(pollerKey);
    if (!poller) return undefined;
    const id = {};
    poller.extras.set(id, extrasKey.split('|'));
    poller.kick();
    return () => {
      poller.extras.delete(id);
    };
  }, [pollerKey, extrasKey]);
}

export default function useMarketQuotes(symbols, { refreshMs = DEFAULT_REFRESH_MS } = {}) {
  // Lock the symbols reference so identity churn in the caller
  // (re-rendered array literal) doesn't restart the polling loop.
  const symbolsKey = symbols.join('|');
  const pollerKey = `${symbolsKey}|${refreshMs}`;

  const [state, setState] = useState(() => {
    const existing = pollers.get(pollerKey);
    if (existing) return existing.state;
    const cache = readCache();
    return {
      quotes: cache?.quotes || {},
      errors: {},
      loadingInitial: !cache,
      lastUpdate: null,
    };
  });

  useEffect(() => {
    let poller = pollers.get(pollerKey);
    if (!poller) {
      // Liste vide → ''.split('|') donnerait [''] : un poller qui tente
      // de fetch un ticker VIDE à chaque train (bug 1.C.10, état vide).
      poller = createPoller(symbolsKey ? symbolsKey.split('|') : [], refreshMs);
      pollers.set(pollerKey, poller);
    }
    poller.subscribers.add(setState);
    poller.refCount += 1;
    // Sync immédiat (le poller peut avoir des données plus fraîches que
    // l'état initial de cette instance).
    setState(poller.state);
    if (poller.refCount === 1) poller.start();

    return () => {
      poller.subscribers.delete(setState);
      poller.refCount -= 1;
      if (poller.refCount === 0) {
        poller.stop();
        pollers.delete(pollerKey);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollerKey]);

  return state;
}
