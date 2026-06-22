// ═══════════════════════════════════════════════════════════════
//  useMarketSparklines — hero strip 7-day sparklines (B1.2)
//
//  Polling séparé de useMarketQuotes : cadence 5 min (data 7-j change
//  peu en intra-day), cache localStorage `ibkr_market_sparklines_v1`
//  (TTL 24 h = anti-flash au reload).
//
//  Pour chaque symbol, fetch `/api/chart/[ticker]?range=7d&interval=1d`
//  (proxy Yahoo chart). Retourne `{ sparklines: { [symbol]: { prices,
//  timestamp } }, errors: { [symbol]: string } }`.
//
//  B1-FIX (2026-05) — éliminations 429 :
//    - FRESH_TTL_MS (5 min) : skip-if-fresh avant chaque fetch. Le 2e
//      reload dans 5 min ne déclenche aucun appel /api/chart (la donnée
//      cachée est servie). CACHE_MAX_AGE_MS (24 h) reste pour la
//      réhydratation anti-flash au reload après plusieurs heures.
//    - Dedup module-scope (`inflightBySymbol`) : 2 montages StrictMode
//      en dev partagent la même Promise par symbol → un seul fetch
//      par ticker même si N hooks le demandent simultanément.
//    - Backoff 429 : lit `Retry-After`, retry une fois après ce délai.
//      Si le 2e échoue, marque l'erreur (dégradé propre, pas de boucle).
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';

const CACHE_KEY = 'ibkr_market_sparklines_v1';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 h — anti-flash réhydratation
const FRESH_TTL_MS = 5 * 60 * 1000; // 5 min — anti-refetch en session
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 min — aligné sur FRESH_TTL
const INTER_FETCH_DELAY_MS = 250; // espacement inter-call pour éviter burst
const RETRY_AFTER_FALLBACK_MS = 2000;
const RETRY_AFTER_MAX_MS = 15_000; // cap defensif si le serveur envoie un très grand délai

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

// ─── B1.3 — Module-scope in-flight dedup ──────────────────────────
//
// Map<symbol, Promise<chartResponse>>. Si N consommateurs (ou 2 instances
// StrictMode du même hook) demandent le même symbole AVANT que le 1er
// fetch soit résolu, ils partagent la même Promise → 1 seul appel réseau
// pour ce symbole. La map est nettoyée à la résolution / rejet (finally).
//
// Vit au module-scope volontairement : un useRef serait local à
// l'instance et ne partagerait rien entre les 2 montages StrictMode.
const inflightBySymbol = new Map();

function parseRetryAfterMs(header) {
  if (!header) return RETRY_AFTER_FALLBACK_MS;
  // RFC 7231 : Retry-After peut être un entier (secondes) ou une date HTTP.
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, RETRY_AFTER_MAX_MS);
  }
  const date = Date.parse(header);
  if (Number.isFinite(date)) {
    return Math.min(Math.max(0, date - Date.now()), RETRY_AFTER_MAX_MS);
  }
  return RETRY_AFTER_FALLBACK_MS;
}

async function rawFetchSparkline(symbol) {
  const url = `/api/chart/${encodeURIComponent(symbol)}?range=7d&interval=1d`;
  let res = await fetch(url);

  // ─── B1.4 — Backoff 429 (one retry only) ──────────────────────────
  // Si on tape le rate limiter malgré tout (cache miss en burst,
  // edge cache pas encore peuplé, etc.), on respecte le Retry-After
  // et on retry UNE seule fois. Pas de boucle infinie.
  if (res.status === 429) {
    const delayMs = parseRetryAfterMs(res.headers.get('Retry-After'));
    await new Promise((r) => setTimeout(r, delayMs));
    res = await fetch(url);
  }

  if (!res.ok) throw new Error(`chart fetch ${symbol}: ${res.status}`);
  return res.json();
}

async function fetchSparkline(symbol) {
  const existing = inflightBySymbol.get(symbol);
  if (existing) return existing;
  const promise = rawFetchSparkline(symbol).finally(() => {
    inflightBySymbol.delete(symbol);
  });
  inflightBySymbol.set(symbol, promise);
  return promise;
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
    const now = Date.now();

    try {
      for (const symbol of symbols) {
        // ─── B1.2 — Skip si cache frais ───────────────────────────
        // FRESH_TTL_MS (5 min) — distinct de CACHE_MAX_AGE_MS (24 h
        // = anti-flash réhydratation). Le 2e reload dans 5 min ne
        // déclenche aucun appel réseau pour ce symbole.
        const cached = cacheRef.current[symbol];
        if (cached && typeof cached.timestamp === 'number' && now - cached.timestamp < FRESH_TTL_MS) {
          continue;
        }
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

    // ─── B1.4 — visibility refetch bénéficie du skip-if-fresh ────
    // Le path visibilitychange appelle simplement fetchAll() qui
    // applique déjà le skip TTL (B1.2). Toggle DevTools focus/blur
    // ne déclenche plus de burst si la donnée est < FRESH_TTL.
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
