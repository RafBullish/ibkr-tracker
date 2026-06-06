// ═══════════════════════════════════════════════════════════════
//  FX HELPERS — pure, React-free, side-effect-free.
//  Numeric primitives + locale-aware formatters.
//
//  CONVENTION: rate = CHF per USD. So chf = usd * rate, usd = chf / rate.
// ═══════════════════════════════════════════════════════════════

// TODO(s2a-phase2): consolidate with src/utils/format.js — the formatters
// here are PREFIX-FREE (Intl-only); format.js variants prepend "$" / "CHF ".
// Phase 2 (commits 10-11) migrates UI sites to these and removes the
// format.js duplicates.

const CHF_FMT = new Intl.NumberFormat('de-CH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const USD_FMT = new Intl.NumberFormat('de-CH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * A3a — Central FX rate validity gate.
 *
 * Returns true iff `rate` is a finite number within sane USD/CHF bounds.
 * Bounds picked so that the gate catches the canonical failure modes
 * (rate=undefined, rate=0, rate=NaN, rate=Infinity, exotic rate=0.0001)
 * but never rejects a plausible market rate. Historical USD/CHF has
 * traded in [0.7, 1.4]; we accept (0.01, 100) for safety.
 *
 * Any consumer that derives a CHF figure from a USD value MUST gate on
 * this helper. The A0 / A2.1 audits flagged `liveRate || 1` fallbacks
 * as the primary source of silent "1 USD = 1 CHF" bugs.
 *
 * @param {*} rate
 * @returns {boolean}
 */
export function isValidFxRate(rate) {
  return (
    typeof rate === 'number' &&
    Number.isFinite(rate) &&
    rate > 0.01 &&
    rate < 100
  );
}

/**
 * Convert a USD amount to CHF using the project's rate convention
 * (rate = CHF per USD).
 *
 * A3a — returns `null` when the rate fails {@link isValidFxRate} or when
 * the amount is non-finite. The previous "silent NaN propagation"
 * behaviour was a silent corruption vector for downstream display logic
 * that did `.toFixed()` on the result.
 *
 * @param {number} amountUsd
 * @param {number} rate — CHF per USD
 * @returns {number|null}
 */
export function usdToChf(amountUsd, rate) {
  if (typeof amountUsd !== 'number' || !Number.isFinite(amountUsd)) return null;
  if (!isValidFxRate(rate)) return null;
  return amountUsd * rate;
}

/**
 * Convert a CHF amount to USD using the project's rate convention.
 * Throws on rate that fails {@link isValidFxRate} — those are nonsensical
 * inputs that would otherwise produce Infinity / NaN silently.
 *
 * @param {number} amountChf
 * @param {number} rate — CHF per USD, must pass isValidFxRate
 * @returns {number} amountChf / rate
 */
export function chfToUsd(amountChf, rate) {
  if (!isValidFxRate(rate)) {
    throw new Error(`chfToUsd: rate must be a valid FX rate, got ${rate}`);
  }
  return amountChf / rate;
}

/**
 * Format a CHF amount with Swiss conventions (apostrophe thousand
 * separator, dot decimal, 2 fraction digits). PREFIX-FREE — does NOT
 * prepend "CHF ". For the prefixed variant see src/utils/format.js.
 *
 * @param {number} amount
 * @returns {string} e.g. "1'182.00"
 */
export function formatChf(amount) {
  // ICU on Node 18+ uses U+2019 (right single quotation mark) as the
  // de-CH thousand separator. Normalise to ASCII apostrophe so output is
  // stable across environments. On Node 22 ICU already returns ASCII;
  // this replace is defensive for older / different ICU builds.
  return CHF_FMT.format(amount).replace(/’/g, "'");
}

/**
 * Format a USD amount with US conventions (comma thousand separator,
 * dot decimal, 2 fraction digits). PREFIX-FREE — does NOT prepend "$".
 * For the prefixed variant see src/utils/format.js.
 *
 * @param {number} amount
 * @returns {string} e.g. "1,510.24"
 */
export function formatUsd(amount) {
  return USD_FMT.format(amount);
}

/**
 * Format an FX rate to exactly 4 decimal places.
 *
 * @param {number} rate
 * @returns {string} e.g. "0.7825" or "0.7800"
 */
export function formatRate(rate) {
  return Number(rate).toFixed(4);
}
