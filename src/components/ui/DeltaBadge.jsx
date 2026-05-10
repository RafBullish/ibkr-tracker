// ═══════════════════════════════════════════════════════════════
//  DELTA BADGE v3.0 « Midnight Terminal »
//
//  Atomic change indicator per brief §10. Pill with a directional
//  icon + signed value + semantic color. Never shows a naked
//  number — always prefixed with + / - / —.
//
//  format:
//    - percent    20 → '+20.00%'
//    - absolute   125 → '+$125'  (accepts currency override)
//    - r-multiple 1.8 → '+1.8R'
// ═══════════════════════════════════════════════════════════════

import { forwardRef } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

function formatValue(value, format, currency, locales) {
  if (value == null || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  switch (format) {
    case 'percent': {
      const s = abs.toLocaleString(locales, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `${sign}${s}%`;
    }
    case 'r-multiple': {
      const s = abs.toLocaleString(locales, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      });
      return `${sign}${s}R`;
    }
    case 'absolute':
    default: {
      const fmt = new Intl.NumberFormat(locales, {
        style: 'currency',
        currency: currency || 'USD',
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
      return `${sign}${fmt.format(abs)}`;
    }
  }
}

const DeltaBadge = forwardRef(function DeltaBadge(
  {
    value,
    format = 'absolute',
    currency = 'USD',
    locales = 'en-US',
    size = 'md',
    showIcon = true,
    className,
    ...rest
  },
  ref
) {
  const tone = value > 0 ? 'profit' : value < 0 ? 'loss' : 'neutral';
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  const iconSize = size === 'sm' ? 11 : 12;

  const cls = ['delta-badge', `delta-badge--${tone}`, `delta-badge--${size}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <span ref={ref} className={cls} {...rest}>
      {showIcon && <Icon size={iconSize} strokeWidth={2.2} aria-hidden="true" />}
      <span className="delta-badge__value mono">
        {formatValue(value, format, currency, locales)}
      </span>
    </span>
  );
});

export default DeltaBadge;
