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
//  Available Funds RÉEL IBKR (marqueur neutre « IBKR ») quand le bridge
//  est frais, sinon estimation cash-A (marqueur « est. »).
// ═══════════════════════════════════════════════════════════════

import { fmtUsd, fmtUsdSigned, fmtUsdCompact, fmtChf, toneSign } from './kit';
// 1.F — tick au changement de valeur LIVE (fondu + 2 px, 180 ms,
// coupé sous prefers-reduced-motion). Portée sanctionnée : cellules
// des decks Héros 1/2 + bande décision. MarketDeck : NON (gelé).
import { TickValue } from '../decision/parts';
// É3 §4.2.5 — même gate d'expectancy que la bande (une seule vérité).
import { MIN_DECISIVE_WINRATE } from '../../../utils/significance';

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

// Cellule compacte (MONDE-style), STRUCTURE UNIFORME (label · grosse
// valeur · meta · barre) — chaque slot réservé → grille alignée au
// cordeau. `value` null → cellule ignorée (aucune ligne « — » nue).
function Cell({ label, value, chf, sub, tone, bar }) {
  if (value == null) return null;
  // 1.F — pas de « · » devant un sub qui commence par « / ».
  const meta = [chf, sub].filter(Boolean).join(sub && sub.startsWith('/') ? ' ' : ' · ');
  return (
    <div className="pf-c">
      <span className="pf-c__label">{label}</span>
      <TickValue text={value} className={`pf-c__val${tone ? ` pf-c__val--${tone}` : ''}`} />
      <span className="pf-c__meta">{meta || ' '}</span>
      <span className="pf-c__barslot">{bar ? <AllocBar pct={bar.pct} mark={bar.mark} /> : null}</span>
    </div>
  );
}

export default function PortfolioDeck({ kpi, rate }) {
  const k = kpi || {};
  const chf = (usd, signed) => (Number.isFinite(usd) && Number.isFinite(rate) && rate > 0 ? fmtChf(usd, rate, signed) : null);

  // Chaque panneau = liste de cellules (les null sont filtrées au rendu).
  // É3 §4.2.7 — EXPOSITION : la méta dit la vérité du calcul
  // (totalExposure = Σ |valeur mark|, pas le coût des primes engagées).
  // É3.3 — langue : EXPOSITION (aligné bande CAPITAL) · JOUR · LATENT ·
  // RÉALISÉ (une seule voix avec les héros).
  const capital = [
    { label: 'EXPOSITION', value: k.exposure == null ? null : fmtUsdCompact(k.exposure), chf: chf(k.exposure), sub: k.expoPct != null ? `Σ mark · ${Math.round(k.expoPct)} % NLV` : 'Σ valeur mark', bar: k.expoPct != null ? { pct: k.expoPct, mark: 70 } : null },
    { label: 'NOTIONNEL', value: k.notional == null ? null : fmtUsdCompact(k.notional), chf: chf(k.notional) },
    { label: 'POSITIONS', value: k.positionsCount == null ? null : `${k.positionsCount}`, sub: 'ouvertes' },
    // É3 §4.2.6 — expirée = « EXP » honnête, jamais « 0 j » ambigu.
    { label: 'DTE PROCHE', value: k.dte == null ? null : k.dteExpired ? 'EXP' : `${k.dte} j`, sub: k.dteTicker || null },
  ];
  const pnl = [
    { label: 'JOUR', value: k.dayPnl == null ? null : fmtUsdSigned(k.dayPnl), chf: chf(k.dayPnl, true), sub: k.dayPct != null ? `${k.dayPct >= 0 ? '+' : '−'}${Math.abs(k.dayPct).toFixed(2)} %` : null, tone: toneSign(k.dayPnl) },
    { label: 'WTD · SEM.', value: k.wtd == null ? null : fmtUsdSigned(k.wtd), chf: chf(k.wtd, true), tone: toneSign(k.wtd) },
    { label: 'MTD · MOIS', value: k.mtd == null ? null : fmtUsdSigned(k.mtd), chf: chf(k.mtd, true), tone: toneSign(k.mtd) },
    { label: 'YTD · ANNÉE', value: k.ytd == null ? null : fmtUsdSigned(k.ytd), chf: chf(k.ytd, true), tone: toneSign(k.ytd) },
    { label: 'LATENT', value: k.unrealized == null ? null : fmtUsdSigned(k.unrealized), chf: chf(k.unrealized, true), tone: toneSign(k.unrealized) },
    { label: 'RÉALISÉ', value: k.realized == null ? null : fmtUsdSigned(k.realized), chf: chf(k.realized, true), tone: toneSign(k.realized) },
  ];
  // Ordre : CAP. RISQUE → Δ → Γ → Θ → V (greeks Δ Γ Θ V). Δ$-exposition
  // repliée en meta de Δ NET (pas de cellule séparée).
  const greeks = [
    { label: 'CAP. RISQUE', value: k.riskDollar == null ? null : fmtUsd(k.riskDollar), chf: chf(k.riskDollar), sub: k.nlvAtRiskPct != null ? `${k.nlvAtRiskPct.toFixed(1)} % NLV` : null, bar: k.nlvAtRiskPct != null ? { pct: k.nlvAtRiskPct } : null },
    { label: 'Δ NET', value: sharesSigned(k.netDeltaShares), sub: k.netDeltaDollar != null ? `exp. ${fmtUsdSigned(k.netDeltaDollar)}` : 'actions-éq.' },
    { label: 'Γ NET', value: num2(k.gamma), sub: 'gamma' },
    { label: 'Θ / JOUR', value: k.thetaDay == null ? null : fmtUsdSigned(k.thetaDay), chf: chf(k.thetaDay, true), sub: 'carry' },
    { label: 'V NET', value: k.vega == null ? null : fmtUsdSigned(k.vega), chf: chf(k.vega, true), sub: '/1 % IV' },
  ];
  const perf = [
    { label: 'WIN RATE', value: k.winRate == null ? null : `${k.winRate.toFixed(0)} %`, sub: k.tradesCount != null ? `${k.tradesCount} clôt.` : null },
    { label: 'PROFIT FACTOR', value: k.profitFactor == null ? null : (Number.isFinite(k.profitFactor) ? k.profitFactor.toFixed(2) : '∞') },
    // É3 §4.2.5 — « — » honnête sous 10 décisifs (cellule retirée
    // seulement quand il n'y a AUCUNE clôture, convention du deck).
    {
      label: 'EXPECTANCY',
      value: k.tradesCount ? (k.expectancy == null ? '—' : fmtUsdSigned(k.expectancy)) : null,
      chf: k.expectancy == null ? null : chf(k.expectancy, true),
      sub: k.expectancy == null ? `${k.expectancyDecisive ?? 0} décisifs / ${MIN_DECISIVE_WINRATE} requis` : '/ clôt.',
    },
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
                LIQUIDITÉ DISPO
                {k.powderIsReal ? (
                  <span className="pf-real" title="Available Funds réel — bridge IBKR (snapshot frais)">IBKR</span>
                ) : (
                  <span className="pf-est" title="Estimation cash-A — bridge IBKR hors ligne ou snapshot périmé">est.</span>
                )}
              </div>
              <div className="pf-hero__val">
                <TickValue text={k.powder == null ? '—' : fmtUsd(k.powder)} />
              </div>
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
