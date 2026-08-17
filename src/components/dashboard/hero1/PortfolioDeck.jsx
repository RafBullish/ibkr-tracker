// ═══════════════════════════════════════════════════════════════
//  HÉROS 1 (1.D → 1.G-a) — PORTFOLIO DECK.
//  Zone haute portefeuille À L'IMAGE DU MARKETDECK. Cellules COMPACTES
//  style MONDE : libellé (petit) + GROSSE valeur + CHF/contexte GROUPÉS
//  et COLLÉS À GAUCHE (zéro trou central), disposées en GRILLE 2
//  COLONNES par panneau. Métriques sans valeur RETIRÉES (aucune ligne
//  « — » nue). Barres d'allocation style MarketDeck.
//
//  1.G-a (densité + honnêteté) — cellules display-only (données DÉJÀ
//  calculées, zéro source nouvelle) : APPORTS CUMULÉS, HWM NET D'APPORTS
//  (INVERSÉ : valeur = écart au pic, méta = niveau + date), FRAIS CUMULÉS,
//  Θ % PRIME/JOUR PAR POSITION (max, comparable au seuil 0,8 %), SÉRIE EN
//  COURS. Δ NET porte l'exposition $ (Σ Δ × spot) en méta (ex-DELTA $ ENGAGÉ
//  fusionnée). EXPOSITION en lead S1 (provisoire). PROFIT FACTOR porte son
//  suffixe de fenêtre (tout l'historique — pas de fausse « 30 »). Grille
//  tolérante au N=1 : cellule impaire de fin span pleine largeur, jamais de
//  trou. ÉCHELLE S0..S4 — la densité vit au palier ≥ 2000 (c3-hires.css) ;
//  au plancher 1591 le deck retombe à ses tailles antérieures (amendement §2).
//
//  Loi de couleur : rouge/vert = argent réel (P&L) ; liquidité / apports /
//  HWM (écart = drawdown) / frais / Θ / Θ% / Δ / delta-$ / Γ / V / notionnel /
//  ratios / barres / streak = NEUTRES. LIQUIDITÉ DISPO = Available Funds RÉEL IBKR
//  (marqueur neutre « IBKR ») quand le bridge est frais, sinon estimation
//  cash-A (marqueur « est. »).
// ═══════════════════════════════════════════════════════════════

import { fmtUsd, fmtUsdSigned, fmtUsdCompact, fmtChf, fmtPct, fmtAxisDate, toneSign } from './kit';
// 1.F — tick au changement de valeur LIVE (fondu + 2 px, 180 ms,
// coupé sous prefers-reduced-motion). Portée sanctionnée : cellules
// des decks Héros 1/2 + bande décision. MarketDeck : NON (gelé).
import { TickValue } from '../decision/parts';
// É3 §4.2.5 — même gate d'expectancy que la bande (une seule vérité).
import { MIN_DECISIVE_WINRATE } from '../../../utils/significance';
// 1.G-b — le BLOC PORTES (5 portes par position) rendu sous les 4 panneaux.
import PortesBloc from './PortesBloc';

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
// `lead` → valeur au registre S1 (32 px), la principale du bloc.
function Cell({ label, value, chf, sub, tone, bar, lead }) {
  if (value == null) return null;
  // 1.F — pas de « · » devant un sub qui commence par « / ».
  const meta = [chf, sub].filter(Boolean).join(sub && sub.startsWith('/') ? ' ' : ' · ');
  return (
    <div className="pf-c">
      <span className="pf-c__label">{label}</span>
      <TickValue text={value} className={`pf-c__val${lead ? ' pf-c__val--s1' : ''}${tone ? ` pf-c__val--${tone}` : ''}`} />
      <span className="pf-c__meta">{meta || ' '}</span>
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
  const capital = [
    // 1.G-b — LIQUIDITÉ DISPO démote en cellule S1 (le lead du bloc) : le S0
    // héros au-dessus est désormais DÉPLOYABLE. Marqueur IBKR/est. en méta.
    { label: 'LIQUIDITÉ DISPO', value: k.powder == null ? null : fmtUsd(k.powder), chf: chf(k.powder), sub: k.powderPct != null ? `${Math.round(k.powderPct)} % NLV · ${k.powderIsReal ? 'IBKR' : 'est.'}` : k.powderIsReal ? 'IBKR' : 'est.' },
    { label: 'EXPOSITION', value: k.exposure == null ? null : fmtUsdCompact(k.exposure), chf: chf(k.exposure), sub: k.expoPct != null ? `Σ mark · ${Math.round(k.expoPct)} % NLV` : 'Σ valeur mark', bar: k.expoPct != null ? { pct: k.expoPct, mark: 70 } : null },
    // S6.3 (É4-a) — cellule NOTIONNEL SUPPRIMÉE : `totalNotional` = Σ|mark×ct×mul|,
    // formule IDENTIQUE à EXPOSITION (Σ|valeur mark|) → même nombre sous deux
    // libellés (doublon). Le vrai notionnel de §8 (strike×100×contrats) n'était
    // PAS calculé (le label mentait). EXPOSITION (Σ valeur mark, §8) reste la
    // source unique. Résidu consigné : bâtir un vrai notionnel strike-based si
    // désiré + réaligner « Σ Notionnel » de LivePositions (même mensonge mark).
    // DELTA $ ENGAGÉ — SUPPRIMÉE (amendement 16.08) : doublon de « Δ NET ×
    // spot », la cellule que É3.1 avait enterrée. Fusionnée dans Δ NET (méta).
    // APPORTS CUMULÉS — capital injecté (nets), NEUTRE (pas un P&L).
    { label: 'APPORTS CUMULÉS', value: k.apportsCumules == null ? null : fmtUsd(k.apportsCumules), chf: chf(k.apportsCumules), sub: 'nets' },
    // HWM NET D'APPORTS — présentation INVERSÉE : la VALEUR = l'écart courant
    // au pic (drawdown flow-neutral honnête, NEUTRE) ; la méta NOMME sa base :
    // « pic NLV {niveau} · {date} » (le niveau = la NLV brute au pic).
    { label: 'HWM NET D’APPORTS', value: k.hwmEcartPct == null ? null : fmtPct(k.hwmEcartPct), sub: k.hwmLevel == null ? null : `pic NLV ${fmtUsdSigned(k.hwmLevel)}${k.hwmDate ? ` · ${fmtAxisDate(k.hwmDate)}` : ''}` },
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
    // FRAIS CUMULÉS — coût réel cumulé (commissions/FX/retraits). NEUTRE :
    // déjà inclus dans le RÉALISÉ (FifoPnlRealized net) → pas de double-rouge.
    { label: 'FRAIS CUMULÉS', value: k.feesTotal ? fmtUsd(k.feesTotal) : null, chf: chf(k.feesTotal), sub: 'commissions cumul.' },
  ];
  // Ordre : CAP. RISQUE → Δ → Γ → Θ → Θ% → V (greeks Δ Γ Θ V). Δ NET porte
  // l'exposition directionnelle en $ (fusion 16.08 : Σ Δ × spot en méta).
  const greeks = [
    { label: 'CAP. RISQUE', value: k.riskDollar == null ? null : fmtUsd(k.riskDollar), chf: chf(k.riskDollar), sub: k.nlvAtRiskPct != null ? `${k.nlvAtRiskPct.toFixed(1)} % NLV` : null, bar: k.nlvAtRiskPct != null ? { pct: k.nlvAtRiskPct } : null },
    // Δ NET — actions-équivalent + exposition $ (Σ Δ × spot) en méta. NEUTRE
    // (dérivé directionnel, loi §6). L'ex-cellule DELTA $ ENGAGÉ vit ici.
    { label: 'Δ NET', value: sharesSigned(k.netDeltaShares), sub: k.netDeltaDollar ? `exp. ${fmtUsdSigned(k.netDeltaDollar)}` : 'actions-éq.' },
    { label: 'Γ NET', value: num2(k.gamma), sub: 'gamma' },
    { label: 'Θ / JOUR', value: k.thetaDay == null ? null : fmtUsdSigned(k.thetaDay), chf: chf(k.thetaDay, true), sub: 'carry' },
    // Θ % PRIME/JOUR — PAR POSITION (max ; dénominateur = MARK COURANT).
    // NEUTRE, valeur seule (seuil 0,8 % au registre). Méta = ticker + DTE de
    // la position la plus décroissante (« UNH · 4 j »).
    { label: 'Θ % PRIME/J', value: k.thetaPctPrime == null ? null : `${k.thetaPctPrime.toFixed(2)} %`, sub: k.thetaPctTicker ? `${k.thetaPctTicker}${k.thetaPctDte != null ? ` · ${k.thetaPctExpired ? 'EXP' : `${k.thetaPctDte} j`}` : ''}` : '/ jour' },
    { label: 'V NET', value: k.vega == null ? null : fmtUsdSigned(k.vega), chf: chf(k.vega, true), sub: '/1 % IV' },
  ];
  const perf = [
    { label: 'WIN RATE', value: k.winRate == null ? null : `${k.winRate.toFixed(0)} %`, sub: k.tradesCount != null ? `${k.tradesCount} clôt.` : null },
    // PROFIT FACTOR — porte son SUFFIXE DE FENÊTRE : all-time honnête (pas
    // de fausse « 30 » ; la fenêtre 30 du registre n'est pas encore là).
    { label: 'PROFIT FACTOR', value: k.profitFactor == null ? null : (Number.isFinite(k.profitFactor) ? k.profitFactor.toFixed(2) : '∞'), sub: k.profitFactor == null ? null : 'tout l’historique' },
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
    // SÉRIE EN COURS — streak (compte), NEUTRE (É3 : streaks neutres).
    { label: 'SÉRIE EN COURS', value: k.streak ? `${Math.abs(k.streak)}` : null, sub: k.streak > 0 ? 'gains d’affilée' : k.streak < 0 ? 'pertes d’affilée' : null },
    { label: 'CLÔTURES', value: k.tradesCount == null ? null : `${k.tradesCount}`, sub: 'total' },
  ];

  const panels = [
    { title: 'CAPITAL & LIQUIDITÉ', hero: true, cells: capital },
    { title: 'P&L', cells: pnl },
    { title: 'RISQUE & GREEKS', cells: greeks },
    { title: 'PERFORMANCE', cells: perf },
  ];

  return (
    <>
    <div className="pf-deck" aria-label="Portefeuille en un coup d'œil">
      {panels.map((p) => {
        // Pré-filtre : le rendu ne porte QUE les cellules servies → le
        // « lead » (S1) tombe sur la 1re cellule réelle du bloc, et la
        // règle CSS d'impair de fin voit le vrai décompte (N=1 inclus).
        const visible = p.cells.filter((c) => c.value != null);
        return (
          <div className="mk-cell pf-cell" key={p.title}>
            <div className="mk-title">{p.title}</div>
            {p.hero ? (
              <div className="pf-hero">
                {/* 1.G-b — DÉPLOYABLE (S0) = sizing.S1 × NLV. PIÈGE N-max : quota
                    atteint → « N max atteint », le montant passe en méta. NLV
                    absente → indéterminée, sans repli. Aucun seuil en dur. */}
                <div className="pf-hero__lbl">
                  DÉPLOYABLE
                  {k.nMaxReached ? (
                    <span className="pf-est" title={`Quota de positions atteint (N max = ${k.nMax}, carte V3 : N=1 sous 6000 CHF) — rien de déployable`}>N MAX</span>
                  ) : (
                    <span className="pf-real" title="Plafond de taille PAR POSITION — sizing S1 (60 % du NLV, registre)">S1</span>
                  )}
                </div>
                <div className="pf-hero__val">
                  <TickValue
                    text={
                      k.deployableUsd == null
                        ? 'indéterminée'
                        : k.nMaxReached
                          ? 'N max atteint'
                          : fmtUsd(k.deployableUsd)
                    }
                  />
                </div>
                <div className="pf-hero__meta">
                  {k.deployableUsd == null
                    ? 'NLV absente — sans repli'
                    : k.nMaxReached
                      ? `${fmtUsd(k.deployableUsd)}${fmtChf(k.deployableUsd, rate) ? ` · ${fmtChf(k.deployableUsd, rate)}` : ''} · quota ${k.nMax}`
                      : `${fmtChf(k.deployableUsd, rate) || ''}${k.deployablePct != null ? ` · ${Math.round(k.deployablePct)} % du NLV` : ''}`}
                </div>
              </div>
            ) : null}
            <div className="pf-grid">
              {visible.map((c, i) => (
                // Résidu 16.08 : EXPOSITION promue en S1 (provisoire — DÉPLOYABLE
                // prendra la place). Le lead tombe sur la 1re cellule de CHAQUE
                // bloc, CAPITAL inclus (le héros S0 reste l'ancre au-dessus).
                <Cell key={c.label} {...c} lead={i === 0} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
    {/* 1.G-b — LE BLOC PORTES : les 5 portes de sortie, une rangée par
        position. Absorbe la zone ATTENTION de la bande décision (morte).
        N=0 → cellule pleine largeur « AUCUNE POSITION · déployable … ». */}
    <PortesBloc deployableUsd={k.deployableUsd} rate={rate} />
    </>
  );
}
