// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — NlvChart PRO. DEV-only, purgé fin 1.D.
//
//  Trace la NLV DENSE (1 pt/jour + intraday sur périodes courtes).
//  Exigences « plateforme » : grilles discrètes H+V · remplissage
//  NEUTRE avec profondeur (jamais l'ambre lourd) · axe Y à droite ·
//  crosshair complet V+H avec lecture de la valeur à l'axe au curseur
//  + boîte (date, NLV, Δ) · apport annoté proprement (marqueur + label
//  « apport +$X », pas une falaise brute) · interpolation linéaire
//  honnête (zéro lissage cartoon) · toggle NLV/drawdown ($) · marqueurs
//  de clôture colorés par P&L réel (loi de couleur).
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip, ResponsiveContainer,
} from 'recharts';
import useLiveTheme from '../../../hooks/useLiveTheme';
import { OBS } from '../../../components/charts/obsidienne';
import { fmtUsd, fmtPct, fmtAxisDate, fmtAxisUsd } from './kit';

const NEUTRAL = OBS.color.context; // #9A9AA2 — encre neutre, calme

function ChartTip({ active, payload, view, T }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload || {};
  const chg = row.chg;
  const chgTone = chg > 0 ? T.profit : chg < 0 ? T.loss : T.text.tertiary;
  const dayPnl = row.dayPnl;
  const closeTone = dayPnl > 0 ? T.profit : dayPnl < 0 ? T.loss : T.text.tertiary;
  return (
    <div className="lh-tip">
      <div className="lh-tip__date">{(row.date || '').replace('T', ' · ')}{row.live ? ' · live' : ''}</div>
      {view === 'drawdown' ? (
        <div className="lh-tip__row"><span>DRAWDOWN</span><span>{fmtUsd(row.underwater)} ({fmtPct(row.drawdownPct)})</span></div>
      ) : (
        <div className="lh-tip__row"><span>NLV</span><span>{fmtUsd(row.nlv)}</span></div>
      )}
      {view !== 'drawdown' && row.chg != null ? (
        <div className="lh-tip__row"><span>Δ</span><span style={{ color: chgTone }}>{chg > 0 ? '+' : chg < 0 ? '−' : ''}{fmtUsd(Math.abs(chg))}</span></div>
      ) : null}
      {row.deposit ? (
        <div className="lh-tip__row"><span>APPORT</span><span>+{fmtUsd(row.depositAmount)}</span></div>
      ) : null}
      {row.dayPnl != null ? (
        <div className="lh-tip__row"><span>{row.tradeCount > 1 ? `${row.tradeCount} CLÔT.` : 'CLÔTURE'}</span><span style={{ color: closeTone }}>{dayPnl > 0 ? '+' : dayPnl < 0 ? '−' : ''}{fmtUsd(Math.abs(dayPnl))}</span></div>
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
  const activeVal = active ? active[viewKey] : null;

  const dotFn = (props) => {
    const { cx, cy, payload, index } = props;
    if (cx == null || cy == null || isDD) return null;
    if (payload.dayPnl != null) {
      const c = payload.dayPnl >= 0 ? T.profit : T.loss;
      return <circle key={`mk-${index}`} cx={cx} cy={cy} r={3.4} fill={c} stroke={T.surface.base} strokeWidth={1} />;
    }
    return null;
  };

  return (
    <div className="lh-canvas">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 4, bottom: 4, left: 8 }}
          onMouseMove={(s) => {
            if (s && s.isTooltipActive && s.activePayload && s.activePayload[0]) setActive(s.activePayload[0].payload);
            else setActive(null);
          }}
          onMouseLeave={() => setActive(null)}
        >
          <defs>
            {/* Remplissage NEUTRE avec profondeur (corps calme, jamais ambre lourd). */}
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={col} stopOpacity={isDD ? 0 : 0.22} />
              <stop offset="55%" stopColor={col} stopOpacity={isDD ? 0.06 : 0.07} />
              <stop offset="100%" stopColor={col} stopOpacity={isDD ? 0.2 : 0.02} />
            </linearGradient>
          </defs>

          {/* Grilles discrètes — valeur (H) + temps (V). */}
          <CartesianGrid stroke={OBS.color.grid} strokeDasharray="0" vertical horizontal />

          <XAxis
            dataKey="date" stroke={OBS.color.tick} tick={OBS.tick} axisLine={false} tickLine={false}
            tickFormatter={fmtAxisDate} minTickGap={54} height={20}
          />
          {/* Axe Y à DROITE — style plateforme. */}
          <YAxis
            orientation="right" stroke={OBS.color.tick} tick={OBS.tick} axisLine={false} tickLine={false}
            width={60} tickFormatter={fmtAxisUsd} tickCount={6}
            domain={isDD ? ['dataMin', 0] : ['dataMin - 200', 'dataMax + 200']}
          />

          {/* Watermark : 0 (drawdown) ou NLV de départ (equity). */}
          <ReferenceLine y={isDD ? 0 : data[0].nlv} stroke={T.text.tertiary} strokeOpacity={0.16} strokeDasharray="2 3" />

          {/* Apports annotés proprement (rail + label « apport +$X »). */}
          {deposits.map((d) => (
            <ReferenceLine
              key={`dep-${d.date}`} x={d.date} stroke={T.text.tertiary} strokeOpacity={0.3} strokeDasharray="3 4"
              label={{ value: `apport +$${Math.round(d.depositAmount).toLocaleString('de-CH')}`, position: 'insideTopLeft', fill: T.text.tertiary, fontSize: 10, fontFamily: T.fonts.mono }}
            />
          ))}

          {/* Crosshair horizontal + lecture de la valeur à l'axe (gauche). */}
          {active ? (
            <ReferenceLine
              y={activeVal} stroke={T.text.secondary} strokeOpacity={0.5} strokeDasharray="3 3"
              label={{ value: fmtUsd(activeVal), position: 'left', fill: T.text.primary, fontSize: 11, fontFamily: T.fonts.mono, offset: 6 }}
            />
          ) : null}

          <Area
            dataKey={viewKey} type="linear" fill={`url(#${gradId})`} stroke={col} strokeWidth={1.7}
            baseValue={isDD ? 0 : undefined} isAnimationActive={false} dot={dotFn}
            activeDot={{ r: 4, fill: col, stroke: T.surface.base, strokeWidth: 2 }}
          />

          <Tooltip content={<ChartTip view={view} T={T} />} cursor={OBS.cursor} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
