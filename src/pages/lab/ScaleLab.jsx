// ═══════════════════════════════════════════════════════════════
//  LAB ÉCHELLE (Phase D2.F)  ·  route DEV-ONLY /lab/scale
//
//  Laboratoire de calibration de l'ÉCHELLE DE TEXTE du palier ≥1440.
//  Ne modifie AUCUNE page réelle, aucun style global. Enregistré uniquement
//  si import.meta.env.DEV (cf. App.jsx) → code-split, zéro impact prod.
//
//  4 blocs empilés, comparables à conditions strictement égales — SEULES les
//  tailles de texte et les hauteurs de ligne changent, le chrome D2 (paddings,
//  gaps, hauteurs de bandeaux) reste FIXE :
//    S0 (témoin, échelle actuelle) · S1 ×1.15 · S2 ×1.30 · S3 ×1.45
//  Chaque bloc = composite réaliste : tranche de strip marchés · carte KPI
//  (valeur 34px × cran) · carte fine (module-header + extrait .v3-table 4 l.).
//  Héros display NLV/REALIZED : HORS PÉRIMÈTRE (validés, intouchés).
//
//  Données STATIQUES codées en dur. INTERDIT : store, localStorage.
//  Loi de couleur appliquée AU LAB : greeks neutres, P&L vert/rouge,
//  strip marchés = exception documentée (données publiques, pas du P&L).
// ═══════════════════════════════════════════════════════════════

import './scale-lab.css';

// ── Crans comparés (tailles en px entiers, S0 = palier c3-hires actuel) ──────
const CRANS = [
  { key: 's0', letter: 'S0', mult: '×1.00', name: 'témoin — échelle actuelle', sizes: 'KPI 34 · cellules 15 · row 36 · th 13 · strip 16 · titre 14' },
  { key: 's1', letter: 'S1', mult: '×1.15', name: 'cran 1', sizes: 'KPI 39 · cellules 17 · row ~41 · th 15 · strip 18 · titre 16' },
  { key: 's2', letter: 'S2', mult: '×1.30', name: 'cran 2', sizes: 'KPI 44 · cellules 20 · row ~47 · th 17 · strip 21 · titre 18' },
  { key: 's3', letter: 'S3', mult: '×1.45', name: 'cran 3', sizes: 'KPI 49 · cellules 22 · row ~52 · th 19 · strip 23 · titre 20' },
];

// ── Données statiques ────────────────────────────────────────────────────────
const TICKS = [
  { sym: 'SPX', px: "6'032.18", chg: '0.42%', up: true, spark: 'M2 24 L12 20 L22 22 L32 14 L42 16 L52 10 L58 8' },
  { sym: 'NDX', px: "22'104.55", chg: '0.31%', up: false, spark: 'M2 10 L12 14 L22 12 L32 18 L42 17 L52 22 L58 24' },
  { sym: 'VIX', px: '14.82', chg: '2.10%', up: false, spark: 'M2 8 L12 12 L22 10 L32 16 L42 20 L52 19 L58 24' },
  { sym: 'ES', px: "6'051.25", chg: '0.38%', up: true, spark: 'M2 22 L12 24 L22 18 L32 19 L42 12 L52 13 L58 6' },
];

// Greeks NEUTRES (encre), P&L toné — loi de couleur.
const ROWS = [
  { tk: 'AAPL', type: 'CALL', strike: '240', exp: '18 SEP 26', qty: 3, delta: '+0.42', theta: '−6.10', pnl: "+$1'240", tone: 'profit' },
  { tk: 'NVDA', type: 'CALL', strike: '210', exp: '21 AOÛ 26', qty: 2, delta: '+0.38', theta: '−8.45', pnl: "−$620", tone: 'loss' },
  { tk: 'MSFT', type: 'PUT', strike: '480', exp: '16 OCT 26', qty: 1, delta: '−0.35', theta: '−4.20', pnl: "+$310", tone: 'profit' },
  { tk: 'AMD', type: 'CALL', strike: '175', exp: '18 SEP 26', qty: 4, delta: '+0.51', theta: '−9.80', pnl: "−$1'085", tone: 'loss' },
];

const TH = [
  { label: 'Symbole', align: 'left' },
  { label: 'Type', align: 'left' },
  { label: 'Strike', align: 'right' },
  { label: 'Échéance', align: 'left' },
  { label: 'Qty', align: 'right' },
  { label: 'Δ Delta', align: 'right' },
  { label: 'Θ Theta', align: 'right' },
  { label: 'P&L latent', align: 'right' },
];

// ── Sous-composants (statiques) ──────────────────────────────────────────────

function Strip() {
  return (
    <div className="ticker-tape ticker-tape--reduced sl-strip">
      <div className="ticker-tape__viewport">
        <div className="ticker-tape__track">
          {TICKS.map((t) => (
            <div className="ticker-cell ticker-cell--live" key={t.sym}>
              <div className="ticker-cell__text">
                <div className="ticker-cell__head">
                  <span className="ticker-cell__symbol">{t.sym}</span>
                  <span className={`ticker-cell__change qc-pct ${t.up ? 'qc-profit' : 'qc-loss'}`}>
                    <span className="ticker-cell__arrow">{t.up ? '▲' : '▼'}</span>
                    {t.chg}
                  </span>
                </div>
                <span className="ticker-cell__value qc-num">{t.px}</span>
              </div>
              <span className="ticker-cell__sparkline">
                <svg width="60" height="32" viewBox="0 0 60 32" aria-hidden="true">
                  <path d={t.spark} fill="none" stroke={t.up ? 'var(--pnl-up)' : 'var(--pnl-down)'} strokeWidth="2" />
                </svg>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard() {
  return (
    <div className="dash-kpi-cards sl-kpi-wrap">
      <div className="dash-kpi-cards__row--secondary sl-kpi-row">
        <section className="dash-kpi-card" data-tone="neutral">
          <div className="dash-kpi-card__top">
            <span className="dash-kpi-card__label">Déployé</span>
            <span className="dash-kpi-card__pill dash-kpi-card__pill--mute">4 pos</span>
          </div>
          <div className="dash-kpi-card__money">
            <div className="dash-kpi-card__value">
              <span className="qc-anat qc-anat--mid">
                <span className="qc-anat__cur">$</span>8<span className="qc-anat__grp">'</span>450
              </span>
            </div>
            <div className="dash-kpi-card__chf">≈ CHF 7'610 · 35.2% du NLV</div>
          </div>
        </section>
      </div>
    </div>
  );
}

function PositionsCard() {
  return (
    <div className="sl-card">
      <header className="module-header">
        <span className="module-header__title">Live Positions · 4 ouvertes</span>
        <span className="module-header__hint">Σ déployé $8'450 · maj 15:42:07</span>
      </header>
      <div className="v3-table-scroller sl-noborder">
        <table className="v3-table">
          <thead>
            <tr>
              {TH.map((h) => (
                <th key={h.label} scope="col" className={`v3-table__th v3-table__th--${h.align}`}>
                  <span className="v3-table__th-inner">{h.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.tk} className="v3-table__row" data-tone={r.tone}>
                <td className="v3-table__td v3-table__td--left">{r.tk}</td>
                <td className="v3-table__td v3-table__td--left">{r.type}</td>
                <td className="v3-table__td v3-table__td--right mono">{r.strike}</td>
                <td className="v3-table__td v3-table__td--left">{r.exp}</td>
                <td className="v3-table__td v3-table__td--right mono">{r.qty}</td>
                <td className="v3-table__td v3-table__td--right mono">{r.delta}</td>
                <td className="v3-table__td v3-table__td--right mono">{r.theta}</td>
                <td className={`v3-table__td v3-table__td--right mono ${r.tone === 'profit' ? 'sl-pnl--up' : 'sl-pnl--down'}`}>
                  {r.pnl}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Block({ cran }) {
  return (
    <section className={`sl-block sl-block--${cran.key}`}>
      <header className="sl-block__head">
        <span className="sl-block__letter">{cran.letter}</span>
        <span className="sl-block__mult">{cran.mult}</span>
        <span className="sl-block__name">{cran.name}</span>
        <span className="sl-block__sizes">{cran.sizes}</span>
      </header>
      <div className="sl-block__body">
        <Strip />
        <div className="sl-row2">
          <KpiCard />
          <PositionsCard />
        </div>
      </div>
    </section>
  );
}

export default function ScaleLab() {
  return (
    <div className="sl-root">
      <header className="sl-head">
        <h1 className="sl-head__title">Lab échelle — D2.F</h1>
        <p className="sl-head__sub">
          Cible 1591×900 · DPR 1.35 · midnight — l'échelle s'applique au texte et aux hauteurs
          de ligne ; le chrome D2 (paddings, gaps) est fixe. Héros NLV/REALIZED intouchés.
        </p>
      </header>
      {CRANS.map((c) => (
        <Block key={c.key} cran={c} />
      ))}
    </div>
  );
}
