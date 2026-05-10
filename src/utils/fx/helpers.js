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
const USD_FMT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Convert a USD amount to CHF using the project's rate convention
 * (rate = CHF per USD).
 *
 * @param {number} amountUsd
 * @param {number} rate — CHF per USD
 * @returns {number} amountUsd * rate (NaN propagated; no validation)
 */
export function usdToChf(amountUsd, rate) {
  return amountUsd * rate;
}

/**
 * Convert a CHF amount to USD using the project's rate convention.
 * Throws on rate <= 0 (or NaN) — those are nonsensical inputs that
 * would otherwise produce Infinity/NaN silently.
 *
 * @param {number} amountChf
 * @param {number} rate — CHF per USD, must be > 0
 * @returns {number} amountChf / rate
 */
export function chfToUsd(amountChf, rate) {
  if (!(rate > 0)) {
    throw new Error(`chfToUsd: rate must be > 0, got ${rate}`);
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
