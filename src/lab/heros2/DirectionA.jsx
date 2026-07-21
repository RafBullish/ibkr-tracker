// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros2 — DIRECTION A « LE REGISTRE ».
//  Trajectoire-first, calquée AU CORDEAU sur Héros 1 : même cadre gris
//  (.lh-final), même frontière, cellules-MONDE (.pf-deck/.pf-c), même
//  zone graphe terminal (lightweight-charts) avec un GÉANT réalisé en
//  overlay, même bande de stats. Le héros du graphe = RÉALISÉ CUMULÉ
//  (au lieu du NLV). Familier, continu avec Héros 1.
// ═══════════════════════════════════════════════════════════════

import { Suspense, lazy, useState } from 'react';
import { fmtUsd, fmtUsdSigned, fmtChf, fmtPct, toneSign } from '../../components/dashboard/hero1/kit';
import { RangeSelector } from '../../components/dashboard/hero1/parts';
import { useRealizedModel } from './realizedModel';

const TvChart = lazy(() => import('../../components/dashboard/hero1/TvChart'));

// Cellule-MONDE (identique au PortfolioDeck 1.D) : label · grosse valeur
// · meta · barre. `value` null → cellule ignorée (pas de ligne « — » nue).
function Cell({ label, value, chf, sub, tone, bar }) {
  if (value == null) return null;
  const meta = [chf, sub].filter(Boolean).join(' · ');
  return (
    <div className="pf-c">
      <span className="pf-c__label">{label}</span>
      <span className={`pf-c__val${tone ? ` pf-c__val--${tone}` : ''}`}>{value}</span>
      <span className="pf-c__meta">{meta || ' '}</span>
      <span className="pf-c__barslot">
        {bar && Number.isFinite(bar.pct) ? (
          <span className="pf-bar" role="img" aria-label={`${Math.round(bar.pct)} %`}>
            <span className="pf-bar__fill" style={{ width: `${Math.max(0, Math.min(100, bar.pct))}%` }} />
          </span>
        ) : null}
      </span>
    </div>
  );
}

// Héros RÉALISÉ CUMULÉ (miroir de NlvHero, labels réalisé, chip période
// neutre au lieu du témoin LIVE). Réutilise .lh-hero* pour l'identité.
function RealizedHero({ total, rate, count, span, range }) {
  const tone = total == null || total === 0 ? 'mute' : total > 0 ? 'profit' : 'loss';
  const chf = fmtChf(total, rate);
  return (
    <div className="lh-hero lh-hero--lg">
      <div className="lh-hero__head">
        <span className="lh-hero__label">RÉALISÉ · CUMULÉ</span>
        <span className="rz-chip">{range}</span>
      </div>
      <div className="lh-hero__row">
        <span className={`lh-hero__usd rz-hero__usd--${tone}`}>{total == null ? '—' : fmtUsdSigned(total)}</span>
        {count != null ? (
          <span className="lh-hero__pill lh-hero__pill--mute">
            {count} clôt.<span className="lh-hero__pill-cap"> · {span} j</span>
          </span>
        ) : null}
      </div>
      {chf ? <span className="lh-hero__chf">{chf}</span> : null}
    </div>
  );
}

export default function DirectionA() {
  const [range, setRange] = useState('ALL');
  const m = useRealizedModel(range);
  const rate = m.rate;
  const mx = m.matrix;
  const chf = (usd, signed) => (Number.isFinite(usd) && Number.isFinite(rate) && rate > 0 ? fmtChf(usd, rate, signed) : null);

  // ── 4 panneaux cellules-MONDE ──────────────────────────────────
  const nonLoss = [
    { label: 'WIN RATE', value: mx.n ? `${mx.winRate.toFixed(0)} %` : null, sub: `${mx.wins}↑ / ${mx.losses}↓`, bar: { pct: mx.winRate } },
    { label: 'PROFIT FACTOR', value: mx.profitFactor == null ? null : Number.isFinite(mx.profitFactor) ? mx.profitFactor.toFixed(2) : '∞', sub: 'gains / pertes' },
    { label: 'PAYOFF', value: mx.payoff == null ? null : Number.isFinite(mx.payoff) ? `${mx.payoff.toFixed(2)}×` : '∞', sub: 'gain / perte moy.' },
    { label: 'EXPECTANCY', value: mx.n ? fmtUsdSigned(mx.expectancy) : null, chf: chf(mx.expectancy, true), sub: '/ clôture', tone: toneSign(mx.expectancy) },
  ];
  const extremes = [
    { label: 'MEILLEURE', value: mx.n ? fmtUsdSigned(mx.best) : null, chf: chf(mx.best, true), tone: mx.best > 0 ? 'profit' : undefined },
    { label: 'PIRE', value: mx.n ? fmtUsdSigned(mx.worst) : null, chf: chf(mx.worst, true), tone: mx.worst < 0 ? 'loss' : undefined },
    { label: 'GAIN MOY.', value: mx.wins ? fmtUsdSigned(mx.avgWin) : null, chf: chf(mx.avgWin, true), tone: mx.wins ? 'profit' : undefined },
    { label: 'PERTE MOY.', value: mx.losses ? fmtUsdSigned(-mx.avgLoss) : null, chf: chf(-mx.avgLoss, true), tone: mx.losses ? 'loss' : undefined },
  ];
  const rhythm = [
    { label: 'CLÔTURES', value: mx.n ? `${mx.n}` : null, sub: `${m.spanDays} j` },
    { label: 'GAGNANTES', value: mx.n ? `${mx.wins}` : null, sub: mx.n ? `${mx.winRate.toFixed(0)} %` : null },
    { label: 'MAX DD CUMUL', value: mx.maxDD > 0 ? fmtUsd(-mx.maxDD) : mx.n ? '$0' : null, chf: mx.maxDD > 0 ? chf(-mx.maxDD) : null, tone: mx.maxDD > 0 ? 'loss' : undefined, sub: 'pic → creux' },
    { label: 'RECOVERY', value: mx.recovery == null ? null : `${mx.recovery.toFixed(2)}×`, sub: 'réalisé / DD' },
  ];

  const panels = [
    { title: 'MATRICE DE NON-PERTE', cells: nonLoss },
    { title: 'EXTRÊMES', cells: extremes },
    { title: 'RYTHME', cells: rhythm },
  ];

  return (
    <section className="lh-final rz-block">
      {/* Frontière — même structure que Héros 1, contexte réalisé. */}
      <div className="lh-frontier">
        <span className="lh-frontier__zone">RÉALISÉ</span>
        <span className="lh-frontier__rule" aria-hidden="true" />
        <span className="lh-frontier__ctx">clôtures · argent encaissé</span>
      </div>

      {/* Deck cellules-MONDE : hero RÉALISÉ + 3 panneaux. */}
      <div className="pf-deck rz-deck">
        <div className="mk-cell pf-cell">
          <div className="mk-title">RÉALISÉ TOTAL</div>
          <div className="pf-hero">
            <div className="pf-hero__lbl">CUMULÉ · {range}</div>
            <div className={`pf-hero__val rz-hero__usd--${toneSign(mx.realizedTotal) || 'mute'}`}>
              {mx.n ? fmtUsdSigned(mx.realizedTotal) : '—'}
            </div>
            <div className="pf-hero__meta">
              {chf(mx.realizedTotal, true) || ''}
              {mx.n ? ` · ${mx.n} clôt.` : ''}
            </div>
          </div>
          <div className="pf-grid rz-grid1">
            <Cell label="GROSS GAINS" value={mx.wins ? fmtUsd(mx.grossWin) : null} chf={chf(mx.grossWin)} tone="profit" />
            <Cell label="GROSS PERTES" value={mx.losses ? fmtUsd(-mx.grossLoss) : null} chf={chf(-mx.grossLoss)} tone="loss" />
          </div>
        </div>
        {panels.map((p) => (
          <div className="mk-cell pf-cell" key={p.title}>
            <div className="mk-title">{p.title}</div>
            <div className="pf-grid">
              {p.cells.map((c) => (
                <Cell key={c.label} {...c} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Zone graphe terminal — trajectoire cumulée réalisée + géant. */}
      <div className="lh-zonesep">
        <span className="lh-zonesep__label">TRAJECTOIRE RÉALISÉE</span>
        <span className="lh-zonesep__hint">réglable par période ↓</span>
      </div>
      <div className="lh-graphzone">
        <div className="lh-graphzone__bar">
          <span className="lh-chart__title">RÉALISÉ CUMULÉ</span>
          <div className="lh-chart__controls">
            <RangeSelector range={range} setRange={setRange} />
          </div>
        </div>
        <div className="lh-fuse__stage">
          <div className="lh-fuse__overlay">
            <RealizedHero total={mx.realizedTotal} rate={rate} count={mx.n} span={m.spanDays} range={range} />
          </div>
          <div className="lh-fuse__chart">
            {m.empty ? (
              <div className="lh-canvas lh-canvas--empty">Aucune clôture sur la fenêtre</div>
            ) : (
              <Suspense fallback={<div className="lh-canvas lh-canvas--empty">Chargement…</div>}>
                <TvChart data={m.terminal} view="equity" line="neutral" intraday={false} />
              </Suspense>
            )}
          </div>
        </div>
      </div>

      {/* Bande stats du bas — extrêmes réalisés (RÉALISÉ non répété : il
          est déjà le titre du deck + le géant du graphe). */}
      <div className="lh-cfoot lh-cfoot--dense">
        {[
          ['EXPECTANCY', mx.n ? fmtUsdSigned(mx.expectancy) : '—', 'par clôture', mx.expectancy],
          ['WIN RATE', mx.n ? `${mx.winRate.toFixed(0)}%` : '—', `${mx.wins}↑ / ${mx.losses}↓`, null],
          ['PROFIT FACTOR', mx.profitFactor == null ? '—' : Number.isFinite(mx.profitFactor) ? mx.profitFactor.toFixed(2) : '∞', 'gains / pertes', null],
          ['PAYOFF', mx.payoff == null ? '—' : Number.isFinite(mx.payoff) ? `${mx.payoff.toFixed(2)}×` : '∞', 'gain / perte', null],
          ['MEILLEURE', mx.n ? fmtUsdSigned(mx.best) : '—', 'clôture', mx.best],
          ['PIRE', mx.n ? fmtUsdSigned(mx.worst) : '—', 'clôture', mx.worst],
          ['MAX DD CUMUL', mx.maxDD > 0 ? fmtUsd(-mx.maxDD) : '—', 'pic → creux', -mx.maxDD],
          ['RECOVERY', mx.recovery == null ? '—' : `${mx.recovery.toFixed(2)}×`, 'réalisé / DD', null],
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
