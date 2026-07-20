// ═══════════════════════════════════════════════════════════════
//  HÉROS 1 (1.D) — PORTFOLIO DECK (version finale unique).
//  Zone haute portefeuille À L'IMAGE DU MARKETDECK. Cellules COMPACTES
//  style MONDE : libellé (petit) + GROSSE valeur + CHF/contexte GROUPÉS
//  et COLLÉS À GAUCHE (zéro trou central), disposées en GRILLE 2
//  COLONNES par panneau (densité MONDE). Métriques sans valeur RETIRÉES
//  (aucune ligne « — » nue). Barres d'allocation style MarketDeck.
//
//  Loi de couleur : rouge/vert = argent réel (P&L) ; liquidité / Θ / Δ /
//  Γ / V / notionnel / ratios / barres = NEUTRES. LIQUIDITÉ DISPO =
//  héros `est.` (jusqu'au câblage Buying Power IBKR).
// ═══════════════════════════════════════════════════════════════

import { fmtUsd, fmtUsdSigned, fmtUsdCompact, fmtChf, toneSign } from './kit';

const sharesSigned = (v) => (v == null || !Number.isFinite(v) ? null : `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v)).toLocaleString('de-CH')}`);
const num2 = (v) => (v == null || !Number.isFinite(v) ? null : v.toFixed(2));

// Barre d'allocation MarketDeck-style (piste + remplissage neutre + repère).
function AllocBar({ pct, mark }) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const w = Math.max(0, Math.min(100, pct));
  return (
    <span className="pf-bar" role="img" aria-label={`${Math.round(w)} %`}>
      <span className="pf-bar__fill" style={{ width: `${w}%` }} />
      {Number.isFinite(mark) ? <span className="pf-bar__mark" style={{ left: `${Math.max(0, Math.min(100, mark))}%` }} /> : null}
    </span>
  );
}

// Cellule compacte (MONDE-style). `value` null → cellule ignorée.
function Cell({ label, value, chf, sub, tone, bar }) {
  if (value == null) return null;
  const meta = [chf, sub].filter(Boolean).join(' · ');
  return (
    <div className="pf-c">
      <div className="pf-c__top">
        <span className="pf-c__label">{label}</span>
        <span className={`pf-c__val${tone ? ` pf-c__val--${tone}` : ''}`}>{value}</span>
      </div>
      {meta ? <span className="pf-c__meta">{meta}</span> : null}
      {bar ? <AllocBar pct={bar.pct} mark={bar.mark} /> : null}
    </div>
  );
}

export default function PortfolioDeck({ kpi, rate }) {
  const k = kpi || {};
  const chf = (usd, signed) => (Number.isFinite(usd) && Number.isFinite(rate) && rate > 0 ? fmtChf(usd, rate, signed) : null);

  // Chaque panneau = liste de cellules (les null sont filtrées au rendu).
  const capital = [
    { label: 'EXPOSURE', value: k.exposure == null ? null : fmtUsdCompact(k.exposure), chf: chf(k.exposure), sub: k.expoPct != null ? `${Math.round(k.expoPct)} % NLV` : null, bar: k.expoPct != null ? { pct: k.expoPct, mark: 70 } : null },
    { label: 'NOTIONNEL', value: k.notional == null ? null : fmtUsdCompact(k.notional), chf: chf(k.notional) },
    { label: 'POSITIONS', value: k.positionsCount == null ? null : `${k.positionsCount}`, sub: 'ouvertes' },
    { label: 'DTE PROCHE', value: k.dte == null ? null : `${k.dte} j`, sub: k.dteTicker || null },
  ];
  const pnl = [
    { label: 'DAY', value: k.dayPnl == null ? null : fmtUsdSigned(k.dayPnl), chf: chf(k.dayPnl, true), sub: k.dayPct != null ? `${k.dayPct >= 0 ? '+' : '−'}${Math.abs(k.dayPct).toFixed(2)} %` : null, tone: toneSign(k.dayPnl) },
    { label: 'WTD · SEM.', value: k.wtd == null ? null : fmtUsdSigned(k.wtd), chf: chf(k.wtd, true), tone: toneSign(k.wtd) },
    { label: 'MTD · MOIS', value: k.mtd == null ? null : fmtUsdSigned(k.mtd), chf: chf(k.mtd, true), tone: toneSign(k.mtd) },
    { label: 'YTD · ANNÉE', value: k.ytd == null ? null : fmtUsdSigned(k.ytd), chf: chf(k.ytd, true), tone: toneSign(k.ytd) },
    { label: 'UNREALIZED', value: k.unrealized == null ? null : fmtUsdSigned(k.unrealized), chf: chf(k.unrealized, true), tone: toneSign(k.unrealized) },
    { label: 'REALIZED', value: k.realized == null ? null : fmtUsdSigned(k.realized), chf: chf(k.realized, true), tone: toneSign(k.realized) },
  ];
  const greeks = [
    { label: 'CAP. RISQUE', value: k.riskDollar == null ? null : fmtUsd(k.riskDollar), chf: chf(k.riskDollar), sub: k.nlvAtRiskPct != null ? `${k.nlvAtRiskPct.toFixed(1)} % NLV` : null, bar: k.nlvAtRiskPct != null ? { pct: k.nlvAtRiskPct } : null },
    { label: 'Θ / JOUR', value: k.thetaDay == null ? null : fmtUsdSigned(k.thetaDay), chf: chf(k.thetaDay, true), sub: 'carry' },
    { label: 'Δ NET', value: sharesSigned(k.netDeltaShares), sub: 'actions-éq.' },
    { label: 'Δ$ EXP.', value: k.netDeltaDollar == null ? null : fmtUsdSigned(k.netDeltaDollar), chf: chf(k.netDeltaDollar, true) },
    { label: 'Γ NET', value: num2(k.gamma), sub: 'gamma' },
    { label: 'V NET', value: k.vega == null ? null : fmtUsdSigned(k.vega), chf: chf(k.vega, true), sub: '/1 % IV' },
  ];
  const perf = [
    { label: 'WIN RATE', value: k.winRate == null ? null : `${k.winRate.toFixed(0)} %`, sub: k.tradesCount != null ? `${k.tradesCount} clôt.` : null },
    { label: 'PROFIT F.', value: k.profitFactor == null ? null : (Number.isFinite(k.profitFactor) ? k.profitFactor.toFixed(2) : '∞') },
    { label: 'EXPECTANCY', value: k.expectancy == null ? null : fmtUsdSigned(k.expectancy), chf: chf(k.expectancy, true), sub: '/ clôt.' },
    { label: 'SHARPE', value: num2(k.sharpe) },
    { label: 'SORTINO', value: num2(k.sortino) },
    { label: 'GAIN MOY.', value: k.avgWin == null ? null : fmtUsdSigned(Math.abs(k.avgWin)), chf: chf(Math.abs(k.avgWin), true), tone: k.avgWin ? 'profit' : undefined },
    { label: 'PERTE MOY.', value: k.avgLoss == null ? null : fmtUsdSigned(-Math.abs(k.avgLoss)), chf: chf(-Math.abs(k.avgLoss), true), tone: k.avgLoss ? 'loss' : undefined },
    { label: 'CLÔTURES', value: k.tradesCount == null ? null : `${k.tradesCount}`, sub: 'total' },
  ];

  const panels = [
    { title: 'CAPITAL & LIQUIDITÉ', hero: true, cells: capital },
    { title: 'P&L', cells: pnl },
    { title: 'RISQUE & GREEKS', cells: greeks },
    { title: 'PERFORMANCE', cells: perf },
  ];

  return (
    <div className="pf-deck" aria-label="Portefeuille en un coup d'œil">
      {panels.map((p) => (
        <div className="mk-cell pf-cell" key={p.title}>
          <div className="mk-title">{p.title}</div>
          {p.hero ? (
            <div className="pf-hero">
              <div className="pf-hero__lbl">
                LIQUIDITÉ DISPO<span className="pf-est" title="Estimation (availableUsd cash-A) — vraie Buying Power/Excess Liquidity IBKR à câbler">est.</span>
              </div>
              <div className="pf-hero__val">{k.powder == null ? '—' : fmtUsd(k.powder)}</div>
              <div className="pf-hero__meta">
                {fmtChf(k.powder, rate) || ''}
                {k.powderPct != null ? ` · ${Math.round(k.powderPct)} % déployable` : ''}
              </div>
            </div>
          ) : null}
          <div className="pf-grid">
            {p.cells.map((c) => (
              <Cell key={c.label} {...c} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
