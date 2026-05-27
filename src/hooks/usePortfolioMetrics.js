// ═══════════════════════════════════════════════════════════════
//  SHARED HOOK — Portfolio metrics computed once for all consumers
//
//  Uses granular zustand selectors (useOpenPositions, etc.) instead of
//  the composite `{ state }` bag exposed by `useStore()`. This matters
//  because the composite object is reconstructed on every render, which
//  would invalidate any `useMemo([state])` consumer. Granular selectors
//  return stable references — the memo only recomputes when a slice
//  actually changes.
//
//  Prevents duplicate calculatePortfolioMetrics() calls in Dashboard +
//  Header + CockpitHeader + Positions.
//
//  useKPIs is kept as a backwards-compatibility shim over the new
//  useTradingMetrics hook — it reshapes the unified metrics into the
//  legacy computeKPIs shape so Header and other legacy consumers keep
//  working unchanged.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useOpenPositions, useClosedTrades, useCashFlows, useSettings } from '../store/useStore';
import { calculatePortfolioMetrics } from '../utils/calculations';
import { useTradingMetrics } from './useTradingMetrics';

export function usePortfolioMetrics() {
  const openPositions = useOpenPositions();
  const closedTrades = useClosedTrades();
  const cashFlows = useCashFlows();
  const settings = useSettings();

  return useMemo(
    () => calculatePortfolioMetrics({ openPositions, closedTrades, cashFlows, settings }),
    [openPositions, closedTrades, cashFlows, settings]
  );
}

/**
 * Legacy KPI shape — thin shim over useTradingMetrics. Keep the output
 * identical to the old computeKPIs return value so that Header.jsx and
 * any other legacy consumer remain untouched.
 */
export function useKPIs() {
  const closedTrades = useClosedTrades();
  const metrics = usePortfolioMetrics();
  const tradingMetrics = useTradingMetrics(closedTrades, metrics.liveRate);

  return useMemo(() => {
    if (!tradingMetrics) {
      // A2b — empty-state : nullable fields stay null so consumers don't
      // misread a synthetic 0 as "zero win rate" / "PF of zero". Counts
      // remain 0 because that's their real value when no trades exist.
      return {
        totalPnL: 0,
        winRate: null,
        profitFactor: null,
        expectancy: 0,
        avgWinner: 0,
        avgLoser: 0,
        largestWin: 0,
        largestLoss: 0,
        totalTrades: 0,
        winCount: 0,
        lossCount: 0,
        avgHoldingDays: 0,
        maxDrawdown: 0,
      };
    }
    return {
      totalPnL: tradingMetrics.totalPnl,
      // A2b — these two are now nullable (gated by useTradingMetrics).
      winRate: tradingMetrics.winRate,
      profitFactor: tradingMetrics.profitFactor,
      expectancy: tradingMetrics.expectancy,
      avgWinner: tradingMetrics.avgWin,
      avgLoser: tradingMetrics.avgLoss,
      largestWin: tradingMetrics.bestTrade,
      largestLoss: tradingMetrics.worstTrade,
      totalTrades: tradingMetrics.totalPnlCount,
      winCount: tradingMetrics.winCount,
      lossCount: tradingMetrics.lossCount,
      avgHoldingDays: Math.round(tradingMetrics.avgHold),
      maxDrawdown: tradingMetrics.maxDrawdown,
      grossProfit: tradingMetrics.grossProfit,
      grossLoss: tradingMetrics.grossLoss,
    };
  }, [tradingMetrics]);
}
