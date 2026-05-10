// ═══════════════════════════════════════════════════════════════
//  SHARED HOOK — Unified trading metrics from closed trades
//
//  Single source of truth for every metric derived from closedTrades +
//  fxRate: aggregates (counts, sums), ratios (winRate, PF, expectancy),
//  risk-adjusted (Sharpe, Sortino, Calmar, Omega, Kelly), and drawdown.
//
//  Trades are sorted chronologically ONCE at the top so the equity
//  curve / maxDD is stable regardless of input order — fixes the
//  previous divergence between Dashboard and Analytics.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { tradePnlUsd } from '../utils/calculations';
import { toFloat, roundTo2 } from '../utils/math';
import { holdingDays } from '../utils/dates';

/**
 * Pure computation — no React dependency. Exported for direct testing
 * and for the useKPIs shim which needs a synchronous call.
 *
 * @param {Array} closedTrades — tracker-shaped closed trades
 * @param {number} fxRate — live USD/CHF rate, defaults to 1
 * @returns {Object|null} Frozen metrics object, or null when closedTrades is empty.
 */
export function calculateTradingMetrics(closedTrades, fxRate) {
  if (!closedTrades || closedTrades.length === 0) return null;

  const lr = fxRate || 1;
  const sorted = closedTrades.slice().sort((a, b) => (a.do || '').localeCompare(b.do || ''));
  const pnls = sorted.map((t) => tradePnlUsd(t, lr));
  const n = pnls.length;

  let totalPnl = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let winCount = 0,
    lossCount = 0,
    breakevenCount = 0;
  let bestTrade = -Infinity,
    worstTrade = Infinity;
  let totalFees = 0;
  let totalDays = 0,
    daysCount = 0;
  let cum = 0,
    peak = 0,
    maxDD = 0;

  for (let i = 0; i < n; i++) {
    const t = sorted[i];
    const pnl = pnls[i];
    totalPnl += pnl;

    cum += pnl;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) maxDD = dd;

    if (pnl > 0) {
      winCount++;
      grossProfit += pnl;
    } else if (pnl < 0) {
      lossCount++;
      grossLoss += Math.abs(pnl);
    } else {
      breakevenCount++;
    }

    if (pnl > bestTrade) bestTrade = pnl;
    if (pnl < worstTrade) worstTrade = pnl;

    totalFees += toFloat(t.fi) + toFloat(t.fo);

    if (t.di && t.do) {
      const d = holdingDays(t.di, t.do);
      if (d >= 0) {
        totalDays += d;
        daysCount++;
      }
    }
  }

  const decisive = winCount + lossCount;
  const winRate = decisive > 0 ? (winCount / decisive) * 100 : 0;
  const lossRate = decisive > 0 ? (lossCount / decisive) * 100 : 0;
  const avgWin = winCount > 0 ? grossProfit / winCount : 0;
  const avgLoss = lossCount > 0 ? grossLoss / lossCount : 0;
  const avgHold = daysCount > 0 ? totalDays / daysCount : 0;

  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  // Omega at threshold 0 equals gross gains / gross losses — same
  // formula as profit factor, but null (not 0) when both sides empty.
  const omega = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null;

  const expectancy = decisive > 0 ? (winRate / 100) * avgWin - (lossRate / 100) * avgLoss : 0;
  const expectancyR =
    avgLoss > 0 && Number.isFinite(expectancy / avgLoss) ? expectancy / avgLoss : null;

  // Sharpe / Sortino — annualized approximation, capped for display.
  const mean = totalPnl / n;
  const variance = pnls.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);
  const downside = pnls.filter((v) => v < 0);
  const dStd = downside.length
    ? Math.sqrt(downside.reduce((s, v) => s + v * v, 0) / downside.length)
    : 0;
  const annFactor = Math.sqrt(Math.min(252, Math.max(20, n)));

  const rawSharpe = stddev > 0 ? (mean / stddev) * annFactor : null;
  const rawSortino = dStd > 0 ? (mean / dStd) * annFactor : null;
  const sharpe =
    rawSharpe != null && Number.isFinite(rawSharpe) ? Math.max(-5, Math.min(10, rawSharpe)) : null;
  const sortino =
    rawSortino != null && Number.isFinite(rawSortino)
      ? Math.max(-5, Math.min(10, rawSortino))
      : null;

  const calmar = maxDD > 0 ? Math.abs(totalPnl) / maxDD : null;

  const winRateFrac = winRate / 100;
  const kellyPct =
    avgLoss > 0 && avgWin > 0 ? (winRateFrac - (1 - winRateFrac) * (avgLoss / avgWin)) * 100 : null;

  return Object.freeze({
    totalPnl: roundTo2(totalPnl),
    totalPnlCount: n,
    winCount,
    lossCount,
    breakevenCount,
    winRate: roundTo2(winRate),
    lossRate: roundTo2(lossRate),
    avgWin: roundTo2(avgWin),
    avgLoss: roundTo2(avgLoss),
    avgHold,
    bestTrade: roundTo2(bestTrade),
    worstTrade: roundTo2(worstTrade),
    expectancy: roundTo2(expectancy),
    expectancyR: expectancyR != null ? roundTo2(expectancyR) : null,
    profitFactor: profitFactor === Infinity ? Infinity : roundTo2(profitFactor),
    omega: omega === Infinity ? Infinity : omega == null ? null : roundTo2(omega),
    sharpe,
    sortino,
    calmar,
    kellyPct: kellyPct != null && Number.isFinite(kellyPct) ? kellyPct : null,
    maxDrawdown: roundTo2(maxDD),
    totalFees: roundTo2(totalFees),
    grossProfit: roundTo2(grossProfit),
    grossLoss: roundTo2(grossLoss),
  });
}

/** React hook wrapper — memoized on inputs, returns null for empty trades. */
export function useTradingMetrics(closedTrades, fxRate) {
  return useMemo(() => calculateTradingMetrics(closedTrades, fxRate), [closedTrades, fxRate]);
}
