// @ts-check
// ═══════════════════════════════════════════════════════════════
//  computeMaxDrawdown — canonical running-peak drawdown on a P&L
//  series. Operates on per-trade P&L in CHRONOLOGICAL order.
//
//  Identical algorithm previously duplicated in :
//    - src/utils/calculations.js   (closed trades, lines 256-266)
//    - src/hooks/useTradingMetrics.js (lines 46-57)
//    - src/utils/calculations.js   (computeEquityCurve, lines 483-501)
//    - src/utils/risk.js           (maxDrawdownYTDFromEquity, lines 65-86)
//    - src/components/dashboard/RiskMatrix.jsx (ddInfo, peak-tracking
//                                                lines 589-613)
//
//  A1 unifies the first two call sites onto this primitive. The
//  equity-curve and YTD variants stay as their own helpers because
//  they need additional outputs (per-point drawdown, YTD slice).
//
//  Equity = running cumulative P&L (starts at 0). The "maxDD" returned
//  is in the same unit as the input pnls (USD typically). Sign is
//  always ≥ 0 (magnitude of the worst peak-to-trough swing).
// ═══════════════════════════════════════════════════════════════

/**
 * @param {number[]} pnls per-trade P&L in chronological order
 * @returns {{ maxDD: number, peak: number, cum: number }}
 *   maxDD : worst peak-minus-trough magnitude observed (≥ 0)
 *   peak  : highest running cumulative P&L observed
 *   cum   : final cumulative P&L
 */
export function computeMaxDrawdown(pnls) {
  let cum = 0;
  let peak = 0;
  let maxDD = 0;
  if (!Array.isArray(pnls)) return { maxDD, peak, cum };
  for (let i = 0; i < pnls.length; i++) {
    const pnl = pnls[i];
    if (typeof pnl !== 'number' || !Number.isFinite(pnl)) continue;
    cum += pnl;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) maxDD = dd;
  }
  return { maxDD, peak, cum };
}
