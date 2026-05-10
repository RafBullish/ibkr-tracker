// ═══════════════════════════════════════════════════════════════
//  EARNINGS UTILS v4 brick 7 — purs
//
//  Helpers pour le module Earnings J+7 :
//    - filterByDte           : filtre les events par DTE max
//    - sortByDate            : tri ASC sur date
//    - compactRevenue        : 28_500_000_000 → '$28.5B'
//    - earningsTimeLabel     : 'BMO' / 'AMC' / 'DMT' (déjà uppercase
//                              dans la fixture, ce wrapper accepte
//                              les variantes lowercase et défaut)
// ═══════════════════════════════════════════════════════════════

/**
 * @param {Array<{dte: number}>} events
 * @param {number} maxDte
 */
export function filterByDte(events, maxDte) {
  if (!Array.isArray(events) || events.length === 0) return [];
  return events.filter((e) => Number.isFinite(e.dte) && e.dte >= 0 && e.dte <= maxDte);
}

/**
 * Tri stable ascendant par date (string ISO).
 */
export function sortByDate(events) {
  return (events || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

/**
 * Format compact revenue : 28_500_000_000 → '$28.5B'.
 */
export function compactRevenue(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs < 1_000_000) return `${sign}$${Math.round(abs / 1000)}K`;
  if (abs < 1_000_000_000) return `${sign}$${Number((abs / 1_000_000).toFixed(0))}M`;
  return `${sign}$${Number((abs / 1_000_000_000).toFixed(1))}B`;
}

/**
 * Normalise le label time : BMO (Before Market Open) / AMC (After
 * Market Close) / DMT (During Market Time). Default '—' si inconnu.
 */
export function earningsTimeLabel(time) {
  if (!time || typeof time !== 'string') return '—';
  const upper = time.trim().toUpperCase();
  if (upper === 'BMO' || upper === 'AMC' || upper === 'DMT') return upper;
  return '—';
}
