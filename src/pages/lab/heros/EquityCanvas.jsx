// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — EquityCanvas : le graphe partagé par les 3
//  directions. DEV-only, purgé fin 1.D.
//
//  Livre les invariants roadmap 1.D :
//    · crosshair (vertical via curseur Tooltip + horizontal suiveur)
//    · toggle équité / drawdown (underwater)
//    · marqueurs de trades sur la courbe (colorés par P&L = argent
//      réel → seule couleur P&L autorisée par la loi de couleur)
//    · courbe de série NEUTRE/ambre (valeur de portefeuille, pas un
//      P&L) — 3 traitements comparables (amber / neutral / green).
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import useLiveTheme from '../../../hooks/useLiveTheme';
import { OBS } from '../../../components/charts/obsidienne';
import { fmtUsd, fmtPct, fmtAxisDate, fmtAxisUsd } from './kit';

// Résout la couleur de SÉRIE selon le traitement (aucune sémantique
// P&L — c'est la valeur du portefeuille / la « série élue »).
function seriesColor(mode, T) {
  if (mode === 'green') return T.profit;
  if (mode === 'neutral') return OBS.color.context; // #9A9AA2 ink
  return OBS.color.hero; // '#FFA028' — accent héros (loi de couleur OK)
}

// Tooltip compact : DATE + valeur de la vue + P&L du trade (coloré).
function HeroTooltip({ active, payload, view, showPct, T }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload || {};
  const pnl = row.pnl;
  const pnlTone = pnl > 0 ? T.profit : pnl < 0 ? T.loss : T.text.tertiary;
  return (
    <div className="lh-tip">
      <div className="lh-tip__date">{row.date}</div>
      {view === 'drawdown' ? (
        <div className="lh-tip__row">
          <span>DRAWDOWN</span>
          <span>
            {fmtUsd(-(row.drawdown || 0))}
            {showPct ? ` (${fmtPct(row.underwaterPct)})` : ''}
          </span>
        </div>
      ) : (
        <div className="lh-tip__row">
          <span>EQUITY</span>
          <span>{fmtUsd(row.equity)}</span>
        </div>
      )}
      <div className="lh-tip__row">
        <span>TRADE</span>
        <span style={{ color: pnlTone }}>
          {pnl > 0 ? '+' : pnl < 0 ? '−' : ''}
          {fmtUsd(Math.abs(pnl || 0))}
        </span>
      </div>
    </div>
  );
}

export default function EquityCanvas({
  data,
  view = 'equity',
  colorMode = 'amber',
  markerStyle = 'ring',
  showMarkers = true,
  showPct = false,
  gradId = 'lhGrad',
  height,
}) {
  const T = useLiveTheme();
  const [active, setActive] = useState(null);
  const col = seriesColor(colorMode, T);
  // Drawdown tracé en $ (underwater ≤ 0) — honnête quelle que soit la base.
  const viewKey = view === 'drawdown' ? 'underwater' : 'equity';
  const isDD = view === 'drawdown';

  if (!Array.isArray(data) || data.length === 0) {
    return <div className="lh-canvas lh-canvas--empty">Aucun trade clôturé</div>;
  }

  // Densité de marqueurs : au-delà de 60 points on allège (sinon bruit).
  const markerR = data.length > 90 ? 2 : data.length > 45 ? 2.5 : 3.4;
  const renderMarkers = showMarkers && !isDD && markerStyle !== 'none';

  // Dot custom coloré par le P&L du trade (loi de couleur : argent réel).
  const dotFn = (props) => {
    const { cx, cy, payload, index } = props;
    if (cx == null || cy == null) return null;
    const win = (payload.pnl || 0) >= 0;
    const c = win ? T.profit : T.loss;
    const key = `mk-${index}`;
    if (markerStyle === 'tick') {
      return (
        <line
          key={key}
          x1={cx}
          y1={cy - markerR - 2}
          x2={cx}
          y2={cy + markerR + 2}
          stroke={c}
          strokeWidth={1.4}
          opacity={0.85}
        />
      );
    }
    if (markerStyle === 'dot') {
      return <circle key={key} cx={cx} cy={cy} r={markerR} fill={c} opacity={0.92} />;
    }
    // 'ring' — anneau creux (défaut)
    return (
      <circle
        key={key}
        cx={cx}
        cy={cy}
        r={markerR}
        fill={T.surface.base}
        stroke={c}
        strokeWidth={1.5}
        opacity={0.95}
      />
    );
  };

  const container = (
    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
      <ComposedChart
        data={data}
        margin={{ top: 10, right: 14, bottom: 6, left: 6 }}
        onMouseMove={(s) => {
          if (s && s.isTooltipActive && s.activePayload && s.activePayload[0]) {
            setActive(s.activePayload[0].payload);
          } else {
            setActive(null);
          }
        }}
        onMouseLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={col} stopOpacity={isDD ? 0 : 0.28} />
            <stop offset="100%" stopColor={col} stopOpacity={isDD ? 0.24 : 0} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke={OBS.color.grid} strokeDasharray="0" vertical={false} horizontal />

        <XAxis
          dataKey="date"
          stroke={OBS.color.tick}
          tick={OBS.tick}
          axisLine={false}
          tickLine={false}
          tickFormatter={fmtAxisDate}
          minTickGap={40}
          height={20}
        />
        <YAxis
          stroke={OBS.color.tick}
          tick={OBS.tick}
          axisLine={false}
          tickLine={false}
          width={54}
          tickFormatter={fmtAxisUsd}
          tickCount={6}
          domain={isDD ? ['dataMin', 0] : ['dataMin - 40', 'dataMax + 40']}
        />

        {/* Ligne de watermark : 0 (drawdown) ou capital de départ (equity). */}
        <ReferenceLine
          y={isDD ? 0 : data[0].equity}
          stroke={T.text.tertiary}
          strokeOpacity={0.18}
          strokeDasharray="2 3"
        />

        {/* Crosshair horizontal — suit le point survolé. */}
        {active ? (
          <ReferenceLine
            y={active[viewKey]}
            stroke={T.text.tertiary}
            strokeOpacity={0.45}
            strokeDasharray="3 3"
          />
        ) : null}

        <Area
          dataKey={viewKey}
          type="monotone"
          fill={`url(#${gradId})`}
          stroke={col}
          strokeWidth={2}
          baseValue={isDD ? 0 : undefined}
          isAnimationActive={false}
          dot={renderMarkers ? dotFn : false}
          activeDot={{ r: 4.5, fill: col, stroke: T.surface.base, strokeWidth: 2 }}
        />

        <Tooltip
          content={<HeroTooltip view={view} showPct={showPct} T={T} />}
          cursor={OBS.cursor}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );

  return (
    <div className="lh-canvas" style={height ? { height } : undefined}>
      {container}
    </div>
  );
}
