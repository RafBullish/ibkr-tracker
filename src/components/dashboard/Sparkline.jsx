// ═══════════════════════════════════════════════════════════════
//  SPARKLINE v3 — inline SVG primitive (4K refonte, Phase B.4 polish)
//
//  Usage simple :
//    <Sparkline data={[{date, value}, …]} color="profit" height={30} />
//
//  Usage avancé (B.3 + B.4) :
//    <Sparkline
//      data={…}
//      color="profit"
//      height={100}
//      strokeWidth={2}
//      dotRadius={4}
//      dotHaloRadius={8}
//      gradientOpacity={0.4}
//      strokeOpacity={0.65}
//      gridlines={3}
//      zeroLine
//      dashedLine
//      axisLabels
//      formatLabel={(v) => `$${v}`}
//    />
//
//  Props :
//    data            : Array<{date,value}> | Array<number>
//    color           : 'profit' | 'loss' | 'accent' | 'amber' | 'neutral'
//    height          : px (défaut 30) — viewBox vertical.
//    area            : bool (défaut true) — fill semi-transparent.
//    dot             : bool (défaut true) — point terminal + halo.
//    className       : passthrough optionnel.
//    strokeWidth     : px (défaut 1.5) — épaisseur de la polyline.
//    dotRadius       : px (défaut 1.6) — rayon du point terminal.
//    dotHaloRadius   : px (défaut 3.5) — rayon du halo autour du point.
//    gradientOpacity : 0-1 (défaut 0.18) — opacity du fill area.
//    strokeOpacity   : 0-1 (défaut 1) — opacity de la polyline.
//    gridlines       : number (défaut 0) — N lignes horizontales dashed
//                      (color neutre, 4 % du text-primary).
//    zeroLine        : bool (défaut false) — ligne dashed à y=0 si
//                      data couvre des valeurs +/-.
//    dashedLine      : bool (défaut false) — polyline en stroke-dasharray
//                      "3 2" au lieu de solide.
//    axisLabels      : bool (défaut false) — mini-labels max top + min
//                      bottom à droite. Wrapper div absolute.
//    formatLabel     : (v: number) => string — formatter optionnel.
//
//  Empty / single-point : ligne pointillée flat à mid-height. Aucun
//  mock, aucun message texte — signal visuel « pas encore d'historique ».
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';

const VIEWBOX_W = 200;

function normalize(data) {
  if (!Array.isArray(data) || data.length === 0) return [];
  return data
    .map((d) => (typeof d === 'number' ? d : Number(d?.value)))
    .filter((v) => Number.isFinite(v));
}

const defaultFmt = (v) => {
  if (!Number.isFinite(v)) return '';
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toLocaleString('de-CH', { maximumFractionDigits: 0 });
  return v.toFixed(2);
};

export default function Sparkline({
  data,
  color = 'neutral',
  height = 30,
  area = true,
  dot = true,
  className = '',
  strokeWidth = 1.5,
  dotRadius = 1.6,
  dotHaloRadius = 3.5,
  gradientOpacity = 0.18,
  strokeOpacity = 1,
  gridlines = 0,
  zeroLine = false,
  dashedLine = false,
  axisLabels = false,
  formatLabel,
}) {
  const points = useMemo(() => normalize(data), [data]);
  const w = VIEWBOX_W;
  const h = height;
  const labelFmt = formatLabel || defaultFmt;

  // ─── Empty / single-point fallback ──────────────────────────
  if (points.length < 2) {
    const svg = (
      <svg
        className={`sparkline sparkline--flat spark-${color} ${className}`.trim()}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        role="img"
        aria-hidden="true"
      >
        <line
          x1="0"
          y1={h / 2}
          x2={w}
          y2={h / 2}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3,3"
          opacity="0.35"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
    if (!axisLabels) return svg;
    return <div className="sparkline-wrap">{svg}</div>;
  }

  // ─── Scaling ────────────────────────────────────────────────
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const yPad = 2;
  const usableH = h - yPad * 2;
  const yOf = (v) => yPad + (1 - (v - min) / span) * usableH;

  const xs = points.map((_, i) => (i / (points.length - 1)) * w);
  const ys = points.map(yOf);
  const linePath = xs
    .map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${ys[i].toFixed(2)}`)
    .join(' ');
  const areaPath = `${linePath} L ${w.toFixed(2)} ${h} L 0 ${h} Z`;

  const lastX = xs[xs.length - 1];
  const lastY = ys[ys.length - 1];

  // ─── Gridlines (N lignes equally spaced entre max et min) ───
  const gridLineEls = [];
  if (gridlines > 0) {
    for (let i = 1; i <= gridlines; i++) {
      const y = yPad + (i / (gridlines + 1)) * usableH;
      gridLineEls.push(
        <line
          key={`g-${i}`}
          className="sparkline-grid"
          x1="0"
          y1={y}
          x2={w}
          y2={y}
          strokeWidth="1"
          strokeDasharray="2 3"
          vectorEffect="non-scaling-stroke"
        />
      );
    }
  }

  // ─── Zero line (visible uniquement si data couvre 0) ────────
  const showZeroLine = zeroLine && min < 0 && max > 0;
  const zeroY = showZeroLine ? yOf(0) : 0;

  const svgEl = (
    <svg
      className={`sparkline spark-${color} ${className}`.trim()}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden="true"
    >
      {gridLineEls}
      {showZeroLine ? (
        <line
          className="sparkline-zero"
          x1="0"
          y1={zeroY}
          x2={w}
          y2={zeroY}
          strokeWidth="1"
          strokeDasharray="2 3"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {area ? (
        <path d={areaPath} fill="currentColor" fillOpacity={gradientOpacity} stroke="none" />
      ) : null}
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        strokeDasharray={dashedLine ? '3 2' : undefined}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {dot ? (
        <>
          <circle
            cx={lastX}
            cy={lastY}
            r={dotHaloRadius}
            fill="currentColor"
            fillOpacity="0.22"
          />
          <circle cx={lastX} cy={lastY} r={dotRadius} fill="currentColor" />
        </>
      ) : null}
    </svg>
  );

  if (!axisLabels) return svgEl;

  return (
    <div className="sparkline-wrap">
      {svgEl}
      <span className="sparkline-wrap__axis sparkline-wrap__axis--max">{labelFmt(max)}</span>
      <span className="sparkline-wrap__axis sparkline-wrap__axis--min">{labelFmt(min)}</span>
    </div>
  );
}
