// ═══════════════════════════════════════════════════════════════
//  FORMATTING UTILITIES — DUAL CURRENCY (de-CH thousands separator)
// ═══════════════════════════════════════════════════════════════

import { toFloat } from './math';

const NUM_FMT_DE_CH_2D = new Intl.NumberFormat('de-CH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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

export function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
