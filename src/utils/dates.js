// ═══════════════════════════════════════════════════════════════
//  DATE UTILITIES
// ═══════════════════════════════════════════════════════════════

export function todayDateString() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function currentMonthKey() {
  return todayDateString().slice(0, 7);
}

export function extractMonthKey(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : '';
}

// É3 §4.2.6 — daysToExpiration (non clampé, pouvait rendre un DTE
// négatif) est MORT : le moteur DTE unique est dteFromExp
// (utils/positions.js, clampé à 0).

export function holdingDays(dateIn, dateOut) {
  if (!dateIn || !dateOut) return 0;
  return Math.max(
    0,
    Math.round((new Date(dateOut + 'T12:00:00') - new Date(dateIn + 'T12:00:00')) / 86400000)
  );
}

/**
 * Days between an entry date and the option's expiry — the "DTE at entry"
 * metric. Returns null when either date is missing or malformed, distinct
 * from holdingDays which returns 0 in those cases.
 */
export function dteAtEntry(dateIn, dateExpiry) {
  if (!dateIn || !dateExpiry) return null;
  const entryMs = new Date(dateIn + 'T12:00:00').getTime();
  const expiryMs = new Date(dateExpiry + 'T12:00:00').getTime();
  if (!Number.isFinite(entryMs) || !Number.isFinite(expiryMs)) return null;
  return Math.round((expiryMs - entryMs) / 86400000);
}
