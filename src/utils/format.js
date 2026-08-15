// ═══════════════════════════════════════════════════════════════
//  FORMATTING UTILITIES — DUAL CURRENCY (de-CH thousands separator)
//
//  É3.3 « langue & formats » — LA famille fmt centrale : plus aucun
//  toFixed/gabarit local dans les composants du Dashboard.
//  · Milliers suisses (apostrophe) sur tout montant ≥ 1'000,
//    décimale = point (de-CH).
//  · Dates calendaires à l'écran : dd.mm.yy (fmtDate). Zéro
//    yyyy-mm-dd, zéro « Aoû'26 ». (Les ticks d'axes de graphes
//    restent courts — hors de cette famille.)
//  · Échéances : notation IBKR DDMMMYY (fmtExpiry : 18SEP26) — la
//    notation des registres de Rafael.
//  · Strikes : sans décimales si entier (fmtStrike : $630, $1'100).
// ═══════════════════════════════════════════════════════════════

import { toFloat } from './math';

const NUM_FMT_DE_CH_2D = new Intl.NumberFormat('de-CH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NUM_FMT_DE_CH_0D = new Intl.NumberFormat('de-CH', {
  maximumFractionDigits: 0,
});

export function formatUsd(amount) {
  const n = toFloat(amount);
  return (n < 0 ? '-' : '') + '$' + NUM_FMT_DE_CH_2D.format(Math.abs(n));
}

export function formatChf(amount) {
  const n = toFloat(amount);
  return (n < 0 ? '-' : '') + 'CHF ' + NUM_FMT_DE_CH_2D.format(Math.abs(n));
}

export function formatPnlUsd(amount) {
  const n = toFloat(amount);
  if (n === 0) return '$0.00';
  return (n > 0 ? '+' : '') + formatUsd(n);
}

// ─── É3.3 — dates, échéances, strikes ───────────────────────────

/**
 * Date calendaire à l'écran : dd.mm.yy (15.08.26). Accepte ISO
 * 'YYYY-MM-DD…'. Null/invalide → '—'.
 */
export function fmtDate(iso) {
  if (typeof iso !== 'string' || iso.length < 10) return '—';
  const y = iso.slice(2, 4);
  const m = iso.slice(5, 7);
  const d = iso.slice(8, 10);
  if (!/^\d\d$/.test(y) || !/^\d\d$/.test(m) || !/^\d\d$/.test(d)) return '—';
  return `${d}.${m}.${y}`;
}

const IBKR_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Échéance en notation IBKR DDMMMYY : '2026-09-18' → '18SEP26'
 * (la notation des registres de Rafael). Invalide → '—'.
 */
export function fmtExpiry(iso) {
  if (typeof iso !== 'string' || iso.length < 10) return '—';
  const m = parseInt(iso.slice(5, 7), 10);
  const d = iso.slice(8, 10);
  if (!Number.isFinite(m) || m < 1 || m > 12 || !/^\d\d$/.test(d)) return '—';
  return `${d}${IBKR_MONTHS[m - 1]}${iso.slice(2, 4)}`;
}

/**
 * Strike : sans décimales si entier ($630, $1'100), 2 décimales
 * sinon ($632.50). Milliers suisses. Null/invalide → '—'.
 */
export function fmtStrike(v) {
  const n = toFloat(v);
  if (!Number.isFinite(n) || n === 0) return '—';
  const fmt = Number.isInteger(n) ? NUM_FMT_DE_CH_0D : NUM_FMT_DE_CH_2D;
  return (n < 0 ? '-' : '') + '$' + fmt.format(Math.abs(n));
}

/**
 * Montant USD signé, 2 décimales, MILLIERS SUISSES (+$2'676.11) —
 * remplace les `toFixed(2)` locaux qui perdaient l'apostrophe.
 */
export function fmtUsdSigned2(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = toFloat(v);
  if (n === 0) return '$0.00';
  return (n > 0 ? '+' : '−') + '$' + NUM_FMT_DE_CH_2D.format(Math.abs(n));
}

/** Montant USD non signé, 2 décimales, milliers suisses ($1'100.00). */
export function fmtUsd2(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = toFloat(v);
  return (n < 0 ? '-' : '') + '$' + NUM_FMT_DE_CH_2D.format(Math.abs(n));
}

/** Montant USD signé, SANS décimales, milliers suisses (+$2'676). */
export function fmtUsdSigned0(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = toFloat(v);
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return sign + '$' + NUM_FMT_DE_CH_0D.format(Math.abs(n));
}

export function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
