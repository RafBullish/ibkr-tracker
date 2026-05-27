// @ts-check
// ═══════════════════════════════════════════════════════════════
//  computeSharpe — A2a : new signature, returns-based, gated, no clamp.
//
//  Previous behaviour (A1) : input was per-trade PNL$, annFactor =
//  sqrt(min(252, max(20, n))), hard-clamped to [-5, +10]. Two faults :
//   (a) PNL$ as the noise unit inflates the Sharpe at small capital ;
//   (b) the clamp masked the explosion instead of admitting "no signal".
//
//  A2a behaviour :
//    - INPUT : `returns` (fractional, from buildEquitySeries — never $).
//    - mean(r) / std(r) × sqrt(min(252, n / yearsActive)).
//    - NO clamp. The gate IS the honesty signal.
//    - Significance gate :
//        obs >= MIN_OBS_RATIO (30)
//        years >= MIN_YEARS_ANNUALIZED (0.25)
//        capitalRef >= MIN_CAPITAL_REF_USD (500)
//      Below any threshold → null.
//    - stddev = 0 → null (no signal possible).
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
 * @returns {number|null}                 Sharpe ratio (uncapped), or null when gated.
 */
export function computeSharpe({ returns, yearsActive, capitalRef }) {
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
  if (!(std > 0)) return null;

  const obsPerYear = n / yearsActive;
  const annFactor = Math.sqrt(Math.min(252, obsPerYear));
  const sharpe = (mean / std) * annFactor;
  return safeNum(sharpe, null);
}
