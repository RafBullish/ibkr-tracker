// ═══════════════════════════════════════════════════════════════
//  HÉROS 1 (brique 1.D) — MODÈLE KPI de la zone haute portefeuille.
//  Dérive l'état LIVE du portefeuille depuis les hooks du store, pour
//  le PortfolioDeck (sous-panneaux denses façon MarketDeck).
//  Loi de couleur : profit/loss UNIQUEMENT sur argent réel (DAY,
//  UNREALIZED, REALIZED, MTD, YTD). Liquidité / Θ / Δ / Γ / V = neutres.
//  É3 §4.2.5 : expectancy gatée à MIN_DECISIVE_WINRATE trades décisifs
//  (une seule vérité avec la bande décision et le deck Héros 2).
// ═══════════════════════════════════════════════════════════════

import { MIN_DECISIVE_WINRATE } from '../../../utils/significance';
// É3 §4.2.6 — moteur DTE unique (clampé 0) + détection expirée.
import { dteFromExp, isExpired } from '../../../utils/positions';

// Micro-série pour le sparkline du héros NLV overlay (zone graphe).
const sparkFrom = (series, key, n = 30) =>
  (Array.isArray(series) ? series.slice(-n).map((p) => p[key]).filter((x) => Number.isFinite(x)) : []);

export function deriveKpisReal(ctx) {
  const {
    metrics, greeks, availableUsd, availableIsReal, riskDollar, positions, series,
    winRate, profitFactor, expectancy, tradesCount, mtd, ytd, wtd,
    trading, notional, today,
  } = ctx;
  const nlv = metrics?.netLiquidationValueUsd ?? null;
  const num = (x) => (Number.isFinite(x) ? x : null);
  const last = series && series.length ? series[series.length - 1] : null;
  const prev = series && series.length > 1 ? series[series.length - 2] : null;
  const dayPnl = last && prev ? last.flowNeutral - prev.flowNeutral : null;
  const dayPct = dayPnl != null && prev && prev.nlv > 0 ? (dayPnl / prev.nlv) * 100 : null;

  // DTE le plus proche (positions option ouvertes) — moteur unique
  // dteFromExp (clampé 0, É3 §4.2.6) : plus de DTE négatif possible ;
  // une option expirée est signalée telle quelle (dteExpired → « EXP »).
  let dte = null;
  let dteTicker = null;
  let dteExpired = false;
  for (const p of positions || []) {
    if (p?.as !== 'Option' || !p.ex) continue;
    const d = dteFromExp(p.ex, today);
    if (d != null && (dte == null || d < dte)) {
      dte = d;
      dteTicker = p.tk || null;
      dteExpired = isExpired(p.ex, today);
    }
  }

  // 1.G-a — cellules display-only supplémentaires (données DÉJÀ calculées,
  // aucune source nouvelle). Amendements 16.08 : Θ% PAR POSITION, HWM inversé.
  const liveRate = num(metrics?.liveRate);
  const fundedUsd = num(metrics?.totalFundedUsd) ?? 0;
  const depChf = num(metrics?.totalDepositedChf) ?? 0;
  // Apports nets, USD-équivalent (le CHF natif converti au FX courant).
  const apportsUsdEq = fundedUsd + (liveRate > 0 ? depChf / liveRate : 0);

  // HWM NET D'APPORTS — présentation INVERSÉE (amendement 16.08). La valeur
  // héros de la cellule = l'ÉCART courant au pic (drawdown flow-neutral déjà
  // calculé sur le dernier point, rapporté à la NLV au pic → jamais absurde).
  // La méta NOMME sa base (correctif 16.08) : « pic NLV {niveau} · {date} » où
  // le NIVEAU = la NLV BRUTE au point de pic flow-neutral (hwmNlv de
  // nlvSeries), PAS le flowNeutral. peakFN sélectionne le pic ; peakNlv = la
  // NLV de ce point ; peakDate = son jour. Gaté à ≥ 2 points (pas de HWM à J0).
  let peakFN = -Infinity;
  let peakDate = null;
  let peakNlv = null;
  for (const p of series || []) {
    if (Number.isFinite(p?.flowNeutral) && p.flowNeutral > peakFN) {
      peakFN = p.flowNeutral;
      peakDate = p.date || null;
      peakNlv = Number.isFinite(p.nlv) ? p.nlv : null;
    }
  }
  const enoughSeries = (series?.length ?? 0) >= 2;
  const hwmLevel = enoughSeries && Number.isFinite(peakNlv) ? peakNlv : null;   // NLV brute au pic
  const hwmDate = enoughSeries ? peakDate : null;
  const hwmEcartPct = enoughSeries && last && Number.isFinite(last.drawdownPct) ? last.drawdownPct : null;

  // Θ % PRIME/JOUR — PAR POSITION (amendement 16.08 : l'agrégat est
  // ininterprétable face au seuil 0,8 %). Pour chaque position OPTION :
  // |Θ/jour de la position| ÷ VALEUR AU MARK COURANT (correctif 16.08 :
  // pc×mul×ct, PAS la prime d'entrée pi — theta rapporté à la valeur COURANTE
  // de l'option). On retient la plus décroissante (MAX) + son ticker + son
  // DTE. Θ/jour = g.theta (per-share, per-AN) ÷ 365 × ct × mul (cf. greeks).
  // NEUTRE (Θ est un greek). '—' tant que les greeks async ne sont pas là.
  const gmap = greeks?.greeksMap ?? null;
  let maxThetaPct = null;
  let maxThetaTicker = null;
  let maxThetaDte = null;
  let maxThetaExpired = false;
  for (const p of positions || []) {
    if (p?.as !== 'Option') continue;
    const g = gmap?.get?.(p.id);
    if (!g || g.source === 'unavailable' || g.theta == null) continue;
    const mul = Math.abs(Number(p.mu)) || 100;
    const ct = Math.abs(Number(p.ct)) || 0;
    const pc = Number(p.pc);
    const markValue = Number.isFinite(pc) && pc > 0 ? pc * mul * ct : 0;
    if (!(markValue > 0)) continue;
    const posThetaDay = Math.abs((g.theta / 365) * ct * mul);
    const pct = (posThetaDay / markValue) * 100;
    if (maxThetaPct == null || pct > maxThetaPct) {
      maxThetaPct = pct;
      maxThetaTicker = p.tk || null;
      maxThetaDte = p.ex ? dteFromExp(p.ex, today) : null;
      maxThetaExpired = p.ex ? isExpired(p.ex, today) : false;
    }
  }

  return {
    // graphe (overlay) — inchangé
    nlv, nlvSpark: sparkFrom(series, 'nlv', 30),
    // CAPITAL & LIQUIDITÉ — powder = liquidité déployable (réelle IBKR ou
    // estimation cash-A). powderIsReal pilote le marqueur IBKR / est.
    powder: availableUsd ?? null,
    powderIsReal: availableIsReal === true && availableUsd != null,
    powderPct: availableUsd != null && nlv > 0 ? (availableUsd / nlv) * 100 : null,
    exposure: metrics?.totalExposure ?? null,
    expoPct: metrics?.totalExposure != null && nlv > 0 ? (metrics.totalExposure / nlv) * 100 : null,
    positionsCount: Array.isArray(positions) ? positions.length : null,
    dte, dteTicker, dteExpired,
    notional: num(notional),
    nlvAtRiskPct: riskDollar != null && nlv > 0 ? (riskDollar / nlv) * 100 : null,
    // P&L
    dayPnl, dayPct,
    wtd: num(wtd),
    unrealized: metrics?.unrealizedPnlUsd ?? null,
    realized: metrics?.realizedPnlUsd ?? null,
    mtd: num(mtd) ?? num(metrics?.monthlyPnlUsd),
    ytd: num(ytd),
    // RISQUE & GREEKS
    riskDollar: riskDollar ?? null,
    thetaDay: num(greeks?.thetaDaily),
    netDeltaShares: num(greeks?.sumDelta),
    netDeltaDollar: num(greeks?.notionalDelta),
    gamma: num(greeks?.sumGamma),
    vega: num(greeks?.sumVega),
    // PERFORMANCE
    winRate: winRate ?? null,
    profitFactor: profitFactor ?? null,
    // Expectancy : « — » honnête sous 10 trades décisifs (wins+losses),
    // même gate que deriveForme. decisive exposé pour le sub du deck.
    expectancy:
      (trading?.winCount ?? 0) + (trading?.lossCount ?? 0) >= MIN_DECISIVE_WINRATE
        ? num(expectancy)
        : null,
    expectancyDecisive: (trading?.winCount ?? 0) + (trading?.lossCount ?? 0),
    tradesCount: num(tradesCount),
    sharpe: num(metrics?.sharpeRatio),
    sortino: num(metrics?.sortinoRatio),
    bestTrade: num(trading?.bestTrade),
    worstTrade: num(trading?.worstTrade),
    avgWin: num(trading?.avgWin) ?? num(metrics?.averageWin),
    avgLoss: num(trading?.avgLoss) ?? num(metrics?.averageLoss),
    // 1.G-a — CAPITAL (neutres, display-only). apports 0 → cellule tue.
    apportsCumules: Math.abs(apportsUsdEq) >= 0.5 ? apportsUsdEq : null,
    // HWM inversé : écart = valeur héros ; niveau + date = méta.
    hwmEcartPct,
    hwmLevel,
    hwmDate,
    // P&L — FRAIS CUMULÉS (neutre : déjà inclus dans le RÉALISÉ net).
    feesTotal: num(metrics?.totalAllFees),
    // GREEKS — Θ % prime/jour PAR POSITION (max, neutre) + ticker + DTE · série.
    thetaPctPrime: maxThetaPct,
    thetaPctTicker: maxThetaTicker,
    thetaPctDte: maxThetaDte,
    thetaPctExpired: maxThetaExpired,
    streak: num(metrics?.currentStreak),
  };
}
