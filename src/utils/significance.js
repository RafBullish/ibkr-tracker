// @ts-check
// ═══════════════════════════════════════════════════════════════
//  significance — minimum-sample thresholds for risk-adjusted metrics.
//
//  Exports the constants + a pure helper. The helper IS NOT WIRED
//  into the metric pipeline in A1 — A2 will adopt it uniformly so
//  every consumer applies the same gating rule.
//
//  Numbers come from the A0 audit recommendation : a metric that
//  needs annualisation (CAGR, Sharpe, Sortino, Calmar) is suspect
//  below 0.25 year of history or below 20 trades. A win-rate or
//  profit-factor displayed off a handful of decisive trades is
//  misleading. A capital-relative ratio (REALIZED %, vol30d %)
//  loses meaning under ~500 USD of reference capital because the
//  per-trade noise dominates the denominator.
// ═══════════════════════════════════════════════════════════════

/** Minimum closed-trade count below which annualised ratios are unreliable. */
export const MIN_TRADES_ANNUALIZED = 20;

/** Minimum elapsed years below which annualised compounding explodes. */
export const MIN_YEARS_ANNUALIZED = 0.25;

/** Minimum observation count for any per-observation ratio (Sharpe-like). */
export const MIN_OBS_RATIO = 30;

/** Minimum losing trades for a meaningful Profit Factor. */
export const MIN_LOSSES_PF = 3;

/** Minimum reference capital (USD) below which % returns are dominated by noise. */
export const MIN_CAPITAL_REF_USD = 500;

/** Minimum decisive trades (win+loss, excl. break-even) for a meaningful Win Rate. */
export const MIN_DECISIVE_WINRATE = 10;

/**
 * @typedef {Object} SignificanceInputs
 * @property {number} [trades]      closed-trade count
 * @property {number} [years]       elapsed years between first and last trade
 * @property {number} [obs]         observation count (returns, daily samples, …)
 * @property {number} [capitalRef]  reference capital in USD
 * @property {number} [losses]      losing-trade count
 * @property {number} [decisive]    decisive-trade count (winCount + lossCount)
 */

/**
 * @typedef {Object} SignificanceRequirements
 * @property {number} [trades]
 * @property {number} [years]
 * @property {number} [obs]
 * @property {number} [capitalRef]
 * @property {number} [losses]
 * @property {number} [decisive]
 */

/**
 * Returns `{ ok, reason }` indicating whether the supplied inputs
 * meet every listed requirement. Each requirement is a minimum
 * acceptable value; any input below its requirement causes
 * `ok=false` with a human-readable reason string. Inputs not present
 * in `requirements` are not validated.
 *
 * NOT WIRED INTO METRIC OUTPUT IN A1. Provided here so A2 can adopt
 * it without re-deriving the same gating in every site.
 *
 * @param {SignificanceInputs} inputs
 * @param {SignificanceRequirements} requirements
 * @returns {{ ok: boolean, reason: string|null }}
 */
export function significanceCheck(inputs, requirements) {
  const i = inputs || {};
  const r = requirements || {};

  if (r.trades != null && (i.trades == null || i.trades < r.trades)) {
    return { ok: false, reason: `n_trades<${r.trades} (got ${i.trades ?? 'n/a'})` };
  }
  if (r.years != null && (i.years == null || i.years < r.years)) {
    return { ok: false, reason: `years<${r.years} (got ${i.years ?? 'n/a'})` };
  }
  if (r.obs != null && (i.obs == null || i.obs < r.obs)) {
    return { ok: false, reason: `n_obs<${r.obs} (got ${i.obs ?? 'n/a'})` };
  }
  if (r.capitalRef != null && (i.capitalRef == null || i.capitalRef < r.capitalRef)) {
    return { ok: false, reason: `capitalRef<${r.capitalRef} (got ${i.capitalRef ?? 'n/a'})` };
  }
  if (r.losses != null && (i.losses == null || i.losses < r.losses)) {
    return { ok: false, reason: `n_losses<${r.losses} (got ${i.losses ?? 'n/a'})` };
  }
  if (r.decisive != null && (i.decisive == null || i.decisive < r.decisive)) {
    return { ok: false, reason: `n_decisive<${r.decisive} (got ${i.decisive ?? 'n/a'})` };
  }
  return { ok: true, reason: null };
}
