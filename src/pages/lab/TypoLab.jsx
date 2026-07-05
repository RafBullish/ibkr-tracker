// ═══════════════════════════════════════════════════════════════
//  LAB TYPO — HÉROS (Phase D1)  ·  route DEV-ONLY /lab/typo
//
//  Laboratoire de comparaison typographique des GROS MONTANTS. Ne modifie
//  AUCUNE page réelle, aucun style global, aucune font-family existante.
//  Enregistré uniquement si import.meta.env.DEV (cf. App.jsx) → code-split,
//  zéro impact sur le bundle des pages réelles.
//
//  5 blocs comparables à conditions strictement égales (même fond, mêmes
//  espacements, mêmes tailles — SEULE la typo change) :
//    TÉMOIN (rendu actuel exact, intouché) · A · B · C · D
//  Chaque bloc = 4 étages pour juger la police aux 3 échelles :
//    1. Héros NLV (~56px)  2. Héros REALIZED (P&L)  3. KPI (~26px)  4. Table (~13px)
//
//  Données STATIQUES codées en dur. INTERDIT : store, localStorage.
//  Loi de couleur appliquée AU LAB : greeks neutres, P&L vert/rouge.
// ═══════════════════════════════════════════════════════════════

import { Fragment } from 'react';

// Polices candidates — importées ICI UNIQUEMENT (route lazy dev-only) pour
// rester hors du bundle des pages réelles.
import '@fontsource-variable/martian-mono/wght.css';
import '@fontsource-variable/inter-tight/wght.css';
import '@fontsource-variable/space-grotesk/wght.css';
import '@fontsource/ibm-plex-sans-condensed/600.css';
import '@fontsource/ibm-plex-sans-condensed/700.css';
import './typo-lab.css';

// ── Données statiques (valeurs réelles du dashboard) ───────────────────────────
const D = {
  nlv: 24025,
  nlvChf: 19489,
  chgUsd: 2610,
  chgPct: '12.2',
  realized: 13240,
  kpiDeployed: 19676,
  kpiWinRate: '67.0',
  kpiPf: '2.92',
  rows: [
    { tk: 'AAPL', px: '232.40', delta: '0.42', theta: '−12.4', pnl: 229, pnlSign: '+', tone: 'profit' },
    { tk: 'NVDA', px: '143.10', delta: '0.55', theta: '−18.9', pnl: 272, pnlSign: '−', tone: 'loss' },
    { tk: 'MSFT', px: '438.00', delta: '0.38', theta: '−9.1', pnl: 69, pnlSign: '−', tone: 'loss' },
  ],
};

const CANDIDATES = [
  { key: 'temoin', letter: 'TÉMOIN', name: 'rendu actuel', intent: 'Iosevka QC Hero / Geist Mono — intouché', anatomy: false },
  { key: 'a', letter: 'A', name: '« Terminal élite »', intent: 'Martian Mono, wght ≈ 750', anatomy: true },
  { key: 'b', letter: 'B', name: '« SaaS moderne »', intent: 'Inter Tight, wght 700', anatomy: true },
  { key: 'c', letter: 'C', name: '« Ingénierie dense »', intent: 'IBM Plex Sans Condensed 700', anatomy: true },
  { key: 'd', letter: 'D', name: '« Signature »', intent: 'Space Grotesk 700', anatomy: true },
];

// "24025" -> "24'025"
const grp = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "'");

// Rend un montant. anatomy=true → sépare $ (58 %, ink-soft) et séparateurs '
// (ink-mute) ; sinon rendu uniforme (témoin). Pour un montant P&L, $ et '
// suivent la couleur de tonalité (loi de couleur).
function Amount({ n, cur = true, sign = '', pct = false, tone = 'neutral', anatomy }) {
  const grouped = grp(n);
  if (!anatomy) {
    return (
      <span className={`tl-num tl-num--${tone}`}>
        {sign}
        {cur ? '$' : ''}
        {grouped}
        {pct ? '%' : ''}
      </span>
    );
  }
  const segs = grouped.split("'");
  return (
    <span className={`tl-num tl-num--anat tl-num--${tone}`}>
      {sign && <span className="tl-sign">{sign}</span>}
      {cur && <span className="tl-cur">$</span>}
      {segs.map((s, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="tl-sep">&#39;</span>}
          {s}
        </Fragment>
      ))}
      {pct && <span className="tl-pct">%</span>}
    </span>
  );
}

function Block({ cand }) {
  const anat = cand.anatomy;
  return (
    <section className={`tl-block tl-block--${cand.key}`}>
      <header className="tl-block__head">
        <span className="tl-block__letter">{cand.letter}</span>
        <span className="tl-block__name">{cand.name}</span>
        <span className="tl-block__intent">{cand.intent}</span>
      </header>

      <div className="tl-block__body">
        {/* Étage 1 — Héros NLV */}
        <div className="tl-stage">
          <div className="tl-stage__label">
            NLV · NET LIQUIDITY VALUE
            <span className="tl-badge">LIVE</span>
          </div>
          <div className="tl-hero">
            <Amount n={D.nlv} tone="neutral" anatomy={anat} />
          </div>
          <div className="tl-subline">
            <span className="tl-subline__cur">CHF</span>{' '}
            <Amount n={D.nlvChf} cur={false} tone="neutral" anatomy={anat} />
          </div>
          <div className="tl-chip">
            <span className="tl-chip__arrow">▲</span>
            <Amount n={D.chgUsd} sign="+" tone="profit" anatomy={anat} />
            <Amount n={D.chgPct} cur={false} pct sign="+" tone="profit" anatomy={anat} />
          </div>
        </div>

        {/* Étage 2 — Héros REALIZED (P&L vert) */}
        <div className="tl-stage">
          <div className="tl-stage__label">REALIZED P&amp;L · CUMULÉ</div>
          <div className="tl-hero">
            <Amount n={D.realized} sign="+" tone="profit" anatomy={anat} />
          </div>
        </div>

        {/* Étage 3 — Ligne KPI (~26px) */}
        <div className="tl-stage">
          <div className="tl-stage__label">KPI INTERMÉDIAIRE</div>
          <div className="tl-kpi">
            <Amount n={D.kpiDeployed} tone="neutral" anatomy={anat} />
            <span className="tl-kpi__dot">·</span>
            <Amount n={D.kpiWinRate} cur={false} pct tone="neutral" anatomy={anat} />
            <span className="tl-kpi__dot">·</span>
            <span className="tl-num tl-num--neutral">{D.kpiPf}</span>
          </div>
        </div>

        {/* Étage 4 — Table dense (~13px), colonne P&L alignée à droite */}
        <div className="tl-stage tl-stage--table">
          <div className="tl-stage__label">POSITIONS</div>
          <table className="tl-table">
            <thead>
              <tr>
                <th>TICKER</th>
                <th className="tl-r">PRIX</th>
                <th className="tl-r">Δ</th>
                <th className="tl-r">Θ</th>
                <th className="tl-r">P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {D.rows.map((r) => (
                <tr key={r.tk}>
                  <td className="tl-tk">{r.tk}</td>
                  <td className="tl-r">
                    <Amount n={r.px} cur={false} tone="neutral" anatomy={anat} />
                  </td>
                  <td className="tl-r tl-num tl-num--neutral">{r.delta}</td>
                  <td className="tl-r tl-num tl-num--neutral">{r.theta}</td>
                  <td className="tl-r">
                    <Amount n={r.pnl} sign={r.pnlSign} tone={r.tone} anatomy={anat} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default function TypoLab() {
  return (
    <div className="tl-root">
      <header className="tl-root__head">
        <h1 className="tl-root__title">LAB TYPO — HÉROS</h1>
        <p className="tl-root__sub">
          Comparaison à conditions strictement égales @1591 · midnight. TÉMOIN = rendu
          actuel intouché. A–D = candidates + anatomie du chiffre (tabular-nums, $ à 58 %
          ink-soft, séparateurs ink-mute). Choisis par UNE lettre : Témoin / A / B / C / D.
        </p>
      </header>
      <div className="tl-grid">
        {CANDIDATES.map((c) => (
          <Block key={c.key} cand={c} />
        ))}
      </div>
    </div>
  );
}
