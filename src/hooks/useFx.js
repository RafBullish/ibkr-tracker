// ═══════════════════════════════════════════════════════════════
//  useFx — read-only consumer of the FX slice + manual actions.
//
//  Exposes the current rate, freshness flags, isLoading/error from
//  in-flight refresh attempts, plus three manual actions:
//    refresh()       — fetch /api/fx/usdchf with 8s timeout, atomic
//                      SET_FX_STATE on success. Mode left UNCHANGED.
//    setMode(m)      — switch fxMode between 'manual' / 'auto'.
//    setManualRate(r) — set rate explicitly + flip to manual mode.
//
//  NO auto-fetch on mount, NO interval, NO bootstrap effect. The
//  auto-refresh wrapper lands in a separate commit (#7).
// ═══════════════════════════════════════════════════════════════

import { useCallback, useMemo, useState } from 'react';
import { useSettings, useDispatch } from '../store/useStore';
import {
  usdToChf as usdToChfPure,
  chfToUsd as chfToUsdPure,
  formatChf,
  formatUsd,
  formatRate,
} from '../utils/fx/helpers';

const STALE_MS = 24 * 60 * 60 * 1000; // 24h
const CRITICAL_MS = 7 * 24 * 60 * 60 * 1000; // 7d
const FETCH_TIMEOUT_MS = 8000;
const VALID_MODES = new Set(['manual', 'auto']);

export function useFx() {
  const settings = useSettings();
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const rate = settings.liveRate;
  const mode = settings.fxMode;
  const lastUpdated = settings.fxLastUpdated;
  const source = settings.fxSource;

  // isStale/isCritical sont mémoïsés sur lastUpdated. Si le composant
  // consommateur ne re-render pas pendant 24h+, le flag peut être stale.
  // Un consommateur d'UI à long terme (ex: banner stale, commit #8)
  // devra forcer un re-render périodique (setInterval 60s côté composant).
  const { isStale, isCritical } = useMemo(() => {
    if (!lastUpdated) return { isStale: true, isCritical: true };
    const age = Date.now() - new Date(lastUpdated).getTime();
    return { isStale: age > STALE_MS, isCritical: age > CRITICAL_MS };
  }, [lastUpdated]);

  const setMode = useCallback(
    (m) => {
      if (!VALID_MODES.has(m)) {
        throw new TypeError(`useFx.setMode: mode must be 'manual' or 'auto', got ${String(m)}`);
      }
      dispatch({ type: 'SET_FX_MODE', payload: m });
    },
    [dispatch]
  );

  const setManualRate = useCallback(
    (r) => {
      if (typeof r !== 'number' || !Number.isFinite(r) || !(r > 0)) {
        throw new RangeError(
          `useFx.setManualRate: rate must be a finite positive number, got ${String(r)}`
        );
      }
      dispatch({
        type: 'SET_FX_STATE',
        payload: {
          rate: r,
          mode: 'manual',
          lastUpdated: new Date().toISOString(),
          source: 'manual',
        },
      });
    },
    [dispatch]
  );

  // refresh() — fetch with 8s timeout. On success: atomic SET_FX_STATE
  // with rate + lastUpdated + source. Mode is intentionally NOT included
  // in the payload so the reducer leaves it untouched (the user's
  // manual/auto choice is orthogonal to a manual refresh).
  // On any failure (timeout, HTTP, invalid rate): set local error,
  // store untouched — last-known-good rate is preserved.
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch('/api/fx/usdchf', { signal: controller.signal });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const data = await response.json();
      const fetchedRate = parseFloat(data?.rate);
      if (!(fetchedRate > 0)) throw new Error('Invalid FX rate from proxy');
      dispatch({
        type: 'SET_FX_STATE',
        payload: {
          rate: fetchedRate,
          lastUpdated: new Date().toISOString(),
          source: data.source || 'API',
        },
      });
    } catch (e) {
      setError(e);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [dispatch]);

  // Bound converters — capture the current rate so callers don't have
  // to thread it through. Re-created on rate change so conversions are
  // never stale.
  const usdToChf = useCallback((amt) => usdToChfPure(amt, rate), [rate]);
  const chfToUsd = useCallback((amt) => chfToUsdPure(amt, rate), [rate]);

  return {
    rate,
    mode,
    lastUpdated,
    source,
    isStale,
    isCritical,
    isLoading,
    error,
    refresh,
    setMode,
    setManualRate,
    usdToChf,
    chfToUsd,
    formatChf,
    formatUsd,
    formatRate,
  };
}
