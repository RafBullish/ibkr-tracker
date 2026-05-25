// ═══════════════════════════════════════════════════════════════
//  SHARED HOOK — Unified trading metrics from closed trades
//
//  A1 refactor :
//    - Win Rate / Profit Factor / Sharpe / Sortino / Max Drawdown are
//      now consumed from src/utils/metrics (single source of truth,
//      identical implementation as src/utils/calculations.js).
//    - The previously mis-labelled `calmar` field (|Σ pnl| / maxDD)
//      is renamed to `recoveryFactor` — see A0 audit, signal #3.
//      The proper Calmar (CAGR / maxDDPct) requires `initialCapital`
//      and `yearsActive` which this hook does NOT receive, so the
//      `calmar` field is no longer emitted here. Consumers that need
//      Calmar (e.g. Analytics) should source it from
//      usePortfolioMetrics().calmarRatio (single canonical value).
//    - Sortino divisor switched to N_TOTAL (textbook Target Downside
//      Deviation) per A1 brief decision #4. Value drops slightly vs
//      the previous N_neg variant — intentional divergence resolution.
//
//  Trades are sorted chronologically ONCE at the top so the equity
//  curve / maxDD is stable regardless of input order — fixes the
//  previous divergence between Dashboard and Analytics.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { tradePnlUsd } from '../utils/calculations';
import { toFloat, roundTo2 } from '../utils/math';
import { roundTo2Safe } from '../utils/safeNum';
import { holdingDays } from '../utils/dates';
import {
  computeMaxDrawdown,
  computeWinRate,
  computeProfitFactor,
  computeRecoveryFactor,
} from '../utils/metrics';

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

  // ── Aggregate sums + extremes + fees + avg hold (one pass) ──
  let totalPnl = 0;
  let bestTrade = -Infinity;
  let worstTrade = Infinity;
  let totalFees = 0;
  let totalDays = 0;
  let daysCount = 0;

  for (let i = 0; i < n; i++) {
    const t = sorted[i];
    const pnl = pnls[i];
    totalPnl += pnl;

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

  // ── Win Rate / Profit Factor / Max Drawdown via single-source primitives ──
  const winData = computeWinRate(pnls);
  const pfData = computeProfitFactor(pnls);
  const ddData = computeMaxDrawdown(pnls);

  const winCount = winData.winCount;
  const lossCount = winData.lossCount;
  const breakevenCount = winData.breakEvenCount;
  const grossProfit = pfData.grossProfit;
  const grossLoss = pfData.grossLoss;
  const profitFactor = pfData.profitFactor;
  const maxDD = ddData.maxDD;

  const decisive = winCount + lossCount;
  // A2b — winRate / lossRate are NULLABLE (gated by decisive ≥ 10).
  // Counts (winCount, lossCount, decisive) always exposed for fraction
  // fallback. Expectancy uses RAW fractions so the dollar value stays
  // meaningful even at low decisive counts.
  const winRate = winData.winRate;
  const lossRate = winData.lossRate;
  const winFracRaw = decisive > 0 ? winCount / decisive : 0;
  const lossFracRaw = decisive > 0 ? lossCount / decisive : 0;
  const avgWin = winCount > 0 ? grossProfit / winCount : 0;
  const avgLoss = lossCount > 0 ? grossLoss / lossCount : 0;
  const avgHold = daysCount > 0 ? totalDays / daysCount : 0;

  // Omega at threshold 0 equals gross gains / gross losses — same
  // formula as profit factor, but null (not 0) when both sides empty.
  const omega = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null;

  const expectancy = decisive > 0 ? winFracRaw * avgWin - lossFracRaw * avgLoss : 0;
  const expectancyR =
    avgLoss > 0 && Number.isFinite(expectancy / avgLoss) ? expectancy / avgLoss : null;

  // ── Sharpe / Sortino — null at this layer (A2a) ──
  // The A2a primitives need `returns` (fractional, via buildEquitySeries)
  // + `yearsActive` + `capitalRef` to compute. None of these are inputs
  // to this hook (it only sees closedTrades + fxRate). Emitting null is
  // honest. Consumers should source Sharpe/Sortino from
  // `usePortfolioMetrics().sharpeRatio` / `.sortinoRatio` — same single
  // canonical pipeline as Calmar.
  const sharpe = null;
  const sortino = null;

  // ── Recovery Factor (replaces the mis-named "calmar" field) ──
  // OLD: calmar = |Σ pnl| / maxDD (a recovery factor, mislabelled).
  // NEW: recoveryFactor = Σ pnl / maxDD via the canonical primitive.
  // Note: dropping the historical Math.abs() means a losing portfolio
  // now reports a negative recovery factor instead of a positive one.
  // Documented divergence resolution per A1 brief decision #5.
  const recoveryFactor = computeRecoveryFactor({ netProfit: totalPnl, maxDD });

  // A2b — Kelly uses the RAW win fraction, not the nullable winRate.
  const kellyPct =
    avgLoss > 0 && avgWin > 0 && winFracRaw > 0
      ? (winFracRaw - (1 - winFracRaw) * (avgLoss / avgWin)) * 100
      : null;

  return Object.freeze({
    totalPnl: roundTo2(totalPnl),
    totalPnlCount: n,
    winCount,
    lossCount,
    breakevenCount,
    decisive,
    // A2b — winRate / lossRate nullable when decisive < MIN_DECISIVE_WINRATE.
    winRate: roundTo2Safe(winRate, null),
    lossRate: roundTo2Safe(lossRate, null),
    avgWin: roundTo2(avgWin),
    avgLoss: roundTo2(avgLoss),
    avgHold,
    bestTrade: roundTo2(bestTrade),
    worstTrade: roundTo2(worstTrade),
    expectancy: roundTo2(expectancy),
    expectancyR: expectancyR != null ? roundTo2(expectancyR) : null,
    // A2b — profitFactor nullable when lossCount<3 or grossLoss=0.
    // The historical Infinity is gone : storage layer never emits it now.
    profitFactor: roundTo2Safe(profitFactor, null),
    omega: omega === Infinity ? Infinity : omega == null ? null : roundTo2(omega),
    sharpe,
    sortino,
    // `calmar` removed — see header. Use usePortfolioMetrics().calmarRatio.
    recoveryFactor:
      recoveryFactor === Infinity
        ? Infinity
        : recoveryFactor == null
          ? null
          : roundTo2(recoveryFactor),
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
