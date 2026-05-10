// ═══════════════════════════════════════════════════════════════
//  useRiskMatrix v4 brick 4 — adapter store → 14-metric object
//
//  Fournit l'objet consommé par <RiskMatrix /> sur la route
//  /dashboard. La playground passe l'objet calculé via
//  computeRiskMatrix() inline avec la fixture, pas via ce hook.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import {
  useClosedTrades,
  useOpenPositions,
  useCashFlows,
  useJournalEntries,
  useSettings,
} from '../store/useStore';
import { computeRiskMatrix } from '../utils/risk';

export function useRiskMatrix() {
  const closedTrades = useClosedTrades();
  const openPositions = useOpenPositions();
  const cashFlows = useCashFlows();
  const journalEntries = useJournalEntries();
  const settings = useSettings();

  return useMemo(
    () => computeRiskMatrix({ closedTrades, openPositions, cashFlows, journalEntries, settings }),
    [closedTrades, openPositions, cashFlows, journalEntries, settings]
  );
}

export default useRiskMatrix;
