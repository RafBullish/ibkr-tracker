// ═══════════════════════════════════════════════════════════════
//  PositionSparkline v4 brick 6 — micro-line SVG 60×14 px
//
//  Trend-only sparkline. Pas de fill, pas de dot, pas de grid —
//  un polyline 1 px stroke, couleur sémantique signée par la
//  direction de la position (Long mark↑ = profit, Short mark↑ = loss).
// ═══════════════════════════════════════════════════════════════

import { sparkTrend } from '../../utils/positions';

export default function PositionSparkline({ prices, dir, width = 60, height = 14 }) {
  if (!Array.isArray(prices) || prices.length < 2) {
    return <span className="position-sparkline__empty">—</span>;
  }
  const cleanPrices = prices.filter((p) => Number.isFinite(p));
  if (cleanPrices.length < 2) return <span className="position-sparkline__empty">—</span>;

  const min = Math.min(...cleanPrices);
  const max = Math.max(...cleanPrices);
  const range = max - min || 1;
  const stepX = width / (cleanPrices.length - 1);
  const points = cleanPrices
    .map((p, i) => {
      const x = i * stepX;
      // Inverse Y axis : higher equity → lower y in SVG coordinate space.
      const y = height - ((p - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const trend = sparkTrend(cleanPrices, dir);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="position-sparkline"
      role="img"
      aria-label={`Tendance 7 jours : ${trend}`}
    >
      <polyline
        points={points}
        fill="none"
        strokeWidth="1"
        className={`position-sparkline__line position-sparkline__line--${trend}`}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
