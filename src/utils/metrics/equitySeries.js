// @ts-check
// ═══════════════════════════════════════════════════════════════
//  equitySeries — A2a foundation primitive (A2.1 null-safe).
//
//  Builds the equity-curve view that the cluster "equity-curve"
//  metrics (CAGR, Calmar, maxDD%, Sharpe, Sortino, Volatility) all
//  consume. SINGLE source : returns are computed in PERCENT of the
//  reference equity, never in raw USD per trade — this kills the
//  small-capital noise that previously inflated annualised values.
//
//  Conventions :
//    - initialCapital can be null/undefined when the user's
//      cashFlows don't expose deposits AND no `settings.initialCapitalUsd`
//      override is set ("capital unknown" state).
//    - capitalRef = max(safeNum(initialCapital, 0), MIN_CAPITAL_REF_USD).
//      Used as the FLOOR of the per-trade return denominator. Always
//      finite (never NaN) regardless of input type.
//    - equity_i = initialCapital + cumPnL_i  (USD), or 0-anchored when
//      the initial value is unknown.
//    - return_i = pnl_i / max(capitalRef, equity_{i-1}).
//    - maxDD$  : peak-to-trough magnitude in USD (unchanged vs A1).
//    - maxDDPct: per-step worst (ddUsd / peakEquity_at_that_step)×100,
//                bounded [0, 100]. NULL when initialCapital is unknown
//                — without a real equity base, a percentage is dishonest.
// ═══════════════════════════════════════════════════════════════

import { MIN_CAPITAL_REF_USD } from '../significance';
import { safeNum } from '../safeNum';

/**
 * @typedef {Object} EquitySeries
 * @property {number} capitalRef           returns-denominator floor (always finite, ≥ MIN)
 * @property {boolean} hasKnownInitial     true iff a positive initialCapital was supplied
 * @property {number[]} equity             length n+1, equity[0] = initialCapital (or 0)
 * @property {number[]} returns            length n, fractional returns per trade
 * @property {number} maxDD                worst peak-to-trough magnitude in USD (≥ 0)
 * @property {number|null} maxDDPct        worst peak-to-trough as % of peak equity in [0,100] ; null when initialCapital unknown
 */

/**
 * @param {Object} args
 * @param {number|null|undefined} args.initialCapital   USD-equivalent invested capital (null = unknown)
 * @param {number[]} args.pnls                           chronological per-trade pnls
 * @returns {EquitySeries}
 */
export function buildEquitySeries({ initialCapital, pnls }) {
  // A2.1 — explicit "known" flag. Distinguishes "user explicitly funded
  // with $0" (extreme but theoretically possible) from "we don't know
  // how much they funded" (cashFlows section missing). Only the latter
  // should suppress the % drawdown.
  const safeInit = safeNum(initialCapital, null);
  const hasKnownInitial = typeof safeInit === 'number' && safeInit > 0;
  const init = hasKnownInitial ? /** @type {number} */ (safeInit) : 0;

  // Floor is computed with the safe value so undefined/NaN/null can
  // never propagate into Math.max (which would yield NaN). Always ≥ MIN.
  const capitalRef = Math.max(safeNum(safeInit, 0), MIN_CAPITAL_REF_USD);

  /** @type {number[]} */
  const equity = [init];
  /** @type {number[]} */
  const returns = [];

  let cum = 0;
  let peakCum = 0;
  let maxDD = 0;
  let maxDDPct = 0;
  let hasPctSample = false;

  if (Array.isArray(pnls)) {
    for (let i = 0; i < pnls.length; i++) {
      const pnl = pnls[i];
      if (typeof pnl !== 'number' || !Number.isFinite(pnl)) continue;

      const prevEquity = equity[equity.length - 1];
      const denom = Math.max(capitalRef, prevEquity);
      returns.push(denom > 0 ? pnl / denom : 0);

      cum += pnl;
      equity.push(init + cum);
      if (cum > peakCum) peakCum = cum;
      const ddUsd = peakCum - cum;
      if (ddUsd > maxDD) maxDD = ddUsd;

      const peakEquity = init + peakCum;
      if (peakEquity > 0) {
        const ddPct = (ddUsd / peakEquity) * 100;
        if (ddPct > maxDDPct) maxDDPct = ddPct;
        hasPctSample = true;
      }
    }
  }

  // A2.1 — % drawdown only meaningful when the equity base is anchored
  // to a real initialCapital. When it's unknown, equity_i = 0 + cum_i
  // ⇒ a drawdown that takes cum back to 0 from peak reads 100 % (the
  // "Max DD All-Time -100 %" the user saw on the screenshot). Null is
  // the honest sentinel.
  return {
    capitalRef,
    hasKnownInitial,
    equity,
    returns,
    maxDD,
    maxDDPct: hasKnownInitial && hasPctSample ? Math.min(100, maxDDPct) : null,
  };
}
