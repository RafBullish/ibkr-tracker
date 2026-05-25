// @ts-check
// ═══════════════════════════════════════════════════════════════
//  computeRecoveryFactor — net profit / max drawdown.
//
//  Resolves the naming collision flagged by the A0 audit :
//    - src/utils/calculations.js (line 352) already exported
//      `recoveryFactor = realizedPnlUsd / maxDrawdown`.
//    - src/hooks/useTradingMetrics.js (line 118) exported the same
//      formula under the WRONG label `calmar` (= |Σ pnl| / maxDD).
//
//  A1 collapses both onto this primitive. The collision is resolved
//  by renaming useTradingMetrics's misnamed field to `recoveryFactor`
//  and dropping the `Math.abs` (it was hiding the sign of a losing
//  strategy). Convention :
//
//    - maxDD ≤ 0 (no drawdown) → Infinity if netProfit > 0 else 0
//      (matches calculations.js historical fall-through).
//    - non-finite inputs → null.
// ═══════════════════════════════════════════════════════════════

/**
 * @param {Object} args
 * @param {number} args.netProfit  realised net P&L (signed)
 * @param {number} args.maxDD      max drawdown magnitude (≥ 0)
 * @returns {number|null}
 */
export function computeRecoveryFactor({ netProfit, maxDD }) {
  if (typeof netProfit !== 'number' || !Number.isFinite(netProfit)) return null;
  if (typeof maxDD !== 'number' || !Number.isFinite(maxDD)) return null;
  if (!(maxDD > 0)) {
    return netProfit > 0 ? Infinity : 0;
  }
  const rf = netProfit / maxDD;
  return Number.isFinite(rf) ? rf : null;
}
