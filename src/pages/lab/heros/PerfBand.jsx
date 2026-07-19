// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — PerfBand : bande AU-DESSUS du graphe qui se
//  RECALCULE par période. « Sur cette période, voilà. » DEV-only.
//
//  Présentation PROPRE et UNIFORME : période en tête de bande, chaque
//  cellule = libellé court + valeur (± sous-ligne). Métriques concrètes
//  liées à la fenêtre. P&L période COLORÉ (perf réelle → loi de couleur) ;
//  extrêmes / DD / trades = neutres.
// ═══════════════════════════════════════════════════════════════

import { fmtUsd, fmtChf } from './kit';

const signPct = (v, d = 1) => (v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}%`);
const signUsd = (v) => (v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : '−'}$${Math.abs(Math.round(v)).toLocaleString('de-CH')}`);
const tone3 = (v) => (v == null || v === 0 ? undefined : v > 0 ? 'profit' : 'loss');

function Cell({ label, value, sub, tone }) {
  return (
    <div className="lh-perf__cell">
      <span className="lh-perf__label">{label}</span>
      <span className={`lh-perf__value${tone ? ` lh-perf__value--${tone}` : ''}`}>{value}</span>
      {sub != null ? <span className="lh-perf__sub">{sub}</span> : <span className="lh-perf__sub lh-perf__sub--empty" />}
    </div>
  );
}

export default function PerfBand({ w, range, rate, showDays = false }) {
  if (!w || w.empty) {
    return (
      <div className="lh-perf">
        <span className="lh-perf__head">SUR CETTE PÉRIODE · {range}</span>
        <span className="lh-perf__none">fenêtre trop courte</span>
      </div>
    );
  }
  const chf = fmtChf(w.pnl, rate, true);
  return (
    <div className="lh-perf">
      <span className="lh-perf__head">SUR CETTE PÉRIODE · {range}</span>
      <Cell label="P&L PÉRIODE" value={signUsd(w.pnl)} sub={`${signPct(w.pnlPct)}${chf ? ` · ${chf}` : ''}`} tone={tone3(w.pnl)} />
      <Cell label="PLUS HAUT" value={fmtUsd(w.high)} />
      <Cell label="PLUS BAS" value={fmtUsd(w.low)} />
      <Cell label="MEILLEUR J." value={signUsd(w.bestDay)} />
      <Cell label="PIRE J." value={signUsd(w.worstDay)} />
      <Cell label="MAX DD" value={fmtUsd(-w.maxDDUsd)} sub={signPct(w.maxDDPct)} />
      <Cell label="TRADES" value={`${w.closeCount}`} sub={w.winRate != null ? `${w.winRate.toFixed(0)}% win` : `${w.up}↑ ${w.down}↓`} />
      {showDays ? <Cell label="SÉANCES" value={`${w.up}↑ · ${w.down}↓`} sub="hauts / bas" /> : null}
    </div>
  );
}
