// ═══════════════════════════════════════════════════════════════
//  HÉROS 2 (1.E) — DECK RÉALISÉ (zone haute). À l'image du PortfolioDeck
//  de Héros 1 : cellules-MONDE (libellé + grosse valeur + CHF/contexte
//  COLLÉS, zéro trou central), grille alignée au cordeau, double devise.
//  4 panneaux : RÉALISÉ TOTAL (cumulé + gross) · MATRICE DE NON-PERTE
//  (proéminente, 3×2 — la preuve d'edge) · EXTRÊMES · RYTHME.
//
//  Loi de couleur : réalisé $ = rouge/vert (argent réel) ; ratios/comptes
//  = neutres. Aucun libellé répété avec le footer (jour/distribution).
// ═══════════════════════════════════════════════════════════════

import { fmtUsd, fmtUsdSigned, fmtChf, toneSign } from '../hero1/kit';

// Cellule-MONDE (identique 1.D) — value null → cellule ignorée.
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

export default function RealizedDeck({ m, rate, range }) {
  const mx = m.matrix;
  const chf = (usd, signed) => (Number.isFinite(usd) && Number.isFinite(rate) && rate > 0 ? fmtChf(usd, rate, signed) : null);

  const matrix = [
    { label: 'WIN RATE', value: mx.n ? `${mx.winRate.toFixed(0)} %` : null, sub: `${mx.wins}↑ / ${mx.losses}↓`, bar: { pct: mx.winRate } },
    { label: 'PROFIT FACTOR', value: mx.profitFactor == null ? null : Number.isFinite(mx.profitFactor) ? mx.profitFactor.toFixed(2) : '∞', sub: 'gains / pertes' },
    { label: 'PAYOFF', value: mx.payoff == null ? null : Number.isFinite(mx.payoff) ? `${mx.payoff.toFixed(2)}×` : '∞', sub: 'gain / perte moy.' },
    { label: 'EXPECTANCY', value: mx.n ? fmtUsdSigned(mx.expectancy) : null, chf: chf(mx.expectancy, true), sub: '/ clôture', tone: toneSign(mx.expectancy) },
    { label: 'MAX DD CUMUL', value: mx.maxDD > 0 ? fmtUsd(-mx.maxDD) : mx.n ? '$0' : null, chf: mx.maxDD > 0 ? chf(-mx.maxDD) : null, sub: 'pic → creux', tone: mx.maxDD > 0 ? 'loss' : undefined },
    { label: 'RECOVERY', value: mx.recovery == null ? null : `${mx.recovery.toFixed(2)}×`, sub: 'réalisé / DD' },
  ];
  const extremes = [
    { label: 'MEILLEURE', value: mx.n ? fmtUsdSigned(mx.best) : null, chf: chf(mx.best, true), tone: mx.best > 0 ? 'profit' : undefined },
    { label: 'PIRE', value: mx.n ? fmtUsdSigned(mx.worst) : null, chf: chf(mx.worst, true), tone: mx.worst < 0 ? 'loss' : undefined },
    { label: 'GAIN MOY.', value: mx.wins ? fmtUsdSigned(mx.avgWin) : null, chf: chf(mx.avgWin, true), tone: mx.wins ? 'profit' : undefined },
    { label: 'PERTE MOY.', value: mx.losses ? fmtUsdSigned(-mx.avgLoss) : null, chf: chf(-mx.avgLoss, true), tone: mx.losses ? 'loss' : undefined },
  ];
  const rhythm = [
    { label: 'CLÔTURES', value: mx.n ? `${mx.n}` : null, sub: 'total' },
    { label: 'GAGNANTES', value: mx.n ? `${mx.wins}` : null, sub: mx.n ? `${mx.winRate.toFixed(0)} %` : null },
    { label: 'PERDANTES', value: mx.n ? `${mx.losses}` : null, sub: mx.n ? `${(100 - mx.winRate).toFixed(0)} %` : null },
    { label: 'JOURS ACTIFS', value: m.dayStats.activeDays ? `${m.dayStats.activeDays}` : (mx.n ? '0' : null), sub: `${m.spanDays} j fenêtre` },
  ];

  return (
    <div className="h2-deck" aria-label="Réalisé en un coup d'œil">
      {/* Panneau 1 — RÉALISÉ TOTAL (hero cumulé + gross). */}
      <div className="mk-cell pf-cell">
        <div className="mk-title">RÉALISÉ TOTAL</div>
        <div className="pf-hero">
          <div className="pf-hero__lbl">CUMULÉ · {range}</div>
          <div className={`pf-hero__val h2-giant--${toneSign(mx.realizedTotal) || 'mute'}`}>
            {mx.n ? fmtUsdSigned(mx.realizedTotal) : '—'}
          </div>
          <div className="pf-hero__meta">
            {chf(mx.realizedTotal, true) || ''}
            {mx.n ? ` · ${mx.n} clôt.` : ''}
          </div>
        </div>
        <div className="pf-grid h2-grid2">
          <Cell label="GROSS GAINS" value={mx.wins ? fmtUsd(mx.grossWin) : null} chf={chf(mx.grossWin)} sub={`${mx.wins} gagn.`} tone="profit" />
          <Cell label="GROSS PERTES" value={mx.losses ? fmtUsd(-mx.grossLoss) : null} chf={chf(-mx.grossLoss)} sub={`${mx.losses} perd.`} tone="loss" />
        </div>
      </div>

      {/* Panneau 2 — MATRICE DE NON-PERTE (proéminente, 3×2). */}
      <div className="mk-cell pf-cell h2-cell--matrix">
        <div className="mk-title">MATRICE DE NON-PERTE</div>
        <div className="pf-grid h2-matrix">
          {matrix.map((c) => (
            <Cell key={c.label} {...c} />
          ))}
        </div>
      </div>

      {/* Panneau 3 — EXTRÊMES. */}
      <div className="mk-cell pf-cell">
        <div className="mk-title">EXTRÊMES</div>
        <div className="pf-grid">
          {extremes.map((c) => (
            <Cell key={c.label} {...c} />
          ))}
        </div>
      </div>

      {/* Panneau 4 — RYTHME. */}
      <div className="mk-cell pf-cell">
        <div className="mk-title">RYTHME</div>
        <div className="pf-grid">
          {rhythm.map((c) => (
            <Cell key={c.label} {...c} />
          ))}
        </div>
      </div>
    </div>
  );
}
