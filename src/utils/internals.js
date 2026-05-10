// ═══════════════════════════════════════════════════════════════
//  MARKET INTERNALS UTILS v4 brick 8 — purs
//
//  Helpers pour le module Market Internals (TICK / TRIN / ADD /
//  VOLD / PCR EQ / PCR IDX par NYSE & NASDAQ).
// ═══════════════════════════════════════════════════════════════

/**
 * Format compact volume signed : 1_400_000_000 → '+1.4B',
 * -890_000_000 → '−890M'. Différent de watchlist.compactVolume :
 *   - signe explicite (+/−) pour > 0 et < 0 (jamais sans signe)
 *   - utilise U+2212 minus sign (cohérence avec MasterChart format)
 */
export function formatVolumeSigned(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  const sign = n > 0 ? '+' : '−';
  let body;
  if (abs < 1000) body = `${Math.round(abs)}`;
  else if (abs < 1_000_000) body = `${trim(abs / 1000, 1)}K`;
  else if (abs < 1_000_000_000) body = `${trim(abs / 1_000_000, 1)}M`;
  else body = `${trim(abs / 1_000_000_000, 1)}B`;
  return `${sign}${body}`;
}

/**
 * Format compact signed integer : 1245 → '+1,245', -890 → '−890'.
 */
export function formatIntSigned(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const sign = n > 0 ? '+' : '−';
  return `${sign}${Math.abs(n).toLocaleString('en-US')}`;
}

/**
 * TICK classification.
 *   > +500 → 'profit' (strong buying)
 *   < -500 → 'loss'   (strong selling)
 *   sinon  → 'mute'
 */
export function classifyTick(v) {
  if (v == null || !Number.isFinite(v)) return 'mute';
  if (v > 500) return 'profit';
  if (v < -500) return 'loss';
  return 'mute';
}

/**
 * TRIN (Arms Index) classification.
 *   < 0.8  → 'profit' (bullish)
 *   > 1.2  → 'loss'   (bearish)
 *   sinon  → 'mute'   (neutre 0.8..1.2)
 */
export function classifyTrin(v) {
  if (v == null || !Number.isFinite(v)) return 'mute';
  if (v < 0.8) return 'profit';
  if (v > 1.2) return 'loss';
  return 'mute';
}

/**
 * Put/Call Ratio classification.
 *   < 0.7 → 'profit' (low fear, bullish skew)
 *   > 1.0 → 'loss'   (high fear, bearish skew)
 *   sinon → 'mute'
 */
export function classifyPcr(v) {
  if (v == null || !Number.isFinite(v)) return 'mute';
  if (v < 0.7) return 'profit';
  if (v > 1.0) return 'loss';
  return 'mute';
}

/**
 * Signed numeric → tone par signe (default).
 *   > 0 → 'profit', < 0 → 'loss', else 'mute'.
 */
export function classifySigned(v) {
  if (v == null || !Number.isFinite(v) || v === 0) return 'mute';
  return v > 0 ? 'profit' : 'loss';
}

function trim(v, digits) {
  return Number(v.toFixed(digits)).toString();
}
