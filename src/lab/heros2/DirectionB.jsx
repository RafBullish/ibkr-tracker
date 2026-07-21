// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros2 — DIRECTION B « L'ÉTABLI ».
//  Forme-first : au lieu de la seule trajectoire, on montre la STRUCTURE
//  du réalisé — le RYTHME QUOTIDIEN (barres par jour) et la DISTRIBUTION
//  des issues par-trade (histogramme), avec la MATRICE DE NON-PERTE en
//  BANDEAU proéminent. Même cadre gris (.lh-final), cellules-MONDE,
//  double devise, loi de couleur. Barres Recharts (ratifié), code-split.
// ═══════════════════════════════════════════════════════════════

import { Suspense, lazy, useMemo, useState } from 'react';
import useLiveTheme from '../../hooks/useLiveTheme';
import { OBS } from '../../components/charts/obsidienne';
import { fmtUsd, fmtUsdSigned, fmtChf, toneSign } from '../../components/dashboard/hero1/kit';
import { RangeSelector } from '../../components/dashboard/hero1/parts';
import { useRealizedModel } from './realizedModel';

const LazyRecharts = lazy(() =>
  import('recharts').then((mod) => ({ default: ({ children }) => children(mod) }))
);

const fmtAxisDate = (iso) => {
  if (!iso || typeof iso !== 'string') return '';
  const p = iso.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}` : iso;
};
const fmtAxisUsd = (v) => {
  if (!Number.isFinite(v)) return '';
  const s = v < 0 ? '−' : v > 0 ? '+' : '';
  const a = Math.abs(v);
  return a >= 1000 ? `${s}$${(a / 1000).toFixed(1)}k` : `${s}$${Math.round(a)}`;
};
// Libellé du bucket par sa BORNE BASSE (from) → labels UNIQUES (pas de
// double « 0 » quand deux buckets encadrent zéro), lecture « ≥ borne ».
const labelEdge = (v) => {
  const a = Math.abs(v);
  const k = a >= 1000 ? `${(a / 1000).toFixed(1)}k` : `${a}`;
  return `${v < 0 ? '−' : ''}${k}`;
};

// Tile du bandeau MATRICE DE NON-PERTE.
function Tile({ label, value, sub, chf, tone }) {
  return (
    <div className="rz-tile">
      <span className="rz-tile__label">{label}</span>
      <span className={`rz-tile__val${tone ? ` rz-tile__val--${tone}` : ''}`}>{value}</span>
      {chf ? <span className="rz-tile__chf">{chf}</span> : null}
      <span className="rz-tile__sub">{sub || ' '}</span>
    </div>
  );
}

function DailyBars({ data, T }) {
  if (!data.length) return <div className="lh-canvas lh-canvas--empty">Aucune clôture</div>;
  return (
    <Suspense fallback={<div className="lh-canvas lh-canvas--empty">Chargement…</div>}>
      <LazyRecharts>
        {(R) => (
          <R.ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <R.BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
              <R.CartesianGrid stroke={OBS.color.grid} strokeDasharray="0" vertical={false} />
              <R.XAxis dataKey="date" stroke={OBS.color.tick} tick={OBS.tick} axisLine={false} tickLine={false} tickFormatter={fmtAxisDate} minTickGap={26} height={20} />
              <R.YAxis stroke={OBS.color.tick} tick={OBS.tick} axisLine={false} tickLine={false} width={52} tickFormatter={fmtAxisUsd} tickCount={6} />
              <R.ReferenceLine y={0} stroke={T.text.tertiary} strokeOpacity={0.4} />
              <R.Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} isAnimationActive={false} contentStyle={{ display: 'none' }} />
              <R.Bar dataKey="dailyPnl" isAnimationActive={false} radius={[2, 2, 0, 0]} maxBarSize={26}>
                {data.map((d) => (
                  <R.Cell key={d.date} fill={d.dailyPnl >= 0 ? T.profit : T.loss} fillOpacity={0.85} />
                ))}
              </R.Bar>
            </R.BarChart>
          </R.ResponsiveContainer>
        )}
      </LazyRecharts>
    </Suspense>
  );
}

function DistBars({ bins, T }) {
  if (!bins.length) return <div className="lh-canvas lh-canvas--empty">Aucune clôture</div>;
  // Clé React = index (toujours unique) ; libellé d'axe = borne basse.
  const data = bins.map((b, i) => ({ ...b, i, key: labelEdge(b.from) }));
  return (
    <Suspense fallback={<div className="lh-canvas lh-canvas--empty">Chargement…</div>}>
      <LazyRecharts>
        {(R) => (
          <R.ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <R.BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }} barCategoryGap={2}>
              <R.CartesianGrid stroke={OBS.color.grid} strokeDasharray="0" vertical={false} />
              <R.XAxis dataKey="key" stroke={OBS.color.tick} tick={OBS.tick} axisLine={false} tickLine={false} interval={0} height={20} />
              <R.YAxis stroke={OBS.color.tick} tick={OBS.tick} axisLine={false} tickLine={false} width={30} allowDecimals={false} tickCount={5} />
              <R.Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} isAnimationActive={false} contentStyle={{ display: 'none' }} />
              <R.Bar dataKey="count" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                {data.map((d) => (
                  <R.Cell key={d.i} fill={d.side === 'loss' ? T.loss : T.profit} fillOpacity={d.count ? 0.6 : 0.15} />
                ))}
              </R.Bar>
            </R.BarChart>
          </R.ResponsiveContainer>
        )}
      </LazyRecharts>
    </Suspense>
  );
}

export default function DirectionB() {
  const [range, setRange] = useState('ALL');
  const T = useLiveTheme();
  const m = useRealizedModel(range);
  const rate = m.rate;
  const mx = m.matrix;
  const chf = (usd, signed) => (Number.isFinite(usd) && Number.isFinite(rate) && rate > 0 ? fmtChf(usd, rate, signed) : null);

  const modeCount = useMemo(() => {
    if (!m.dist.bins.length) return 0;
    return m.dist.bins.reduce((mx2, b) => Math.max(mx2, b.count), 0);
  }, [m.dist]);

  const tiles = [
    { label: 'WIN RATE', value: mx.n ? `${mx.winRate.toFixed(0)} %` : '—', sub: `${mx.wins}↑ / ${mx.losses}↓` },
    { label: 'PROFIT FACTOR', value: mx.profitFactor == null ? '—' : Number.isFinite(mx.profitFactor) ? mx.profitFactor.toFixed(2) : '∞', sub: 'gains / pertes' },
    { label: 'PAYOFF', value: mx.payoff == null ? '—' : Number.isFinite(mx.payoff) ? `${mx.payoff.toFixed(2)}×` : '∞', sub: 'gain / perte moy.' },
    { label: 'EXPECTANCY', value: mx.n ? fmtUsdSigned(mx.expectancy) : '—', chf: chf(mx.expectancy, true), sub: '/ clôture', tone: toneSign(mx.expectancy) },
    { label: 'MAX DD CUMUL', value: mx.maxDD > 0 ? fmtUsd(-mx.maxDD) : '—', chf: mx.maxDD > 0 ? chf(-mx.maxDD) : null, sub: 'pic → creux', tone: mx.maxDD > 0 ? 'loss' : undefined },
    { label: 'RECOVERY', value: mx.recovery == null ? '—' : `${mx.recovery.toFixed(2)}×`, sub: 'réalisé / DD' },
  ];

  return (
    <section className="lh-final rz-block">
      <div className="lh-frontier">
        <span className="lh-frontier__zone">RÉALISÉ</span>
        <span className="lh-frontier__rule" aria-hidden="true" />
        <span className="lh-frontier__ctx">clôtures · forme des issues</span>
      </div>

      {/* Zone haute : héros RÉALISÉ + bandeau MATRICE DE NON-PERTE. */}
      <div className="rz-top">
        <div className="rz-anchor">
          <span className="rz-anchor__label">RÉALISÉ · CUMULÉ · {range}</span>
          <span className={`rz-anchor__val rz-hero__usd--${toneSign(mx.realizedTotal) || 'mute'}`}>
            {mx.n ? fmtUsdSigned(mx.realizedTotal) : '—'}
          </span>
          <span className="rz-anchor__chf">
            {chf(mx.realizedTotal, true) || ''}
            {mx.n ? ` · ${mx.n} clôtures` : ''}
          </span>
        </div>
        <div className="rz-matrix" aria-label="Matrice de non-perte">
          <div className="rz-matrix__head">MATRICE DE NON-PERTE</div>
          <div className="rz-matrix__grid">
            {tiles.map((t) => (
              <Tile key={t.label} {...t} />
            ))}
          </div>
        </div>
      </div>

      {/* Zone graphes : QUOTIDIEN | DISTRIBUTION. */}
      <div className="lh-zonesep">
        <span className="lh-zonesep__label">DISTRIBUTION & QUOTIDIEN</span>
        <span className="lh-zonesep__hint">réglable par période ↓</span>
      </div>
      <div className="lh-graphzone">
        <div className="lh-graphzone__bar">
          <span className="lh-chart__title">FORME DU RÉALISÉ</span>
          <div className="lh-chart__controls">
            <RangeSelector range={range} setRange={setRange} />
          </div>
        </div>
        <div className="rz-split">
          <div className="rz-pane">
            <div className="rz-pane__head">
              <span className="rz-pane__title">QUOTIDIEN</span>
              <span className="rz-pane__ctx">{m.daily.length} jours de clôture</span>
            </div>
            <div className="rz-pane__body">
              <DailyBars data={m.daily} T={T} />
            </div>
          </div>
          <div className="rz-pane">
            <div className="rz-pane__head">
              <span className="rz-pane__title">DISTRIBUTION</span>
              <span className="rz-pane__ctx">{mx.n} trades · pas {m.dist.step ? fmtUsd(m.dist.step) : '—'}</span>
            </div>
            <div className="rz-pane__body">
              <DistBars bins={m.dist.bins} T={T} />
            </div>
          </div>
        </div>
      </div>

      {/* Bande basse — gains/pertes bruts + extrêmes. */}
      <div className="lh-cfoot lh-cfoot--dense">
        {[
          ['GROSS GAINS', mx.wins ? `+${fmtUsd(mx.grossWin)}` : '—', `${mx.wins} gagnantes`, mx.grossWin],
          ['GROSS PERTES', mx.losses ? fmtUsd(-mx.grossLoss) : '—', `${mx.losses} perdantes`, -mx.grossLoss],
          ['GAIN MOY.', mx.wins ? fmtUsdSigned(mx.avgWin) : '—', 'par gain', mx.avgWin],
          ['PERTE MOY.', mx.losses ? fmtUsdSigned(-mx.avgLoss) : '—', 'par perte', -mx.avgLoss],
          ['MEILLEURE', mx.n ? fmtUsdSigned(mx.best) : '—', 'clôture', mx.best],
          ['PIRE', mx.n ? fmtUsdSigned(mx.worst) : '—', 'clôture', mx.worst],
          ['MODE', modeCount ? `${modeCount}` : '—', 'trades / bucket', null],
        ].map(([label, value, sub, usd]) => {
          const c = Number.isFinite(usd) && Number.isFinite(rate) && rate > 0 ? fmtChf(usd, rate, typeof value === 'string' && (value[0] === '+' || value[0] === '−' || value[0] === '-')) : null;
          return (
            <div className="lh-cfoot__cell" key={label}>
              <span className="lh-cfoot__label">{label}</span>
              <span className="lh-cfoot__value">{value}</span>
              {c ? <span className="lh-cfoot__chf">{c}</span> : null}
              {sub != null ? <span className="lh-cfoot__sub">{sub}</span> : <span className="lh-cfoot__sub lh-cfoot__sub--empty" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
