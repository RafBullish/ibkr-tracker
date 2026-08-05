// ═══════════════════════════════════════════════════════════════
//  useAttentionMap (É3 §4.2.1) — LE classifieur unique, servi en Map.
//
//  Assemble les MÊMES entrées que la bande décision (generateAlerts
//  filtré red/orange + useSniperGates.rows + kill switch) et rend
//  deriveAttention sous forme de Map(positionId → ligne). Une position
//  CRITICAL dans la bande est CRITICAL partout : page Positions,
//  LivePositions (Dashboard), et tout futur consommateur d'un badge
//  de gate. Zéro recalcul divergent, zéro vocabulaire propre.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useOpenPositions, useSettings } from '../store/useStore';
import useSniperGates from './useSniperGates';
import useDailyKillSwitch from './useDailyKillSwitch';
import { generateAlerts } from '../utils/alerts';
import { deriveAttention } from '../components/dashboard/decision/model';
import { toFloat } from '../utils/math';

// generateAlerts accepte un greeksMap mais aucune règle red/orange ne
// l'utilise → Map vide stable (même convention que DecisionBand).
const EMPTY_GREEKS = new Map();

export default function useAttentionMap() {
  const openPositions = useOpenPositions();
  const settings = useSettings();
  const gates = useSniperGates();
  const kill = useDailyKillSwitch();
  const lr = toFloat(settings?.liveRate) || 1;

  const alerts = useMemo(
    () =>
      generateAlerts(openPositions || [], EMPTY_GREEKS, lr).filter(
        (a) => a.severity === 'red' || a.severity === 'orange'
      ),
    [openPositions, lr]
  );

  return useMemo(() => {
    const att = deriveAttention({
      alerts,
      gateRows: gates.rows,
      watchedCount: 0,
      kill: { triggered: kill.triggered, dailyPnlUsd: kill.dailyPnlUsd, maxLoss: kill.maxLoss },
      maxLines: Infinity,
    });
    return new Map(att.lines.map((l) => [l.id, l]));
  }, [alerts, gates.rows, kill.triggered, kill.dailyPnlUsd, kill.maxLoss]);
}
