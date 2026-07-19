// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — NlvChart : le vrai graphique Equity/NLV.
//  DEV-only, purgé fin 1.D.
//
//  Trace la SÉRIE NLV DENSE (1 pt/jour). Traitement CALME et NEUTRE
//  (réf = la courbe verte actuelle, en mieux) : ligne fine, zéro gros
//  dégradé qui bave, vraies lignes de grille. Interpolation LINÉAIRE
//  (pas de lissage cartoon monotone). Livre : crosshair V+H, toggle
//  équité/drawdown ($), marqueurs de trades (jours de clôture, colorés
//  par P&L réel), marqueurs d'apport (neutres, expliquent les sauts).
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

const NEUTRAL = OBS.color.context; // #9A9AA2 — encre neutre, calme

function ChartTip({ active, payload, view, T }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload || {};
  const dayPnl = row.dayPnl;
  const tone = dayPnl > 0 ? T.profit : dayPnl < 0 ? T.loss : T.text.tertiary;
  return (
    <div className="lh-tip">
      <div className="lh-tip__date">
        {row.date}
        {row.live ? ' · live' : ''}
      </div>
      {view === 'drawdown' ? (
        <div className="lh-tip__row">
          <span>DRAWDOWN</span>
          <span>
            {fmtUsd(row.underwater)} ({fmtPct(row.drawdownPct)})
          </span>
        </div>
      ) : (
        <div className="lh-tip__row">
          <span>NLV</span>
          <span>{fmtUsd(row.nlv)}</span>
        </div>
      )}
      {row.deposit ? (
        <div className="lh-tip__row">
          <span>APPORT</span>
          <span>capital ajouté</span>
        </div>
      ) : null}
      {row.dayPnl != null ? (
        <div className="lh-tip__row">
          <span>{row.tradeCount > 1 ? `${row.tradeCount} CLÔT.` : 'CLÔTURE'}</span>
          <span style={{ color: tone }}>
            {dayPnl > 0 ? '+' : dayPnl < 0 ? '−' : ''}
            {fmtUsd(Math.abs(dayPnl))}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export default function NlvChart({ data, view = 'equity', line = 'neutral', showDeposits = true, gradId = 'lhNlv' }) {
  const T = useLiveTheme();
  const [active, setActive] = useState(null);
  const isDD = view === 'drawdown';
  const col = line === 'amber' ? OBS.color.hero : NEUTRAL;
  const viewKey = isDD ? 'underwater' : 'nlv';

  if (!Array.isArray(data) || data.length === 0) {
    return <div className="lh-canvas lh-canvas--empty">NLV indisponible — aucun snapshot</div>;
  }

  const deposits = showDeposits && !isDD ? data.filter((p) => p.deposit) : [];

  // Marqueur : jours de clôture (coloré P&L réel) + apports (neutre).
  const dotFn = (props) => {
    const { cx, cy, payload, index } = props;
    if (cx == null || cy == null) return null;
    if (isDD) return null;
    if (payload.dayPnl != null) {
      const c = payload.dayPnl >= 0 ? T.profit : T.loss;
      return (
        <circle key={`mk-${index}`} cx={cx} cy={cy} r={3.2} fill={c} stroke={T.surface.base} strokeWidth={1} />
      );
    }
    if (payload.deposit) {
      // Triangle neutre « apport » (jamais une couleur P&L).
      return (
        <path
          key={`dp-${index}`}
          d={`M${cx} ${cy - 6} L${cx - 4} ${cy - 1} L${cx + 4} ${cy - 1} Z`}
          fill={T.text.tertiary}
          opacity={0.9}
        />
      );
    }
    return null;
  };

  return (
    <div className="lh-canvas">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 16, bottom: 4, left: 6 }}
          onMouseMove={(s) => {
            if (s && s.isTooltipActive && s.activePayload && s.activePayload[0]) setActive(s.activePayload[0].payload);
            else setActive(null);
          }}
          onMouseLeave={() => setActive(null)}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={col} stopOpacity={isDD ? 0 : 0.1} />
              <stop offset="100%" stopColor={col} stopOpacity={isDD ? 0.12 : 0} />
            </linearGradient>
          </defs>

          {/* Vraies lignes de grille — H + V, chuchotées. */}
          <CartesianGrid stroke={OBS.color.grid} strokeDasharray="0" vertical horizontal />

          <XAxis
            dataKey="date"
            stroke={OBS.color.tick}
            tick={OBS.tick}
            axisLine={false}
            tickLine={false}
            tickFormatter={fmtAxisDate}
            minTickGap={48}
            height={20}
          />
          <YAxis
            stroke={OBS.color.tick}
            tick={OBS.tick}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={fmtAxisUsd}
            tickCount={6}
            domain={isDD ? ['dataMin', 0] : ['dataMin - 200', 'dataMax + 200']}
          />

          {/* Watermark : 0 (drawdown) ou NLV de départ (equity). */}
          <ReferenceLine
            y={isDD ? 0 : data[0].nlv}
            stroke={T.text.tertiary}
            strokeOpacity={0.16}
            strokeDasharray="2 3"
          />

          {/* Rails d'apport verticaux (neutres — expliquent le saut NLV). */}
          {deposits.map((d) => (
            <ReferenceLine
              key={`dep-${d.date}`}
              x={d.date}
              stroke={T.text.tertiary}
              strokeOpacity={0.28}
              strokeDasharray="3 4"
              label={{ value: 'apport', position: 'top', fill: T.text.tertiary, fontSize: 10, fontFamily: T.fonts.mono }}
            />
          ))}

          {/* Crosshair horizontal — suit le point survolé. */}
          {active ? (
            <ReferenceLine y={active[viewKey]} stroke={T.text.tertiary} strokeOpacity={0.4} strokeDasharray="3 3" />
          ) : null}

          <Area
            dataKey={viewKey}
            type="linear"
            fill={`url(#${gradId})`}
            stroke={col}
            strokeWidth={1.6}
            baseValue={isDD ? 0 : undefined}
            isAnimationActive={false}
            dot={dotFn}
            activeDot={{ r: 4, fill: col, stroke: T.surface.base, strokeWidth: 2 }}
          />

          <Tooltip content={<ChartTip view={view} T={T} />} cursor={OBS.cursor} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
