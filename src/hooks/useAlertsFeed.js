// ═══════════════════════════════════════════════════════════════
//  useAlertsFeed — feed d'alertes DÉRIVÉ (U7)
//
//  Vue agrégée, en temps réel, des signaux d'attention DÉJÀ calculés
//  ailleurs dans l'app — PAS un journal d'événements daté, pas de
//  nouvelle slice, pas d'effet de bord. On lit l'état courant et on
//  regroupe :
//    (1) Alertes par position — moteur canonique `generateAlerts`
//        (utils/alerts), filtré aux signaux actionnables (red/orange) :
//        DTE critique, stop-loss, time-stop, take-profit. Chacune porte
//        un positionId → deep-link /trading/positions?focus={id} (U4).
//    (2) Kill-switch quotidien — `useDailyKillSwitch` : limite de perte
//        du jour franchie → /insights/journal (où la carte est rendue).
//
//  Les gates Sniper (useSniperGates) recoupent DTE/SL/TP de
//  generateAlerts : on garde le moteur canonique pour éviter les
//  doublons. Aucun signal n'a d'horodatage naturel (dérivé de l'état
//  courant) → le composant n'affiche pas de fausse heure.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useOpenPositions, useSettings } from '../store/useStore';
import { generateAlerts } from '../utils/alerts';
import { toFloat } from '../utils/math';
import useDailyKillSwitch from './useDailyKillSwitch';

// generateAlerts accepte un greeksMap mais aucune de ses règles
// red/orange ne l'utilise → une Map vide suffit (et stable).
const EMPTY_GREEKS = new Map();
const SEV_ORDER = { critical: 0, warning: 1 };

const fmtUsd0 = (v) =>
  (v < 0 ? '-' : '') + '$' + Math.abs(Math.round(v)).toLocaleString('de-CH');

export function useAlertsFeed() {
  const openPositions = useOpenPositions();
  const settings = useSettings();
  const lr = toFloat(settings?.liveRate) || 1;
  const { triggered, dailyPnlUsd, maxLoss } = useDailyKillSwitch();

  return useMemo(() => {
    const feed = [];

    // (1) Alertes par position (red/orange uniquement = actionnables).
    const posAlerts = generateAlerts(openPositions, EMPTY_GREEKS, lr).filter(
      (a) => a.severity === 'red' || a.severity === 'orange'
    );
    for (const a of posAlerts) {
      feed.push({
        id: `pos-${a.positionId}-${a.type}`,
        severity: a.severity === 'red' ? 'critical' : 'warning',
        message: a.message,
        ticker: a.ticker || null,
        target: a.positionId
          ? `/trading/positions?focus=${encodeURIComponent(a.positionId)}`
          : '/trading/positions',
      });
    }

    // (2) Kill-switch quotidien (limite de perte du jour franchie).
    if (triggered) {
      feed.push({
        id: 'killswitch-daily',
        severity: 'critical',
        message: `Limite de perte quotidienne atteinte · ${fmtUsd0(dailyPnlUsd)} / ${fmtUsd0(maxLoss)}`,
        ticker: null,
        target: '/insights/journal',
      });
    }

    // Dédup par id puis tri sévérité décroissante (sort stable → ordre
    // source préservé à sévérité égale).
    const seen = new Set();
    const deduped = feed.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
    deduped.sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));
    return deduped;
  }, [openPositions, lr, triggered, dailyPnlUsd, maxLoss]);
}

export default useAlertsFeed;
