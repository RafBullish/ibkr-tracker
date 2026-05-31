// ═══════════════════════════════════════════════════════════════
//  useIbkrLive — pont entre bridge/ibkr_poller.py et le store
//
//  Poll /ibkr/account (proxifié par Vite vers http://127.0.0.1:8765)
//  toutes les POLLING.IBKR_LIVE_MS et dispatch SYNC_IBKR avec un
//  payload mappé sur le shape attendu par le reducer.
//
//  Pattern : calqué trait pour trait sur useMarketQuotes —
//    • alivref + inFlightRef anti-réentrance ;
//    • pause sur document.hidden, refresh immédiat à la reprise ;
//    • erreurs réseau isolées et silencieuses (bridge potentiellement
//      éteint, en prod le chemin /ibkr n'existe pas).
//
//  Gating : settings.gwAutoConnect. Si false/undefined → zéro fetch.
//
//  Garde-fou : on ne dispatch QUE si status === 'ok' && connected ===
//  true. Le bridge peut renvoyer 'stale' / 'warming-up' / 503 si IBKR
//  Gateway est tombé — dans ce cas on ne touche pas au store, les
//  positions existantes (manuel / Flex) restent intactes.
//
//  Mapping bridge JSON → SYNC_IBKR :
//    bridge.positions          → payload.openPositions   (shape store déjà)
//      ⚠ uniquement si NON VIDE — un tableau [] (compte broker vraiment plat
//      OU pas encore reçu) est OMIS du payload pour que le reducer garde les
//      positions existantes intactes (anciens imports Flex / saisies manuelles
//      protégés contre un écrasement involontaire pendant un test live).
//    bridge.timestamp          → payload.timestamp       (→ settings.lastSync)
//    bridge.account            → payload.summary         (→ settings.ibkrSummary)
//    {snapshot meta + account} → payload.ibkrLiveData    (→ pilote badge LIVE
//                                                          via CommandBar.jsx)
//    cashFlows / ledger / fxRate / orders : volontairement omis →
//    le reducer SYNC_IBKR garde l'existant quand le champ est absent.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { useDispatch, useSettings } from '../store/useStore';
import { POLLING } from '../constants/timing';

const ENDPOINT = '/ibkr/account';

function mapBridgeToSyncPayload(data) {
  const acc = data.account || {};
  const ts = data.timestamp || new Date().toISOString();

  // Garde-fou anti-écrasement : on ne propage les positions que si le bridge
  // en renvoie au moins une. Un tableau vide pourrait venir d'un compte
  // broker effectivement plat OU d'une synchro pas encore arrivée — dans les
  // deux cas, mieux vaut omettre la clé (le reducer garde state.openPositions
  // existant) que d'écraser des positions saisies à la main ou importées via
  // Flex. La synchro reprendra dès que le bridge renverra un tableau non vide.
  const hasPositions = Array.isArray(data.positions) && data.positions.length > 0;

  return {
    timestamp: ts,
    openPositions: hasPositions ? data.positions : undefined,
    summary: {
      currency: acc.currency ?? null,
      netLiquidation: acc.netLiquidation ?? null,
      totalCashValue: acc.totalCashValue ?? null,
      availableFunds: acc.availableFunds ?? null,
      buyingPower: acc.buyingPower ?? null,
    },
    ibkrLiveData: {
      source: 'bridge',
      timestamp: ts,
      snapshotAgeSeconds:
        typeof data.snapshotAgeSeconds === 'number' ? data.snapshotAgeSeconds : null,
      currency: acc.currency ?? null,
      netLiquidation: acc.netLiquidation ?? null,
      totalCashValue: acc.totalCashValue ?? null,
      availableFunds: acc.availableFunds ?? null,
      buyingPower: acc.buyingPower ?? null,
    },
    // cashFlows / ledger / fxRate / orders : intentionnellement absents —
    // le reducer SYNC_IBKR garde l'existant quand le champ n'est pas dans le payload.
  };
}

export default function useIbkrLive({ refreshMs = POLLING.IBKR_LIVE_MS } = {}) {
  const settings = useSettings();
  const dispatch = useDispatch();
  const enabled = Boolean(settings?.gwAutoConnect);

  const aliveRef = useRef(true);
  const timerRef = useRef(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;
    aliveRef.current = true;

    const run = async () => {
      if (inFlightRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      inFlightRef.current = true;
      try {
        const res = await fetch(ENDPOINT, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (!aliveRef.current) return;
        if (!res.ok) return; // 503 stale / warming-up → skip silencieux
        const data = await res.json();
        if (!aliveRef.current) return;
        if (data?.status !== 'ok' || data?.connected !== true) return;

        dispatch({ type: 'SYNC_IBKR', payload: mapBridgeToSyncPayload(data) });
      } catch {
        // bridge éteint / réseau coupé / endpoint absent en prod → silencieux.
        // Prochaine tick on retentera.
      } finally {
        inFlightRef.current = false;
      }
    };

    // Kick immédiat au montage / changement d'activation.
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
  }, [enabled, refreshMs, dispatch]);
}
