// ═══════════════════════════════════════════════════════════════
//  useFxLiveSync — single FX source : Yahoo USDCHF=X → settings.liveRate
//
//  Avant ce hook deux taux coexistaient à l'écran :
//    • TickerTape  : 0.7838 (live Yahoo via useMarketQuotes)
//    • Footer / Cockpit / Conversions / FX Impact : 0.7865 (Frankfurter
//      figé écrit par useFxAutoRefresh toutes les 5 min)
//
//  Le ticker utilise la même cascade /api/quote/USDCHF=X que le reste du
//  ticker tape (Finnhub → Yahoo → CBOE), poll 60 s. On hisse cette valeur
//  dans `settings.liveRate` au lieu de Frankfurter quand :
//    – le quote a un price valide (isValidFxRate)
//    – le quote n'est pas stale (timestamp < 2 min)
//    – le mode FX est 'auto' (manual = choix utilisateur, on ne touche pas)
//    – le diff vs settings.liveRate > 1 pip (0.0001) pour ne pas spammer
//
//  Frankfurter (useFxAutoRefresh) reste actif comme fallback : si Yahoo
//  est down, le boot fetch Frankfurter + ses re-tries 5 min couvrent le
//  trou. La cascade canonique devient :
//    live (Yahoo, < 2 min) > Frankfurter (< 24 h) > stale Frankfurter > manual
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import useMarketQuotes from './useMarketQuotes';
import { useFx } from './useFx';
import { useDispatch } from '../store/useStore';
import { isValidFxRate } from '../utils/fx/helpers';

const FX_QUOTE_SYMBOLS = ['USDCHF=X'];
const STALE_QUOTE_MS = 2 * 60 * 1000; // 2 min — match TickerTape STALE threshold
const RATE_DIFF_THRESHOLD = 0.0001; // 1 pip — sensibilité minimum

export function useFxLiveSync() {
  const dispatch = useDispatch();
  const { mode, rate } = useFx();
  const { quotes } = useMarketQuotes(FX_QUOTE_SYMBOLS);
  const lastSyncedRef = useRef(null);

  useEffect(() => {
    // Manual override : on ne touche pas au taux choisi par l'user en
    // Réglages, même si le live diverge. Respect deliberate UX.
    if (mode !== 'auto') return;

    const q = quotes && quotes['USDCHF=X'];
    if (!q) return;
    if (!Number.isFinite(q.price) || !isValidFxRate(q.price)) return;

    // Freshness — ne reprend pas un quote stale (weekend, marché fermé).
    // Frankfurter prendra le relai via useFxAutoRefresh.
    const ts = q.timestamp ? new Date(q.timestamp).getTime() : null;
    if (ts != null && Date.now() - ts > STALE_QUOTE_MS) return;

    // Diff threshold — éviter dispatch sur micro-fluctuation < 1 pip.
    if (
      lastSyncedRef.current != null &&
      Math.abs(q.price - lastSyncedRef.current) < RATE_DIFF_THRESHOLD
    ) {
      return;
    }
    if (rate != null && Math.abs(q.price - rate) < RATE_DIFF_THRESHOLD) {
      return;
    }

    lastSyncedRef.current = q.price;
    dispatch({
      type: 'SET_FX_STATE',
      payload: {
        rate: q.price,
        lastUpdated: new Date().toISOString(),
        source: 'live · Yahoo USDCHF=X',
      },
    });
  }, [dispatch, mode, rate, quotes]);
}

export default useFxLiveSync;
