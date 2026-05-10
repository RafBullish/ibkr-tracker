// ═══════════════════════════════════════════════════════════════
//  useEquityHistory v4 brick 3 — derive equity curve from real store
//
//  Wraps `computeEquityCurve` from utils/calculations.js so the
//  Master Chart can consume the same shape as fixture.equityCurve :
//  Array<{ date: 'YYYY-MM-DD', equity: number }>.
//
//  Granularity = per-trade-close (the existing util emits one point
//  per closed trade, not daily). Pour le scope brick 3, c'est OK :
//  les 30 trades de la fixture donnent une courbe lisible et le
//  vrai compte (1 BAC C58 ouvert, 0 closed) rendra correctement
//  vide. Si on a besoin de daily granularity sur le real store
//  plus tard, on ajoutera un projecteur en interpolant flat entre
//  trade dates — ce sera une amélioration, pas une dette.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useClosedTrades, useSettings } from '../store/useStore';
import { computeEquityCurve } from '../utils/calculations';

/**
 * @returns {Array<{ date: string, equity: number, pnl: number, drawdown: number }>}
 *          Trie par date croissante. Vide si pas de closed trades.
 */
export function useEquityHistory() {
  const closedTrades = useClosedTrades();
  const settings = useSettings();
  const liveRate = settings?.liveRate || 1;

  return useMemo(() => computeEquityCurve(closedTrades, liveRate), [closedTrades, liveRate]);
}

export default useEquityHistory;
