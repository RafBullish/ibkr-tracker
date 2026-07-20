// ═══════════════════════════════════════════════════════════════
//  HÉROS 1 (brique 1.D) — MODÈLE KPI de la zone haute portefeuille.
//  Dérive l'état LIVE du portefeuille depuis les hooks du store, pour
//  le PortfolioDeck (sous-panneaux denses façon MarketDeck).
//  Loi de couleur : profit/loss UNIQUEMENT sur argent réel (DAY,
//  UNREALIZED, REALIZED, MTD, YTD). Liquidité / Θ / Δ / Γ / V = neutres.
// ═══════════════════════════════════════════════════════════════

// Micro-série pour le sparkline du héros NLV overlay (zone graphe).
const sparkFrom = (series, key, n = 30) =>
  (Array.isArray(series) ? series.slice(-n).map((p) => p[key]).filter((x) => Number.isFinite(x)) : []);

export function deriveKpisReal(ctx) {
  const {
    metrics, greeks, availableUsd, riskDollar, positions, series,
    winRate, profitFactor, expectancy, tradesCount, mtd, ytd, wtd,
    trading, notional, today,
  } = ctx;
  const nlv = metrics?.netLiquidationValueUsd ?? null;
  const num = (x) => (Number.isFinite(x) ? x : null);
  const last = series && series.length ? series[series.length - 1] : null;
  const prev = series && series.length > 1 ? series[series.length - 2] : null;
  const dayPnl = last && prev ? last.flowNeutral - prev.flowNeutral : null;
  const dayPct = dayPnl != null && prev && prev.nlv > 0 ? (dayPnl / prev.nlv) * 100 : null;

  // DTE le plus proche (positions option ouvertes).
  let dte = null;
  let dteTicker = null;
  const todayMs = Date.parse(today);
  for (const p of positions || []) {
    if (p?.as !== 'Option' || !p.ex) continue;
    const d = Math.round((Date.parse(p.ex) - todayMs) / 86_400_000);
    if (Number.isFinite(d) && (dte == null || d < dte)) { dte = d; dteTicker = p.tk || null; }
  }

  return {
    // graphe (overlay) — inchangé
    nlv, nlvSpark: sparkFrom(series, 'nlv', 30),
    // CAPITAL & LIQUIDITÉ
    powder: availableUsd ?? null,
    powderPct: availableUsd != null && nlv > 0 ? (availableUsd / nlv) * 100 : null,
    exposure: metrics?.totalExposure ?? null,
    expoPct: metrics?.totalExposure != null && nlv > 0 ? (metrics.totalExposure / nlv) * 100 : null,
    positionsCount: Array.isArray(positions) ? positions.length : null,
    dte, dteTicker,
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
    expectancy: num(expectancy),
    tradesCount: num(tradesCount),
    sharpe: num(metrics?.sharpeRatio),
    sortino: num(metrics?.sortinoRatio),
    bestTrade: num(trading?.bestTrade),
    worstTrade: num(trading?.worstTrade),
    avgWin: num(trading?.avgWin) ?? num(metrics?.averageWin),
    avgLoss: num(trading?.avgLoss) ?? num(metrics?.averageLoss),
  };
}
