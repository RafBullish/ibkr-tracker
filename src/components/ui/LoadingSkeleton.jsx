// ═══════════════════════════════════════════════════════════════
//  LOADING SKELETON v3.0 « Midnight Terminal »
//
//  Shimmer placeholder per brief §10. Four variants:
//    - card       a standard MetricCard / GlassCard
//    - table-row  a tabular line
//    - chart      an equity curve / generic chart
//    - kpi        a compact KPI tile
//
//  Shimmer animation (1.5s ease-in-out infinite) is collapsed to
//  nothing under prefers-reduced-motion (handled via the .shimmer
//  rule in global.css + the tokens TIER 4 override).
// ═══════════════════════════════════════════════════════════════

import { forwardRef } from 'react';

const VARIANT_CLASS = {
  card: 'v3-skeleton v3-skeleton--card',
  'table-row': 'v3-skeleton v3-skeleton--row',
  chart: 'v3-skeleton v3-skeleton--chart',
  kpi: 'v3-skeleton v3-skeleton--kpi',
  text: 'v3-skeleton v3-skeleton--text',
};

const LoadingSkeleton = forwardRef(function LoadingSkeleton(
  { variant = 'card', width, height, className, style, count = 1, ...rest },
  ref
) {
  const cls = [VARIANT_CLASS[variant] || VARIANT_CLASS.card, className].filter(Boolean).join(' ');

  const mergedStyle = { ...(style || {}) };
  if (width != null) mergedStyle.width = typeof width === 'number' ? `${width}px` : width;
  if (height != null) mergedStyle.height = typeof height === 'number' ? `${height}px` : height;

  if (count > 1) {
    return (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={cls} style={mergedStyle} aria-hidden="true" />
        ))}
      </>
    );
  }

  return <div ref={ref} className={cls} style={mergedStyle} aria-hidden="true" {...rest} />;
});

export default LoadingSkeleton;
