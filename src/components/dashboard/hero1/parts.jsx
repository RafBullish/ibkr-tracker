// ═══════════════════════════════════════════════════════════════
//  HÉROS 1 (brique 1.D) — parts : Héros NLV · frontières · contrôles ·
//  bande perf/stats. DS strict : Plex chiffres, mono labels, hairlines,
//  ambre = actif, encre neutre, valeurs monétaires blanches + CHF live.
// ═══════════════════════════════════════════════════════════════

import { TIMEFRAMES } from '../../../utils/nlvSeries';
import { fmtUsd, fmtPct, fmtChf } from './kit';

const isSigned = (s) => typeof s === 'string' && (s[0] === '+' || s[0] === '−' || s[0] === '-');

// ── Double devise : USD (grand) + CHF (petit, converti FX live) ──
export function MoneyDual({ usdText, usd, rate, size = 'md', tone }) {
  const chf = fmtChf(usd, rate, isSigned(usdText));
  return (
    <span className={`lh-money lh-money--${size}`}>
      <span className={`lh-money__usd${tone ? ` lh-money__usd--${tone}` : ''}`}>{usdText}</span>
      {chf ? <span className="lh-money__chf">{chf}</span> : null}
    </span>
  );
}

// ── Frontière marché / portefeuille (sommet du bloc, structurelle) ─
export function Frontier() {
  return (
    <div className="lh-frontier">
      <span className="lh-frontier__zone">PORTEFEUILLE</span>
      <span className="lh-frontier__rule" aria-hidden="true" />
      <span className="lh-frontier__ctx">↑ marché · 1.C intangible</span>
    </div>
  );
}

// ── Séparation FORTE données / graphe (Zone 2) ──────────────────
export function ZoneSep({ label = 'GRAPHIQUE' }) {
  return (
    <div className="lh-zonesep">
      <span className="lh-zonesep__label">{label}</span>
      <span className="lh-zonesep__hint">réglable par période ↓</span>
    </div>
  );
}

// ── Sparkline neutre (SVG pur) ──────────────────────────────────
export function MiniSpark({ points, w = 110, h = 34 }) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const d = points
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)} ${(h - ((v - min) / span) * h).toFixed(1)}`)
    .join(' ');
  return (
    <svg className="lh-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={d} fill="none" stroke="var(--ink-mute)" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── HÉROS NLV — le plus gros et le plus soigné du bloc ──────────
export function NlvHero({ nlv, rate, dayPnl, dayPct, spark, size = 'md' }) {
  const tone = dayPnl == null || dayPnl === 0 ? 'mute' : dayPnl > 0 ? 'profit' : 'loss';
  const chf = fmtChf(nlv, rate);
  const pill =
    dayPnl == null
      ? null
      : `${dayPnl >= 0 ? '+' : '−'}$${Math.abs(Math.round(dayPnl)).toLocaleString('de-CH')}${dayPct != null ? ` · ${dayPct >= 0 ? '+' : '−'}${Math.abs(dayPct).toFixed(2)}%` : ''}`;
  return (
    <div className={`lh-hero lh-hero--${size}`}>
      <div className="lh-hero__head">
        <span className="lh-hero__label">NET LIQUIDATION</span>
        <span className="lh-hero__live"><span className="lh-hero__live-dot" aria-hidden="true" />LIVE</span>
      </div>
      {/* Montant + sparkline COLLÉE + pill à proximité (une ligne). */}
      <div className="lh-hero__row">
        <span className="lh-hero__usd">{nlv == null ? '—' : fmtUsd(nlv)}</span>
        <MiniSpark points={spark} w={132} h={38} />
        {pill ? <span className={`lh-hero__pill lh-hero__pill--${tone}`}>{pill}<span className="lh-hero__pill-cap"> jour</span></span> : null}
      </div>
      {chf ? <span className="lh-hero__chf">{chf}</span> : null}
    </div>
  );
}

// ── Cellule KPI (double devise, dense, spark inline) ────────────
export function KpiCell({ cell, rate }) {
  const showChf = cell.money && Number.isFinite(cell.usd) && Number.isFinite(rate) && rate > 0;
  const chf = showChf ? fmtChf(cell.usd, rate, isSigned(cell.value)) : null;
  const spark = Array.isArray(cell.spark) && cell.spark.length >= 2 ? cell.spark : null;
  return (
    <div className="lh-kpi" title={cell.hint || undefined}>
      <span className="lh-kpi__label">
        {cell.label}
        {cell.est ? <span className="lh-kpi__est">est</span> : null}
      </span>
      <div className="lh-kpi__main">
        <span className={`lh-kpi__value${cell.tone ? ` lh-kpi__value--${cell.tone}` : ''}`}>{cell.value}</span>
        {spark ? <MiniSpark points={spark} w={48} h={18} /> : null}
      </div>
      {chf ? <span className="lh-kpi__chf">{chf}</span> : null}
      {cell.sub != null ? <span className="lh-kpi__sub">{cell.sub}</span> : <span className="lh-kpi__sub lh-kpi__sub--empty" />}
    </div>
  );
}

export function KpiBelt({ cells, rate, layout = 'row' }) {
  return (
    <div className={`lh-belt lh-belt--${layout}`}>
      {cells.map((c) => (
        <KpiCell key={c.id} cell={c} rate={rate} />
      ))}
    </div>
  );
}

// ── Contrôles graphe ────────────────────────────────────────────
export function RangeSelector({ range, setRange }) {
  return (
    <div className="lh-range" role="tablist" aria-label="Période">
      {TIMEFRAMES.map((tf) => (
        <button key={tf} type="button" role="tab" className="lh-range__btn" data-active={range === tf || undefined} aria-pressed={range === tf} onClick={() => setRange(tf)}>
          {tf}
        </button>
      ))}
    </div>
  );
}

export function ViewToggle({ view, setView }) {
  return (
    <div className="lh-toggle" role="tablist" aria-label="Vue NLV ou drawdown">
      {[['equity', 'NLV'], ['drawdown', 'DRAWDOWN']].map(([k, lbl]) => (
        <button key={k} type="button" role="tab" className="lh-toggle__btn" data-active={view === k || undefined} aria-pressed={view === k} onClick={() => setView(k)}>
          {lbl}
        </button>
      ))}
    </div>
  );
}

// ── Bande stats du bas (extrêmes · drawdown · référence) — AGRANDIE,
//    blanche, double devise sur les $, densifiée. Indépendante de la
//    bande perf du haut. `dense` → grille resserrée (modèle C). ──
export function ChartFooter({ stats, rate, dense = false }) {
  if (stats.empty) return <div className="lh-cfoot lh-cfoot--empty">Série NLV vide</div>;
  const sf = (v) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}$${Math.abs(Math.round(v)).toLocaleString('de-CH')}`);
  // [label, value, sub, usdForChf]
  const cells = [
    ['PEAK', fmtUsd(stats.peak), null, stats.peak],
    ['HAUT / BAS', fmtUsd(stats.high), `bas ${fmtUsd(stats.low)}`, stats.high],
    ['MAX DD', fmtUsd(-stats.maxDDUsd), fmtPct(stats.maxDDPct), -stats.maxDDUsd],
    ['DD COURANT', fmtUsd(-stats.currentDDUsd), fmtPct(stats.currentDDPct), -stats.currentDDUsd],
    ['RECOVERY', stats.recoveryFactor == null ? '—' : `${stats.recoveryFactor.toFixed(2)}×`, 'profit / DD', null],
    ['MEILLEUR J.', sf(stats.best), null, stats.best],
    ['PIRE J.', sf(stats.worst), null, stats.worst],
    ['GAIN MOY.', sf(stats.avgWin), 'par gain', stats.avgWin],
    ['PERTE MOY.', sf(stats.avgLoss), 'par perte', stats.avgLoss],
    ['EXPECTANCY', sf(stats.expectancy), 'par clôture', stats.expectancy],
    ['% J. GAGN.', stats.pctWinDays == null ? '—' : `${stats.pctWinDays.toFixed(0)}%`, `${stats.longWin}↑ / ${stats.longLoss}↓ max`, null],
    ['CLÔTURES', `${stats.closeCount}`, `${stats.points} pts · ${stats.spanDays} j`, null],
  ];
  return (
    <div className={`lh-cfoot${dense ? ' lh-cfoot--dense' : ''}`}>
      {cells.map(([label, value, sub, usd]) => {
        const chf = Number.isFinite(usd) && Number.isFinite(rate) && rate > 0 ? fmtChf(usd, rate, isSigned(value)) : null;
        return (
          <div className="lh-cfoot__cell" key={label}>
            <span className="lh-cfoot__label">{label}</span>
            <span className="lh-cfoot__value">{value}</span>
            {chf ? <span className="lh-cfoot__chf">{chf}</span> : null}
            {sub != null ? <span className="lh-cfoot__sub">{sub}</span> : <span className="lh-cfoot__sub lh-cfoot__sub--empty" />}
          </div>
        );
      })}
    </div>
  );
}
