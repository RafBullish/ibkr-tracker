// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — 2 STRUCTURES de ZONE HAUTE (KPI). DEV-only.
//  A « Terminal packé » : panneau dense façon résumé de compte IBKR.
//  B « Bi-héros » : 2 gros chiffres d'ancrage + rangée de support.
//  Communes : LIQUIDITÉ DISPO en 1er plan (prominent, réel, `est.`
//  tant que la vraie Buying Power IBKR n'est pas câblée) · valeurs
//  grandes · double devise USD/CHF (CHF agrandi) · espace REMPLI ·
//  AUCUNE sparkline (celle du héros NLV sur le graphe reste). NLV
//  reste le géant du graphe (pas ici).
// ═══════════════════════════════════════════════════════════════

import { fmtChf } from './kit';

const isSigned = (s) => typeof s === 'string' && (s[0] === '+' || s[0] === '−' || s[0] === '-');
const chfOf = (cell, rate) =>
  cell && cell.money && Number.isFinite(cell.usd) && Number.isFinite(rate) && rate > 0
    ? fmtChf(cell.usd, rate, isSigned(cell.value))
    : null;
const index = (cells) => Object.fromEntries((cells || []).map((c) => [c.id, c]));

// Gros chiffre d'ancrage (liquidité, day, exposure…).
function BigStat({ cell, rate, size = 'big' }) {
  if (!cell) return null;
  const chf = chfOf(cell, rate);
  return (
    <div className={`lh-bigstat lh-bigstat--${size}`} title={cell.hint || undefined}>
      <span className="lh-bigstat__label">
        {cell.label}
        {cell.est ? <span className="lh-bigstat__est">est.</span> : null}
      </span>
      <span className={`lh-bigstat__value${cell.tone ? ` lh-bigstat__value--${cell.tone}` : ''}`}>{cell.value}</span>
      {chf ? <span className="lh-bigstat__chf">{chf}</span> : null}
      {cell.sub != null ? <span className="lh-bigstat__sub">{cell.sub}</span> : null}
    </div>
  );
}

// ── STRUCTURE A — « Terminal packé » (ledger dense) ─────────────
export function KpiTerminal({ cells, rate }) {
  const by = index(cells);
  const rest = (cells || []).filter((c) => c.id !== 'powder');
  return (
    <div className="lh-term">
      <BigStat cell={by.powder} rate={rate} size="lead" />
      <div className="lh-term__ledger">
        {rest.map((c) => {
          const chf = chfOf(c, rate);
          return (
            <div className="lh-trow" key={c.id} title={c.hint || undefined}>
              <span className="lh-trow__label">{c.label}</span>
              <span className="lh-trow__nums">
                <span className={`lh-trow__val${c.tone ? ` lh-trow__val--${c.tone}` : ''}`}>{c.value}</span>
                {chf ? <span className="lh-trow__chf">{chf}</span> : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── STRUCTURE B — « Bi-héros hiérarchique » ─────────────────────
export function KpiBiHero({ cells, rate }) {
  const by = index(cells);
  const support = (cells || []).filter((c) => c.id !== 'powder' && c.id !== 'day');
  return (
    <div className="lh-bihero">
      <div className="lh-bihero__anchors">
        <BigStat cell={by.powder} rate={rate} size="anchor" />
        <span className="lh-bihero__rule" aria-hidden="true" />
        <BigStat cell={by.day} rate={rate} size="anchor" />
      </div>
      <div className="lh-bihero__support">
        {support.map((c) => {
          const chf = chfOf(c, rate);
          return (
            <div className="lh-scell" key={c.id} title={c.hint || undefined}>
              <span className="lh-scell__label">{c.label}</span>
              <span className={`lh-scell__val${c.tone ? ` lh-scell__val--${c.tone}` : ''}`}>{c.value}</span>
              {chf ? <span className="lh-scell__chf">{chf}</span> : <span className="lh-scell__chf lh-scell__chf--empty" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
