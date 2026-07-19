// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — PerfBand : bande AU-DESSUS du graphe, PARTIE du
//  graphe. Se RECALCULE au changement de période (perf de la FENÊTRE).
//  DEV-only, purgé 1.D.
//
//  2 HYPOTHÈSES à tester (Rafael tranche) :
//    A « Quant »    — Δ période · CAGR · σ ann. · Sharpe · séances ↑/↓
//    B « Momentum » — Δ fenêtre (grand) · momentum · vs pic · série
//  Δ période / CAGR COLORÉS (perf réelle → loi de couleur). σ, Sharpe,
//  momentum, vs-pic, série = NEUTRES.
// ═══════════════════════════════════════════════════════════════

import { fmtUsd, fmtChf } from './kit';

function Cell({ label, value, sub, tone, big }) {
  return (
    <div className={`lh-perf__cell${big ? ' lh-perf__cell--big' : ''}`}>
      <span className="lh-perf__label">{label}</span>
      <span className={`lh-perf__value${tone ? ` lh-perf__value--${tone}` : ''}`}>{value}</span>
      {sub != null ? <span className="lh-perf__sub">{sub}</span> : <span className="lh-perf__sub lh-perf__sub--empty" />}
    </div>
  );
}

const signPct = (v, d = 1) => (v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}%`);
const signUsd = (v) => (v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : '−'}$${Math.abs(Math.round(v)).toLocaleString('de-CH')}`);
const tone3 = (v) => (v == null || v === 0 ? 'mute' : v > 0 ? 'profit' : 'loss');

export default function PerfBand({ w, range, hypothesis = 'A', rate }) {
  if (!w || w.empty) {
    return (
      <div className="lh-perf lh-perf--empty">
        <span className="lh-perf__title">PERF · {range}</span>
        <span className="lh-perf__none">fenêtre trop courte</span>
      </div>
    );
  }
  const dChf = fmtChf(w.deltaFN, rate, true);

  if (hypothesis === 'B') {
    // Momentum / compact : le Δ fenêtre en grand + signaux de tendance.
    return (
      <div className="lh-perf lh-perf--b">
        <span className="lh-perf__title">PERF · {range}</span>
        <Cell big label="Δ FENÊTRE" value={signUsd(w.deltaFN)} sub={`${signPct(w.deltaPct)}${dChf ? ` · ${dChf}` : ''}`} tone={tone3(w.deltaFN)} />
        <Cell label="MOMENTUM" value={`${w.slopePerDay >= 0 ? '↑' : '↓'} ${signUsd(w.slopePerDay)}`} sub="/ jour (10 pts)" />
        <Cell label="VS PIC" value={w.vsPeak >= 0 ? 'au pic' : signUsd(w.vsPeak)} sub="high-water" />
        <Cell label="SÉRIE" value={w.streak === 0 ? '—' : `${Math.abs(w.streak)} ${w.streak > 0 ? '↑' : '↓'}`} sub="séances consécutives" />
      </div>
    );
  }

  // A « Quant » (défaut)
  return (
    <div className="lh-perf lh-perf--a">
      <span className="lh-perf__title">PERF · {range}</span>
      <Cell label="Δ PÉRIODE" value={signUsd(w.deltaFN)} sub={`${signPct(w.deltaPct)}${dChf ? ` · ${dChf}` : ''}`} tone={tone3(w.deltaFN)} />
      <Cell label="CAGR" value={w.cagr == null ? '—' : signPct(w.cagr, 1)} sub="annualisé" tone={w.cagr == null ? undefined : tone3(w.cagr)} />
      <Cell label="σ ANN." value={w.volAnn == null ? '—' : `${w.volAnn.toFixed(1)}%`} sub="volatilité" />
      <Cell label="SHARPE" value={w.sharpe == null ? '—' : w.sharpe.toFixed(2)} sub="période" />
      <Cell label="SÉANCES" value={`${w.up}↑ · ${w.down}↓`} sub="hauts / bas" />
    </div>
  );
}
