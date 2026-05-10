// ═══════════════════════════════════════════════════════════════
//  useNextGate v5 Sprint 1.2 — closest Sniper gate across positions
//
//  Pure derivation from useOpenPositions. No fetches, no state. The
//  hook returns the position whose nearest gate is closest in time
//  (positive = upcoming, negative = already triggered).
//
//  Sprint 1.2 scope : SL35 + DTE45 gates only (the two derivable
//  from `ex` + today's date alone). EARN-J2 / EARN+J30 / TP / TR
//  require either earnings calendar (Sprint 5/6) or sniper meta
//  tagging (Sprint 2 UI). They land in this hook progressively.
//
//  Returns null when :
//    - no open positions
//    - no position has a parseable expiry (stocks-only portfolio)
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useOpenPositions } from '../store/useStore';
import { dteFromExp } from '../utils/positions';

const GATE_DTE45 = 45;
const GATE_SL35 = 35;

export default function useNextGate() {
  const positions = useOpenPositions();

  return useMemo(() => {
    if (!positions || positions.length === 0) return null;
    const now = new Date();
    let best = null;

    for (const pos of positions) {
      // Stocks (Action) have no expiry-based gate
      if (!pos?.ex || pos.as === 'Action') continue;
      const dte = dteFromExp(pos.ex, now);
      if (dte == null) continue;

      // DTE45 fires at dte <= 45 (so daysToTrigger = dte - 45 ; >0 = future)
      const daysToDTE45 = dte - GATE_DTE45;
      // SL35 fires at dte <= 35 ; same convention
      const daysToSL35 = dte - GATE_SL35;

      // If DTE45 already passed, SL35 is the next milestone. Else
      // DTE45 is the upcoming one.
      const candidate =
        daysToDTE45 <= 0
          ? { ticker: pos.tk, gateType: 'SL35', daysToTrigger: daysToSL35, dte }
          : { ticker: pos.tk, gateType: 'DTE45', daysToTrigger: daysToDTE45, dte };

      if (!best || Math.abs(candidate.daysToTrigger) < Math.abs(best.daysToTrigger)) {
        best = candidate;
      }
    }

    return best;
  }, [positions]);
}
