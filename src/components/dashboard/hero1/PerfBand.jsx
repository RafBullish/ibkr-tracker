// ═══════════════════════════════════════════════════════════════
//  HÉROS 1 — LIGNE DE PÉRIODE (ex-PerfBand, maigrie en HERO-FOOTER).
//
//  D1 « une seule maison de stats par héros : le pied » — cette ligne
//  ne porte plus QUE : la période, le P&L de la fenêtre ($ / % / CHF,
//  toné — argent réel) et la note d'honnêteté « historique
//  reconstitué » quand la fenêtre contient des points synth. Les
//  extrêmes / DD / jours / compteurs vivent au pied (ChartFooter),
//  calculés pré-resample (heroStats).
// ═══════════════════════════════════════════════════════════════

import { fmtChf } from './kit';

const signPct = (v, d = 1) => (v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}%`);
const signUsd = (v) => (v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : '−'}$${Math.abs(Math.round(v)).toLocaleString('de-CH')}`);
const tone3 = (v) => (v == null || v === 0 ? undefined : v > 0 ? 'profit' : 'loss');

// Note d'honnêteté (FIX-NLV D5) : fenêtre contenant des points
// reconstitués → ink-mute, note, pas alerte.
const SYNTH_NOTE = 'historique reconstitué · réalisé + apports';

export default function PerfBand({ w, range, rate, synth = false }) {
  if (!w || w.empty) {
    return (
      <div className="lh-perf">
        <span className="lh-perf__head">SUR CETTE PÉRIODE · {range}</span>
        <span className="lh-perf__none">{synth ? SYNTH_NOTE : 'fenêtre trop courte'}</span>
      </div>
    );
  }
  const chf = fmtChf(w.pnl, rate, true);
  const tone = tone3(w.pnl);
  // É3.1 — base affichée (NLV) + formule en title : ce cumul est le
  // delta flow-neutral de la fenêtre, PAS le Σ réalisé du Héros 2.
  return (
    <div
      className="lh-perf lh-perf--slim"
      title={`NLV · ${range} — Δ flow-neutral de la fenêtre (apports neutralisés, latent inclus) ; % sur la NLV de départ. ≠ CUMULÉ · RÉAL (Héros 2, clôtures seules).`}
    >
      <span className="lh-perf__head">SUR CETTE PÉRIODE · {range} · NLV</span>
      <span className={`lh-perf__value${tone ? ` lh-perf__value--${tone}` : ''}`}>{signUsd(w.pnl)}</span>
      <span className="lh-perf__sub--inline">{`${signPct(w.pnlPct)}${chf ? ` · ${chf}` : ''}`}</span>
      {synth ? <span className="lh-perf__none lh-perf__none--end">{SYNTH_NOTE}</span> : null}
    </div>
  );
}
