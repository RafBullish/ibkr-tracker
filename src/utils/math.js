// ═══════════════════════════════════════════════════════════════
//  PRECISION MATH UTILITIES
// ═══════════════════════════════════════════════════════════════

export function toFloat(value) {
  return parseFloat(value) || 0;
}

export function ensurePositive(value) {
  const p = toFloat(value);
  return p > 0 ? p : 1;
}

export function roundTo2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function roundTo5(n) {
  return Math.round((n + Number.EPSILON) * 1e5) / 1e5;
}

export function roundTo6(n) {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
