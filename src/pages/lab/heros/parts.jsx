// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — parts : contrôles + cellules partagés par les 3
//  directions. DEV-only, purgé fin 1.D. DS strict : Plex, hairlines,
//  ambre = actif/décision, encre neutre par défaut.
// ═══════════════════════════════════════════════════════════════

import { TIMEFRAMES } from './kit';

export function RangeSelector({ range, setRange, id }) {
  return (
    <div className="lh-range" role="tablist" aria-label={`Fenêtre temporelle ${id || ''}`}>
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          type="button"
          role="tab"
          className="lh-range__btn"
          data-active={range === tf || undefined}
          aria-pressed={range === tf}
          onClick={() => setRange(tf)}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}

export function ViewToggle({ view, setView }) {
  return (
    <div className="lh-toggle" role="tablist" aria-label="Vue équité ou drawdown">
      {[
        ['equity', 'ÉQUITÉ'],
        ['drawdown', 'DRAWDOWN'],
      ].map(([k, lbl]) => (
        <button
          key={k}
          type="button"
          role="tab"
          className="lh-toggle__btn"
          data-active={view === k || undefined}
          aria-pressed={view === k}
          onClick={() => setView(k)}
        >
          {lbl}
        </button>
      ))}
    </div>
  );
}

/**
 * Cellule de stat dense. `tone` ∈ profit|loss|mute (loi de couleur :
 * n'utiliser profit/loss QUE sur de l'argent réel). Par défaut neutre.
 */
export function StatCell({ label, value, sub, tone }) {
  return (
    <div className="lh-stat">
      <span className="lh-stat__label">{label}</span>
      <span className={`lh-stat__value${tone ? ` lh-stat__value--${tone}` : ''}`}>{value}</span>
      {sub != null ? <span className="lh-stat__sub">{sub}</span> : null}
    </div>
  );
}
