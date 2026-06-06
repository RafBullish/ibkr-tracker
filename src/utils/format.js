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

export function formatPercent(value) {
  return (value || 0).toFixed(2) + '%';
}

export function formatPnlUsd(amount) {
  const n = toFloat(amount);
  if (n === 0) return '$0.00';
  return (n > 0 ? '+' : '') + formatUsd(n);
}

export function formatPnlChf(amount) {
  const n = toFloat(amount);
  if (n === 0) return 'CHF 0.00';
  return (n > 0 ? '+' : '') + formatChf(n);
}

export function formatPnlPct(value) {
  const n = toFloat(value);
  if (n === 0) return '0.00%';
  return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
}

export function formatRMultiple(value) {
  return (value >= 0 ? '+' : '') + value.toFixed(2) + 'R';
}

export function profitColor(value) {
  return value >= 0 ? 'var(--profit)' : 'var(--loss)';
}

export function profitColorClass(value) {
  return value >= 0 ? 'color-green' : 'color-red';
}

export function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function calculateNotionalVolume(quantity, price, multiplier) {
  return Math.abs(
    toFloat(quantity) * toFloat(price) * (toFloat(multiplier) > 0 ? toFloat(multiplier) : 1)
  );
}
