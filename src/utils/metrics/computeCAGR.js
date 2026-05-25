// @ts-check
// ═══════════════════════════════════════════════════════════════
//  computeCAGR — A2.2 : annualised above 1 y, CUMULATIVE below.
//
//  History :
//    A1   — textbook geometric formula, no guard. 28 888 % explosions
//           at small years (years << 1 ⇒ exponent 1/years explodes).
//    A2a  — significance gate { trades>=20, years>=0.25, capital>=500 }.
//           Years<0.25 ⇒ null. Cured the 28 888 % but silenced any value
//           for a real account at 0.4 y of history.
//    A2.2 — drop the years lower bound for the CUMULATIVE branch :
//           if 0 < years < 1, return the simple cumulative return
//           (end/init - 1) × 100 — no annualisation, no exponential
//           extrapolation. The display layer reads `cagrMode` to switch
//           the card label between "CAGR" (annualised) and "Cumulé".
//
//  Significance gate (capital + trades) still required in BOTH branches.
//  Years is checked > 0 in the cumulative branch and >= 1 in the
//  annualised branch.
// ═══════════════════════════════════════════════════════════════

import {
  significanceCheck,
  MIN_TRADES_ANNUALIZED,
  MIN_CAPITAL_REF_USD,
} from '../significance';
import { safeNum } from '../safeNum';

/**
 * @param {Object} args
 * @param {number|null|undefined} args.initialCapital  USD-equivalent
 * @param {number|null|undefined} args.endCapital      USD-equivalent (init + realized pnl)
 * @param {number} args.yearsActive                    elapsed years between first / last close
 * @param {number} args.tradesCount                    closed-trade count
 * @returns {number|null}  percentage value, or null when gate fails / inputs invalid.
 *
 * Display layer should also read `cagrMode(yearsActive)` for the label
 * "CAGR" (annualised) vs "Cumulé" (under 1 y).
 */
export function computeCAGR({ initialCapital, endCapital, yearsActive, tradesCount }) {
  // Capital + trades gate. NOT a years gate — years is checked separately
  // because the cumulative branch removes the "years >= 0.25" requirement.
  const gate = significanceCheck(
    { trades: tradesCount, capitalRef: initialCapital },
    {
      trades: MIN_TRADES_ANNUALIZED,
      capitalRef: MIN_CAPITAL_REF_USD,
    }
  );
  if (!gate.ok) return null;

  if (
    typeof initialCapital !== 'number' ||
    typeof endCapital !== 'number' ||
    typeof yearsActive !== 'number' ||
    !(initialCapital > 0) ||
    !(endCapital > 0) ||
    !(yearsActive > 0)
  ) {
    return null;
  }

  if (yearsActive >= 1) {
    const cagr = (Math.pow(endCapital / initialCapital, 1 / yearsActive) - 1) * 100;
    return safeNum(cagr, null);
  }
  // Cumulative branch — 0 < years < 1. NO annualisation.
  const cumul = (endCapital / initialCapital - 1) * 100;
  return safeNum(cumul, null);
}

/**
 * Pure helper for the display layer : returns the rendering mode the
 * caller should use for the value coming back from computeCAGR.
 *
 * @param {number|null|undefined} yearsActive
 * @returns {'annualised'|'cumulative'|null}
 */
export function cagrMode(yearsActive) {
  if (typeof yearsActive !== 'number' || !Number.isFinite(yearsActive) || !(yearsActive > 0)) {
    return null;
  }
  return yearsActive >= 1 ? 'annualised' : 'cumulative';
}
