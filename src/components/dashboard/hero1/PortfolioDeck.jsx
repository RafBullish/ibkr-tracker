// ═══════════════════════════════════════════════════════════════
//  HÉROS 1 (1.D) — PORTFOLIO DECK : zone haute portefeuille à l'image
//  du MarketDeck (design validé par Rafael). Sous-panneaux denses
//  étiquetés (`.mk-cell`/`.mk-title`), rails, valeurs GROSSES (calibre
//  indices MarketDeck), labels petits, double devise USD/CHF.
//
//  3 TRAITEMENTS de densité à tester (prop `treatment`) :
//    A « Serré »     — colonne unique, rythme resserré, valeurs grosses
//    B « Bi-colonne » — 2 colonnes par panneau, packing horizontal max
//    C « Visuel »    — A + mini-barres MarketDeck (allocation, risque)
//
//  Loi de couleur : rouge/vert = argent réel (P&L) ; liquidité / Θ / Δ /
//  Γ / V / notionnel / ratios = NEUTRES. LIQUIDITÉ DISPO = héros `est.`.
// ═══════════════════════════════════════════════════════════════

import { fmtUsd, fmtUsdSigned, fmtUsdCompact, fmtChf, toneSign } from './kit';

const sharesSigned = (v) => (v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v)).toLocaleString('de-CH')}`);
const num2 = (v) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(2));
const pct0 = (v) => (v == null || !Number.isFinite(v) ? null : `${Math.round(v)} %`);

// Barre d'allocation MarketDeck-style (piste + remplissage + repère).
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

// Panneaux (mêmes données quel que soit le traitement).
function buildPanels(k) {
  const money = (usd, signed = false) => ({ usd, signed });
  return [
    {
      title: 'CAPITAL & LIQUIDITÉ',
      hero: { value: k.powder == null ? '—' : fmtUsd(k.powder), usd: k.powder, sub: k.powderPct != null ? `${Math.round(k.powderPct)} % du NLV déployable` : 'déployable' },
      rows: [
        { label: 'EXPOSURE', value: k.exposure == null ? '—' : fmtUsdCompact(k.exposure), ...money(k.exposure), sub: pct0(k.expoPct), bar: k.expoPct != null ? { pct: k.expoPct, mark: 70 } : null },
        { label: 'NOTIONNEL', value: k.notional == null ? '—' : fmtUsdCompact(k.notional) },
        { label: 'POSITIONS', value: k.positionsCount == null ? '—' : `${k.positionsCount}`, sub: 'ouvertes' },
        { label: 'DTE PROCHE', value: k.dte == null ? '—' : `${k.dte} j`, sub: k.dteTicker || null },
      ],
    },
    {
      title: 'P&L',
      rows: [
        { label: 'DAY', value: fmtUsdSigned(k.dayPnl), ...money(k.dayPnl, true), tone: toneSign(k.dayPnl), sub: k.dayPct != null ? `${k.dayPct >= 0 ? '+' : '−'}${Math.abs(k.dayPct).toFixed(2)} %` : null },
        { label: 'WTD · SEM.', value: fmtUsdSigned(k.wtd), ...money(k.wtd, true), tone: toneSign(k.wtd) },
        { label: 'MTD · MOIS', value: fmtUsdSigned(k.mtd), ...money(k.mtd, true), tone: toneSign(k.mtd) },
        { label: 'YTD · ANNÉE', value: fmtUsdSigned(k.ytd), ...money(k.ytd, true), tone: toneSign(k.ytd) },
        { label: 'UNREALIZED', value: fmtUsdSigned(k.unrealized), ...money(k.unrealized, true), tone: toneSign(k.unrealized) },
        { label: 'REALIZED', value: fmtUsdSigned(k.realized), ...money(k.realized, true), tone: toneSign(k.realized) },
      ],
    },
    {
      title: 'RISQUE & GREEKS',
      rows: [
        { label: 'CAP. RISQUE', value: k.riskDollar == null ? '—' : fmtUsd(k.riskDollar), ...money(k.riskDollar), sub: k.nlvAtRiskPct != null ? `${k.nlvAtRiskPct.toFixed(1)} % NLV` : 'SL35', bar: k.nlvAtRiskPct != null ? { pct: k.nlvAtRiskPct } : null },
        { label: 'Θ / JOUR', value: fmtUsdSigned(k.thetaDay), ...money(k.thetaDay, true), sub: 'carry' },
        { label: 'Δ NET', value: sharesSigned(k.netDeltaShares), sub: k.netDeltaDollar != null ? `exp. ${fmtUsdSigned(k.netDeltaDollar)}` : 'actions' },
        { label: 'Γ NET', value: num2(k.gamma), sub: 'gamma' },
        { label: 'V NET', value: fmtUsdSigned(k.vega), ...money(k.vega, true), sub: '/1 % IV' },
      ],
    },
    {
      // Sharpe/Sortino ne sont PAS dans la bande stats du bas → ajoutés ici
      // (gain/perte moy · meilleur/pire trade vivent déjà en bas, pas de doublon).
      title: 'PERFORMANCE',
      rows: [
        { label: 'WIN RATE', value: k.winRate == null ? '—' : `${k.winRate.toFixed(0)} %`, sub: k.tradesCount != null ? `${k.tradesCount} clôt.` : null },
        { label: 'PROFIT FACT.', value: k.profitFactor == null ? '—' : (Number.isFinite(k.profitFactor) ? k.profitFactor.toFixed(2) : '∞') },
        { label: 'EXPECTANCY', value: fmtUsdSigned(k.expectancy), ...money(k.expectancy, true) },
        { label: 'SHARPE', value: num2(k.sharpe) },
        { label: 'SORTINO', value: num2(k.sortino) },
        { label: 'CLÔTURES', value: k.tradesCount == null ? '—' : `${k.tradesCount}`, sub: 'total' },
      ],
    },
  ];
}

function Row({ r, rate, withBar }) {
  const chf = Number.isFinite(r.usd) && Number.isFinite(rate) && rate > 0 ? fmtChf(r.usd, rate, r.signed) : null;
  return (
    <div className="pf-row">
      <span className="pf-row__label">{r.label}</span>
      <span className="pf-row__nums">
        <span className={`pf-row__val${r.tone ? ` pf-row__val--${r.tone}` : ''}`}>{r.value}</span>
        {chf ? <span className="pf-row__chf">{chf}</span> : null}
        {r.sub ? <span className="pf-row__sub">{r.sub}</span> : null}
      </span>
      {withBar && r.bar ? <AllocBar pct={r.bar.pct} mark={r.bar.mark} /> : null}
    </div>
  );
}

function Hero({ hero, rate }) {
  return (
    <div className="pf-hero">
      <div className="pf-hero__lbl">
        LIQUIDITÉ DISPO<span className="pf-est" title="Estimation (availableUsd cash-A) — vraie Buying Power/Excess Liquidity IBKR à câbler">est.</span>
      </div>
      <div className="pf-hero__val">{hero.value}</div>
      <div className="pf-hero__chf">{fmtChf(hero.usd, rate) || ''}</div>
      <div className="pf-hero__sub">{hero.sub}</div>
    </div>
  );
}

export default function PortfolioDeck({ kpi, rate, treatment = 'A' }) {
  const t = ['A', 'B', 'C'].includes(treatment) ? treatment : 'A';
  const panels = buildPanels(kpi || {});
  const withBar = t === 'C';
  return (
    <div className={`pf-deck pf-deck--${t.toLowerCase()}`} aria-label="Portefeuille en un coup d'œil">
      {panels.map((p, i) => (
        <div className="mk-cell pf-cell" key={p.title}>
          <div className="mk-title">{p.title}</div>
          {p.hero ? <Hero hero={p.hero} rate={rate} /> : null}
          <div className={`pf-rows${t === 'B' ? ' pf-rows--grid2' : ''}`}>
            {p.rows.map((r) => (
              <Row key={r.label} r={r} rate={rate} withBar={withBar} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
