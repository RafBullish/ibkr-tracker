// ═══════════════════════════════════════════════════════════════
//  SPARKLINE v3.0 « Midnight Terminal »
//
//  Native SVG sparkline (no Recharts) for KPI cards and inline
//  table cells. Brief §10:
//    - default size 80 × 24, stroke 1.5
//    - gradient fill from stroke color to transparent (30% → 0%)
//    - dot on the last data point
//    - optional reference line (horizontal dashed)
//
//  The color is driven by the `trend` prop (auto|profit|loss|accent)
//  which picks the matching CSS variable. `auto` picks profit if the
//  series is net up, loss otherwise, neutral for flat.
// ═══════════════════════════════════════════════════════════════

import { useId } from 'react';

const TREND_VAR = {
  profit: 'var(--profit)',
  loss: 'var(--loss)',
  accent: 'var(--accent)',
  neutral: 'var(--text-secondary)',
};

function resolveTrend(trend, data) {
  if (trend && trend !== 'auto') return trend;
  if (!data || data.length < 2) return 'neutral';
  const diff = data[data.length - 1] - data[0];
  if (diff > 0) return 'profit';
  if (diff < 0) return 'loss';
  return 'neutral';
}

export default function Sparkline({
  data,
  width = 80,
  height = 24,
  stroke = 1.5,
  trend = 'auto',
  showLastDot = true,
  referenceLineAt,
  className,
  ariaLabel,
}) {
  const id = useId();
  const gradId = `sparkline-grad-${id}`;

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <svg
        className={['sparkline', 'sparkline--empty', className].filter(Boolean).join(' ')}
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel || 'Aucune donnée sparkline'}
        viewBox={`0 0 ${width} ${height}`}
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--border-subtle)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      </svg>
    );
  }

  const tone = resolveTrend(trend, data);
  const color = TREND_VAR[tone] || TREND_VAR.accent;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padY = stroke + 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1 || 1)) * (width - stroke) + stroke / 2;
    const y = height - padY - ((v - min) / range) * (height - padY * 2);
    return [x, y];
  });

  const path = points
    .map(([x, y], i) =>
      i === 0 ? `M${x.toFixed(2)},${y.toFixed(2)}` : `L${x.toFixed(2)},${y.toFixed(2)}`
    )
    .join(' ');

  const fillPath = `${path} L${points[points.length - 1][0].toFixed(2)},${height} L${points[0][0].toFixed(2)},${height} Z`;

  const refY =
    referenceLineAt != null
      ? height - padY - ((referenceLineAt - min) / range) * (height - padY * 2)
      : null;

  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      className={['sparkline', `sparkline--${tone}`, className].filter(Boolean).join(' ')}
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel || `Évolution ${tone}`}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      {refY != null && (
        <line
          x1={0}
          y1={refY}
          x2={width}
          y2={refY}
          stroke="var(--border-default)"
          strokeWidth={1}
          strokeDasharray="3 2"
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showLastDot && (
        <circle
          cx={lastX}
          cy={lastY}
          r={stroke + 0.5}
          fill={color}
          stroke="var(--surface-2)"
          strokeWidth="1"
        />
      )}
    </svg>
  );
}
