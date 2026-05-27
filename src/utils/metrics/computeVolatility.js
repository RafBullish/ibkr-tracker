// @ts-check
// ═══════════════════════════════════════════════════════════════
//  computeVolatility — A2a new primitive (didn't exist in A1).
//
//  Replaces src/utils/risk.js :: vol30dAnnualized which mis-treated
//  per-trade equity steps as daily samples AND divided by
//  capitalBase (initialCapital, often tiny → inflated %).
//
//  New formula : std(returns) × sqrt(min(252, n / yearsActive)) × 100.
//  Returns are PERCENT (fraction) values produced by
//  buildEquitySeries — capital noise is dampened at source.
//
//  Annualisation rate is "observations per year, capped at daily
//  (252)" — matches the brief decision #7. The "30-day window"
//  approach is retired ; the field is renamed `volAnnPct` everywhere.
//
//  Significance gate identical to computeSharpe / computeSortino :
//    obs >= MIN_OBS_RATIO (30)
//    years >= MIN_YEARS_ANNUALIZED (0.25)
//    capitalRef >= MIN_CAPITAL_REF_USD (500)
//  Below any threshold → null.
// ═══════════════════════════════════════════════════════════════

import {
  significanceCheck,
  MIN_OBS_RATIO,
  MIN_YEARS_ANNUALIZED,
  MIN_CAPITAL_REF_USD,
} from '../significance';
import { safeNum } from '../safeNum';

/**
 * @param {Object} args
 * @param {number[]} args.returns        fractional returns (per observation)
 * @param {number} args.yearsActive       elapsed years covered by the returns
 * @param {number} args.capitalRef        reference capital for significance gating (the REAL initialCapital, not the max-padded denom)
 * @returns {number|null}                 annualised volatility as a percentage, or null when gated
 */
export function computeVolatility({ returns, yearsActive, capitalRef }) {
  const n = Array.isArray(returns) ? returns.length : 0;
  const gate = significanceCheck(
    { obs: n, years: yearsActive, capitalRef },
    {
      obs: MIN_OBS_RATIO,
      years: MIN_YEARS_ANNUALIZED,
      capitalRef: MIN_CAPITAL_REF_USD,
    }
  );
  if (!gate.ok) return null;
  if (!(typeof yearsActive === 'number' && yearsActive > 0)) return null;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = returns[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    sum += v;
  }
  const mean = sum / n;
  let vsum = 0;
  for (let i = 0; i < n; i++) vsum += (returns[i] - mean) ** 2;
  const std = Math.sqrt(vsum / n);

  const obsPerYear = n / yearsActive;
  const annFactor = Math.sqrt(Math.min(252, obsPerYear));
  const vol = std * annFactor * 100;
  return safeNum(vol, null);
}
