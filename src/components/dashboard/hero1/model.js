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
  };
}
