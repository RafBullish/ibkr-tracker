// @ts-check
// ═══════════════════════════════════════════════════════════════
//  computeSortino — A2a : returns-based, gated, no clamp, N_total divisor.
//
//  Replaces the A1 per-trade-PNL$ form. Mirrors computeSharpe except
//  it uses Target Downside Deviation (target=0, N_total divisor —
//  textbook TDD per A1 brief decision #4, kept here).
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
 * @param {number[]} args.returns        fractional per-observation returns
 * @param {number} args.yearsActive       elapsed years covered
 * @param {number} args.capitalRef        REAL initial capital (USD), for the gate
 * @returns {number|null}                 Sortino ratio (uncapped, N_total denominator), or null when gated.
 */
export function computeSortino({ returns, yearsActive, capitalRef }) {
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
  let downsideSqSum = 0;
  for (let i = 0; i < n; i++) {
    const v = returns[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    sum += v;
    if (v < 0) downsideSqSum += v * v;
  }
  const mean = sum / n;
  const dStd = Math.sqrt(downsideSqSum / n); // N_TOTAL
  if (!(dStd > 0)) return null;

  const obsPerYear = n / yearsActive;
  const annFactor = Math.sqrt(Math.min(252, obsPerYear));
  const sortino = (mean / dStd) * annFactor;
  return safeNum(sortino, null);
}
