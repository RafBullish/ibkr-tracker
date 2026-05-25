// @ts-check
// ═══════════════════════════════════════════════════════════════
//  computeCalmar — A2b : gated by yearsActive ≥ 1.
//
//  Calmar = annualised CAGR / |Max Drawdown %|. Since A2.2 the CAGR
//  primitive returns a CUMULATIVE percentage when 0 < years < 1 (no
//  annualisation), and an ANNUALISED percentage when years ≥ 1. Feeding
//  a cumulative value into the Calmar ratio breaks comparability with
//  the displayed benchmark (3.0 is an annualised target). A2b therefore
//  requires `yearsActive ≥ 1` before producing a value : under 1 y the
//  return is null, signalling "—" to the display layer.
//
//  Sharpe / Sortino / Vol are unaffected by this gate : they annualise
//  the DISPERSION of returns (valid as soon as obs ≥ 30), not a
//  compound rate, so they remain meaningful below 1 y of history.
// ═══════════════════════════════════════════════════════════════

/**
 * @param {Object} args
 * @param {number|null|undefined} args.cagrPct           CAGR (annualised, percent)
 * @param {number|null|undefined} args.maxDrawdownPct    Max DD magnitude as %, > 0
 * @param {number|null|undefined} args.yearsActive       Elapsed years — required ≥ 1 for an annualised Calmar.
 * @returns {number|null} Calmar ratio, or null when inputs are invalid / years < 1.
 */
export function computeCalmar({ cagrPct, maxDrawdownPct, yearsActive }) {
  // A2b gate : Calmar is annualised by definition. Under 1 y the CAGR
  // we receive is cumulative, not annualised, so the ratio is meaningless.
  if (typeof yearsActive !== 'number' || !Number.isFinite(yearsActive) || yearsActive < 1) {
    return null;
  }
  if (typeof cagrPct !== 'number' || !Number.isFinite(cagrPct)) return null;
  if (typeof maxDrawdownPct !== 'number' || !Number.isFinite(maxDrawdownPct)) return null;
  if (!(maxDrawdownPct > 0)) return null;
  const calmar = cagrPct / maxDrawdownPct;
  return Number.isFinite(calmar) ? calmar : null;
}
