// ═══════════════════════════════════════════════════════════════
//  METRIC CARD v3.0 « Midnight Terminal »
//
//  Canonical KPI tile per brief §10.
//    - hero     : NLV and top-level P&L (48px value, sparkline,
//                 double currency line, mode badge slot)
//    - standard : P&L Today / Open etc. (28px value, sparkline)
//    - compact  : risk metric rows (Expectancy, Sortino…)
//
//  Formatting is delegated to Intl.NumberFormat:
//    - currency : en-US for USD, de-CH for CHF (brief locale rules)
//    - percent  : standard
//    - r-multiple : "X.XR"
//    - number   : raw
//
//  When a delta is provided a DeltaBadge is rendered beneath the
//  value. When `semantic` is 'auto', the value colour reflects
//  the sign of the delta (or the value itself when delta is absent).
//
//  The `tooltip` prop attaches an InfoTooltip to the label; the
//  `secondary` prop holds an auxiliary conversion line (e.g. CHF
//  conversion under USD NLV).
// ═══════════════════════════════════════════════════════════════

import { forwardRef } from 'react';
import DeltaBadge from './DeltaBadge';
import Sparkline from './Sparkline';
import InfoTooltip from './InfoTooltip';
import useMediaQuery from '../../hooks/useMediaQuery';

const LOCALE_BY_CURRENCY = {
  USD: 'de-CH',
  CHF: 'de-CH',
  EUR: 'de-DE',
};

function formatValue(value, format, currency) {
  if (value == null || Number.isNaN(value)) return '—';
  const locale = LOCALE_BY_CURRENCY[currency] || 'de-CH';
  switch (format) {
    case 'currency':
      if ((currency || 'USD') === 'USD') {
        const fmt = new Intl.NumberFormat('de-CH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        return (value < 0 ? '-' : '') + '$' + fmt.format(Math.abs(value));
      }
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        currencyDisplay: 'code',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    case 'percent':
      return (
        new Intl.NumberFormat('de-CH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(value) + '%'
      );
    case 'r-multiple':
      return (
        new Intl.NumberFormat('de-CH', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 2,
        }).format(value) + 'R'
      );
    case 'number':
    default:
      return new Intl.NumberFormat('de-CH', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
  }
}

function resolveSemantic(semantic, value, delta) {
  if (semantic && semantic !== 'auto') return semantic;
  const probe = delta ?? value;
  if (probe == null || probe === 0) return 'neutral';
  return probe > 0 ? 'profit' : 'loss';
}

const MetricCard = forwardRef(function MetricCard(
  {
    label,
    value,
    format = 'currency',
    currency = 'USD',
    delta,
    deltaFormat,
    deltaPeriod,
    secondary,
    sparklineData,
    sparklineTrend = 'auto',
    size = 'standard',
    semantic = 'auto',
    icon: Icon,
    tooltip,
    badge,
    contextSlot,
    className,
    children,
    ...rest
  },
  ref
) {
  const tone = resolveSemantic(semantic, value, delta);
  // P6-09 : shrink hero sparkline on narrow viewports so it doesn't
  // dominate the 48 px value on 375 px screens.
  const isNarrow = useMediaQuery('(max-width: 600px)');

  const cls = ['metric-card', `metric-card--${size}`, `metric-card--${tone}`, className]
    .filter(Boolean)
    .join(' ');

  const valueText = formatValue(value, format, currency);
  const autoDeltaFormat =
    deltaFormat ??
    (format === 'percent' ? 'percent' : format === 'r-multiple' ? 'r-multiple' : 'absolute');

  return (
    <div ref={ref} className={cls} {...rest}>
      <div className="metric-card__head">
        {Icon && (
          <span className="metric-card__icon" aria-hidden="true">
            <Icon size={size === 'hero' ? 20 : 14} strokeWidth={2} />
          </span>
        )}
        <span className="metric-card__label uppercase-label">
          {label}
          {tooltip && <InfoTooltip content={tooltip} size={12} />}
        </span>
        {badge && <span className="metric-card__badge">{badge}</span>}
      </div>

      <div className="metric-card__value mono" data-tone={tone}>
        {valueText}
      </div>

      {secondary && <div className="metric-card__secondary mono">{secondary}</div>}

      {contextSlot && <div className="metric-card__context">{contextSlot}</div>}

      {(delta != null || sparklineData) && (
        <div className="metric-card__foot">
          {delta != null && (
            <div className="metric-card__delta">
              <DeltaBadge
                value={delta}
                format={autoDeltaFormat}
                currency={currency}
                locales={LOCALE_BY_CURRENCY[currency] || 'de-CH'}
                size={size === 'compact' ? 'sm' : 'md'}
              />
              {deltaPeriod && <span className="metric-card__delta-period">{deltaPeriod}</span>}
            </div>
          )}
          {sparklineData && sparklineData.length > 0 && (
            <Sparkline
              data={sparklineData}
              width={size === 'hero' ? (isNarrow ? 80 : 120) : isNarrow ? 64 : 80}
              height={size === 'hero' ? (isNarrow ? 24 : 32) : isNarrow ? 20 : 24}
              trend={sparklineTrend}
              ariaLabel={`Évolution ${label}`}
            />
          )}
        </div>
      )}

      {children}
    </div>
  );
});

export default MetricCard;
