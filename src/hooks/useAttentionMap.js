// ═══════════════════════════════════════════════════════════════
//  useAttentionMap (É3 §4.2.1) — LE classifieur unique, servi en Map.
//
//  Q-C : le classifieur consomme désormais le MOTEUR UNIQUE de portes
//  (utils/gates via decision/model.deriveAttention). Plus de fusion avec
//  generateAlerts (legacy retiré) : une porte ne vit qu'à un seul endroit.
//  Rend deriveAttention sous forme de Map(positionId → ligne). Une position
//  CRITICAL dans la bande est CRITICAL partout : page Positions,
//  LivePositions (Dashboard), PreMarket. Zéro recalcul divergent.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import useSniperGates from './useSniperGates';
import useDailyKillSwitch from './useDailyKillSwitch';
import { deriveAttention } from '../components/dashboard/decision/model';

/** Jour de séance NY ('YYYY-MM-DD') — pour la fenêtre P4. */
function nyToday() {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export default function useAttentionMap() {
  const gates = useSniperGates();
  const kill = useDailyKillSwitch();

  return useMemo(() => {
    const att = deriveAttention({
      gateRows: gates.rows,
      today: nyToday(),
      watchedCount: 0,
      kill: { triggered: kill.triggered, dailyPnlUsd: kill.dailyPnlUsd, maxLoss: kill.maxLoss },
      maxLines: Infinity,
    });
    return new Map(att.lines.map((l) => [l.id, l]));
  }, [gates.rows, kill.triggered, kill.dailyPnlUsd, kill.maxLoss]);
}
