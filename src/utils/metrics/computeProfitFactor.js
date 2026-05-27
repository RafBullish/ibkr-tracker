// @ts-check
// ═══════════════════════════════════════════════════════════════
//  computeProfitFactor — A2b : gated by lossCount ≥ 3, no Infinity.
//
//  Previous behaviour (A1) : profitFactor was Infinity when grossLoss = 0
//  and grossProfit > 0. Display layers cast that to 999.99 (RiskMetricsRow)
//  or rendered "∞" (RiskMatrix card / Dashboard hero) — masking that
//  the ratio is undefined on a perfect run.
//
//  A2b :
//    - profitFactor = null when lossCount < MIN_LOSSES_PF (3) — too few
//      losses to make the ratio meaningful.
//    - profitFactor = null when grossLoss === 0 (replaces the historical
//      Infinity). Same display intent ("∞" or "—") but at the consumer's
//      discretion, never as a number that pollutes arithmetic.
//    - grossProfit / grossLoss / counts still always exposed so consumers
//      can render the bare ratio sentinel they prefer.
// ═══════════════════════════════════════════════════════════════

import { MIN_LOSSES_PF } from '../significance';

/**
 * @typedef {Object} ProfitFactorResult
 * @property {number|null} profitFactor  PF ratio, null when gated or undefined
 * @property {number} grossProfit         Σ pnl for pnl > 0
 * @property {number} grossLoss           Σ |pnl| for pnl < 0
 * @property {number} winCount            count of pnl > 0
 * @property {number} lossCount           count of pnl < 0
 */

/**
 * @param {number[]} pnls per-trade P&L
 * @returns {ProfitFactorResult}
 */
export function computeProfitFactor(pnls) {
  let grossProfit = 0;
  let grossLoss = 0;
  let winCount = 0;
  let lossCount = 0;
  if (Array.isArray(pnls)) {
    for (let i = 0; i < pnls.length; i++) {
      const pnl = pnls[i];
      if (typeof pnl !== 'number' || !Number.isFinite(pnl)) continue;
      if (pnl > 0) {
        grossProfit += pnl;
        winCount++;
      } else if (pnl < 0) {
        grossLoss += Math.abs(pnl);
        lossCount++;
      }
    }
  }
  // A2b — null when not enough losses to compute a meaningful ratio
  // OR when grossLoss is zero (undefined ratio, was Infinity).
  if (lossCount < MIN_LOSSES_PF || !(grossLoss > 0)) {
    return { profitFactor: null, grossProfit, grossLoss, winCount, lossCount };
  }
  return {
    profitFactor: grossProfit / grossLoss,
    grossProfit,
    grossLoss,
    winCount,
    lossCount,
  };
}
