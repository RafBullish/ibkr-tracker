// ═══════════════════════════════════════════════════════════════
//  useFxLiveSync — source FX unique → settings.liveRate
//
//  Héros 1 LIVE (Phase B, 3.2) — le PRODUCTEUR devient fx_rates (mid
//  IDEALPRO écrit par le bridge) quand la dernière ligne a moins de
//  10 min (FX_AGE.STALE_MS, le seuil ambre de 1.G-c) ; repli sur la
//  quote actuelle (Yahoo) sinon. `settings.liveRate` reste le SEUL
//  canal consommé en aval ; l'âge affiché (FxCell) = le captured_at de
//  la ligne, jamais l'heure du fetch. Ainsi la tête de la courbe live
//  et les cellules sont au même taux quand le bridge est frais.
//
//  Cascade canonique :
//    bridge fx_rates (< 10 min) > live Yahoo (< 2 min) > Frankfurter
//    (useFxAutoRefresh, < 24 h) > stale Frankfurter > manual
//  Mode manual : on ne touche jamais au taux choisi par l'utilisateur.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import useMarketQuotes from './useMarketQuotes';
import { useFx } from './useFx';
import { useDispatch } from '../store/useStore';
import { useLiveFx } from '../store/liveFeed';
import { isValidFxRate } from '../utils/fx/helpers';
import { FX_AGE } from '../constants/timing';

const FX_QUOTE_SYMBOLS = ['USDCHF=X'];
const STALE_QUOTE_MS = 2 * 60 * 1000; // 2 min — match TickerTape STALE threshold
const RATE_DIFF_THRESHOLD = 0.0001; // 1 pip — sensibilité minimum

/** La ligne fx_rates bridge est-elle utilisable comme producteur ?
 *  (< FX_AGE.STALE_MS, mid valide). PUR — testé aux bornes 10 min. */
export function isBridgeFxFresh(fx, nowMs, staleMs = FX_AGE.STALE_MS) {
  if (!fx || !Number.isFinite(fx.mid) || !isValidFxRate(fx.mid)) return false;
  const t = fx.capturedAt ? new Date(fx.capturedAt).getTime() : NaN;
  if (!Number.isFinite(t)) return false;
  const age = nowMs - t;
  return age >= 0 && age < staleMs;
}

export function useFxLiveSync() {
  const dispatch = useDispatch();
  const { mode, rate } = useFx();
  const { quotes } = useMarketQuotes(FX_QUOTE_SYMBOLS);
  const bridgeFx = useLiveFx();
  const lastSyncedRef = useRef(null);
  const lastBridgeAtRef = useRef(null);

  useEffect(() => {
    // Manual override : on ne touche pas au taux choisi par l'user en
    // Réglages, même si le live diverge. Respect deliberate UX.
    if (mode !== 'auto') return;

    // ── Producteur 1 : fx_rates bridge (< 10 min) — il GAGNE. ──
    if (isBridgeFxFresh(bridgeFx, Date.now())) {
      // Une ligne = un dispatch (dédup sur capturedAt : la sonde relit la
      // même dernière ligne à chaque cycle, on n'écrit pas en boucle).
      if (lastBridgeAtRef.current !== bridgeFx.capturedAt) {
        lastBridgeAtRef.current = bridgeFx.capturedAt;
        lastSyncedRef.current = bridgeFx.mid;
        dispatch({
          type: 'SET_FX_STATE',
          payload: {
            rate: bridgeFx.mid,
            // L'âge affiché = captured_at de la LIGNE (jamais l'heure du fetch).
            lastUpdated: bridgeFx.capturedAt,
            source: 'live · bridge IDEALPRO USD.CHF',
          },
        });
      }
      return; // bridge frais → la quote ne parle pas
    }

    // ── Producteur 2 (repli) : quote actuelle (Yahoo). ──
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
  }, [dispatch, mode, rate, quotes, bridgeFx]);
}

export default useFxLiveSync;
