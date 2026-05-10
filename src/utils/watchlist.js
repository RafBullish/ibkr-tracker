// ═══════════════════════════════════════════════════════════════
//  WATCHLIST UTILS v4 brick 7 — purs
//
//  Helpers pour le module Watchlist :
//    - compactVolume   : 1234567 → '1.2M' (utile aussi ailleurs)
//    - sortByTicker    : sort alphabétique stable
// ═══════════════════════════════════════════════════════════════

/**
 * Formate un nombre brut en short notation (K / M / B).
 * Cap 2 décimales, supprime le trailing zero.
 *
 * @param {number} n
 * @returns {string} ex 1234 → '1.2K', 1500000 → '1.5M', 800 → '800', 0 → '0'
 */
export function compactVolume(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs < 1000) return `${sign}${Math.round(abs)}`;
  if (abs < 1_000_000) return `${sign}${trim(abs / 1000, 1)}K`;
  if (abs < 1_000_000_000) return `${sign}${trim(abs / 1_000_000, 1)}M`;
  return `${sign}${trim(abs / 1_000_000_000, 1)}B`;
}

/**
 * Tri stable alphabétique sur tk.
 * @param {Array} tickers
 */
export function sortByTicker(tickers) {
  return (tickers || []).slice().sort((a, b) => (a.tk || '').localeCompare(b.tk || ''));
}

/**
 * Trim numéral : 1.20 → '1.2', 1.00 → '1', 1.23 → '1.2' (1 décimale).
 */
function trim(v, digits) {
  return Number(v.toFixed(digits)).toString();
}
