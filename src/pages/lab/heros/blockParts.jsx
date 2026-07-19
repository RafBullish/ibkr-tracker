// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — parts du BLOC portefeuille (DEV-only, purgé 1.D).
//  Frontière marché/portefeuille · bande KPI · sparkline · contrôles ·
//  pied de graphe. DS strict : Plex chiffres, mono labels, hairlines,
//  ambre = actif/décision, encre neutre.
// ═══════════════════════════════════════════════════════════════

import { TIMEFRAMES } from './nlvData';
import { fmtUsd, fmtPct } from './kit';

// ── Frontière marché / portefeuille (identité de la zone basse) ──
// STRUCTURELLE uniquement — jamais une couleur du registre P&L.
export function Frontier({ variant = 'rule' }) {
  if (variant === 'gutter') {
    return (
      <div className="lh-frontier lh-frontier--gutter">
        <span className="lh-frontier__ctx">↑ marché · 1.C</span>
        <span className="lh-frontier__zone">PORTEFEUILLE</span>
      </div>
    );
  }
  if (variant === 'step') {
    return (
      <div className="lh-frontier lh-frontier--step">
        <span className="lh-frontier__zone">PORTEFEUILLE</span>
        <span className="lh-frontier__sep" aria-hidden="true" />
        <span className="lh-frontier__ctx">mon argent</span>
      </div>
    );
  }
  // 'rule' — barre pleine largeur, filet franc, libellé à gauche.
  return (
    <div className="lh-frontier lh-frontier--rule">
      <span className="lh-frontier__zone">PORTEFEUILLE</span>
      <span className="lh-frontier__rule" aria-hidden="true" />
      <span className="lh-frontier__ctx">↑ marché · 1.C intangible</span>
    </div>
  );
}

// ── Sparkline neutre (NET LIQ) — SVG pur, sans axe ──────────────
export function MiniSpark({ points, w = 96, h = 26 }) {
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
      <path d={d} fill="none" stroke="var(--ink-mute)" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Cellule KPI ─────────────────────────────────────────────────
export function KpiCell({ cell, size = 'md' }) {
  return (
    <div className={`lh-kpi lh-kpi--${size}${cell.head ? ' lh-kpi--head' : ''}`} title={cell.hint || undefined}>
      <span className="lh-kpi__label">
        {cell.label}
        {cell.est ? <span className="lh-kpi__est" title="Estimation (pas la Buying Power IBKR réelle — Sprint C non câblé)">est</span> : null}
      </span>
      <span className={`lh-kpi__value${cell.tone ? ` lh-kpi__value--${cell.tone}` : ''}`}>{cell.value}</span>
      {cell.sub != null || cell.spark ? (
        <span className="lh-kpi__sub">
          {cell.spark ? <MiniSpark points={cell.spark} /> : null}
          {cell.sub != null ? <span>{cell.sub}</span> : null}
        </span>
      ) : (
        <span className="lh-kpi__sub lh-kpi__sub--empty" />
      )}
    </div>
  );
}

// ── Bande KPI — layouts : 'row' | 'twoTier' | 'belt' ────────────
export function KpiBand({ cells, layout = 'row' }) {
  if (layout === 'twoTier') {
    const head = cells.filter((c) => c.head);
    const rest = cells.filter((c) => !c.head);
    return (
      <div className="lh-band lh-band--twotier">
        <div className="lh-band__tier lh-band__tier--primary">
          {head.map((c) => (
            <KpiCell key={c.id} cell={c} size="lg" />
          ))}
        </div>
        <div className="lh-band__tier lh-band__tier--context">
          {rest.map((c) => (
            <KpiCell key={c.id} cell={c} size="sm" />
          ))}
        </div>
      </div>
    );
  }
  if (layout === 'belt') {
    return (
      <div className="lh-band lh-band--belt">
        {cells.map((c) => (
          <KpiCell key={c.id} cell={c} size="sm" />
        ))}
      </div>
    );
  }
  // 'row' — une rangée dense ; NET LIQ (hero) en tête plus large.
  return (
    <div className="lh-band lh-band--row">
      {cells.map((c) => (
        <KpiCell key={c.id} cell={c} size={c.hero ? 'lg' : 'md'} />
      ))}
    </div>
  );
}

// ── Contrôles chart ─────────────────────────────────────────────
export function RangeSelector({ range, setRange }) {
  return (
    <div className="lh-range" role="tablist" aria-label="Période">
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
        ['equity', 'NLV'],
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

// ── Pied de stats dense du graphe ───────────────────────────────
export function ChartFooter({ stats, columns = 6 }) {
  if (stats.empty) {
    return <div className="lh-cfoot lh-cfoot--empty">Série NLV vide</div>;
  }
  const all = [
    ['PEAK', fmtUsd(stats.peak), null],
    ['HAUT / BAS', fmtUsd(stats.high), `bas ${fmtUsd(stats.low)}`],
    ['MAX DD', fmtUsd(-stats.maxDDUsd), fmtPct(stats.maxDDPct)],
    ['DD COURANT', fmtUsd(-stats.currentDDUsd), fmtPct(stats.currentDDPct)],
    ['MEILLEUR J.', stats.best != null ? fmtUsd(stats.best) : '—', null],
    ['PIRE J.', stats.worst != null ? fmtUsd(stats.worst) : '—', null],
    ['FENÊTRE', `${stats.spanDays} j`, `${stats.points} pts`],
    ['CLÔTURES', `${stats.closeCount}`, 'marqueurs'],
  ];
  return (
    <div className="lh-cfoot" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {all.slice(0, columns).map(([label, value, sub]) => (
        <div className="lh-cfoot__cell" key={label}>
          <span className="lh-cfoot__label">{label}</span>
          <span className="lh-cfoot__value">{value}</span>
          {sub != null ? <span className="lh-cfoot__sub">{sub}</span> : null}
        </div>
      ))}
    </div>
  );
}
