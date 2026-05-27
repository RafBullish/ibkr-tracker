// @ts-check
// ═══════════════════════════════════════════════════════════════
//  safeNum — guarded numeric helpers at metric boundaries.
//
//  The pipeline tolerates a few sources of corrupted numbers :
//  Infinity from divisions by 0 (profit factor with no losers,
//  recovery factor with no drawdown), NaN from arithmetic on
//  partially-typed CSV rows, undefined when a metric is undefined
//  because its inputs are absent. Wrapping the OUTPUT of each
//  metric in these helpers ensures the UI receives either a
//  finite number or an explicit sentinel (null by default).
// ═══════════════════════════════════════════════════════════════

/**
 * Returns `v` when it is a finite number; otherwise returns `fallback`.
 * Catches NaN, ±Infinity, and any non-number input (strings, objects,
 * undefined, null). Use this at metric output boundaries to normalise
 * downstream tone / display logic.
 *
 * @template T
 * @param {*} v
 * @param {T} [fallback]
 * @returns {number|T}
 */
export function safeNum(v, fallback = /** @type {*} */ (null)) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * Rounds `v` to 2 decimals using the EPSILON trick (matches the
 * historical `roundTo2` semantics in src/utils/math.js), but returns
 * `fallback` for non-finite inputs instead of producing NaN. Use this
 * at metric output boundaries to harden against Infinity / NaN bleed.
 *
 * @template T
 * @param {*} v
 * @param {T} [fallback]
 * @returns {number|T}
 */
export function roundTo2Safe(v, fallback = /** @type {*} */ (null)) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
