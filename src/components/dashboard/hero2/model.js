// ═══════════════════════════════════════════════════════════════
//  HÉROS 2 (brique 1.E « Réalisé ») — MODÈLE. Dérivations PURES du
//  réalisé depuis le store réel (closedTrades → useDailyPnL). Hero2 est
//  la maison PURE du RÉALISÉ (l'UNREALIZED reste en Héros 1).
//
//  Produit LES 3 VUES roadmap : CUMULÉ (running sum, courbe terminal),
//  QUOTIDIEN (barres jour), DISTRIBUTION (buckets $ par-trade) + la
//  MATRICE DE NON-PERTE (win rate · profit factor · payoff · expectancy
//  · max DD cumul · recovery — la preuve d'edge).
//
//  Loi de couleur : réalisé en $ (cumulé total, quotidien, gross,
//  extrêmes, distribution) = argent réel → rouge/vert par signe. La
//  COURBE cumulée (ligne du graphe) et les ratios/comptes = NEUTRES.
// ═══════════════════════════════════════════════════════════════

import { tradePnlUsd } from '../../../utils/calculations';
import { filterByTimeframe } from '../../../utils/equity';

// Running sum de la série quotidienne réalisée → trajectoire cumulée.
export function buildCumul(daily) {
  let c = 0;
  return (daily || []).map((p) => {
    c += p.dailyPnl || 0;
    return { date: p.date, cumul: Math.round(c * 100) / 100, dailyPnl: p.dailyPnl || 0 };
  });
}

// Adaptateur graphe terminal CUMULÉ : TvChartRealized lit `.nlv`
// (+ `.chg`/`.dayPnl` pour crosshair et marqueurs de clôture).
export function toTerminal(cumulSeries) {
  return (cumulSeries || []).map((p) => ({
    date: p.date,
    nlv: p.cumul,
    chg: p.dailyPnl,
    dayPnl: p.dailyPnl,
  }));
}

// Adaptateur graphe terminal QUOTIDIEN : barres jour (histogramme
// lightweight-charts). value = P&L réalisé du jour (argent réel).
export function toDaily(daily) {
  return (daily || []).map((p) => ({ date: p.date, value: p.dailyPnl || 0 }));
}

// Distribution des P&L par-trade en buckets symétriques autour de 0.
export function buildDistribution(pnls) {
  const clean = (pnls || []).filter((v) => Number.isFinite(v));
  if (!clean.length) return { bins: [], maxCount: 0, n: 0, step: 0, edge: 0 };
  const maxAbs = Math.max(...clean.map((v) => Math.abs(v)), 1);
  const step = maxAbs <= 1000 ? 100 : maxAbs <= 2500 ? 250 : maxAbs <= 6000 ? 500 : 1000;
  const edge = Math.ceil(maxAbs / step) * step;
  const bins = [];
  for (let lo = -edge; lo < edge; lo += step) {
    bins.push({ from: lo, to: lo + step, count: 0, side: lo + step <= 0 ? 'loss' : 'win' });
  }
  for (const v of clean) {
    let idx = Math.floor((v + edge) / step);
    if (idx < 0) idx = 0;
    if (idx >= bins.length) idx = bins.length - 1;
    bins[idx].count += 1;
  }
  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  return { bins, maxCount, n: clean.length, step, edge };
}

// Matrice de NON-PERTE : la preuve chiffrée que l'edge ne perd pas net.
export function buildMatrix(pnls, cumulSeries) {
  const clean = (pnls || []).filter((v) => Number.isFinite(v));
  const n = clean.length;
  const wins = clean.filter((v) => v > 0);
  const losses = clean.filter((v) => v < 0);
  const breakeven = clean.filter((v) => v === 0);
  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0; // magnitude ≥ 0
  const winRate = n ? (wins.length / n) * 100 : 0;
  const payoff = avgLoss > 0 ? avgWin / avgLoss : wins.length ? Infinity : null;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : wins.length ? Infinity : null;
  const realizedTotal = clean.reduce((a, b) => a + b, 0);
  const expectancy = n ? realizedTotal / n : 0;
  const best = n ? Math.max(...clean) : 0;
  const worst = n ? Math.min(...clean) : 0;

  // Max drawdown de la trajectoire CUMULÉE réalisée (pic → creux).
  let maxDD = 0;
  if (Array.isArray(cumulSeries) && cumulSeries.length) {
    let runPeak = cumulSeries[0].cumul;
    for (const p of cumulSeries) {
      if (p.cumul > runPeak) runPeak = p.cumul;
      const dd = runPeak - p.cumul;
      if (dd > maxDD) maxDD = dd;
    }
  }
  const recovery = maxDD > 0 ? realizedTotal / maxDD : null;

  return {
    n, wins: wins.length, losses: losses.length, breakeven: breakeven.length,
    winRate, avgWin, avgLoss, payoff, profitFactor, expectancy,
    realizedTotal, best, worst, maxDD, recovery, grossWin, grossLoss,
  };
}

// Stats jour (footer) : extrêmes de journée + % jours gagnants + série.
export function buildDayStats(daily) {
  const vals = (daily || []).map((p) => p.dailyPnl || 0);
  if (!vals.length) return { bestDay: 0, worstDay: 0, pctWinDays: null, activeDays: 0, longWin: 0, longLoss: 0 };
  const winDays = vals.filter((v) => v > 0).length;
  let longWin = 0, longLoss = 0, curW = 0, curL = 0;
  for (const v of vals) {
    if (v > 0) { curW += 1; curL = 0; if (curW > longWin) longWin = curW; }
    else if (v < 0) { curL += 1; curW = 0; if (curL > longLoss) longLoss = curL; }
    else { curW = 0; curL = 0; }
  }
  return {
    bestDay: Math.max(...vals),
    worstDay: Math.min(...vals),
    pctWinDays: vals.length ? (winDays / vals.length) * 100 : null,
    activeDays: vals.filter((v) => v !== 0).length,
    longWin, longLoss,
  };
}

/**
 * Modèle RÉALISÉ complet pour une fenêtre temporelle, dérivé de données
 * déjà lues par Hero2 (hooks). Fenêtrage cohérent (même référence date).
 *
 * @param {Object}   ctx
 * @param {Array}    ctx.dailyAll  useDailyPnL() — [{date, dailyPnl}]
 * @param {Array}    ctx.closed    closedTrades réels
 * @param {number}   ctx.rate      settings.liveRate (CHF/USD)
 * @param {string}   ctx.range     '5D'|'1M'|'3M'|'YTD'|'1Y'|'ALL'
 */
export function deriveRealized({ dailyAll, closed, rate, range = 'ALL' }) {
  const daily = filterByTimeframe(dailyAll || [], range);
  const cumul = buildCumul(daily);
  const refDate = daily.length ? daily[daily.length - 1].date : null;

  const perTradeAll = (closed || [])
    .map((t) => ({ pnl: tradePnlUsd(t, rate || 1), date: t.do || t.di, tk: t.tk || '—' }))
    .filter((t) => Number.isFinite(t.pnl) && t.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  const perTrade = filterByTimeframe(perTradeAll, range, refDate);
  const pnls = perTrade.map((t) => t.pnl);

  return {
    empty: cumul.length === 0,
    daily,
    cumul,
    terminalCumul: toTerminal(cumul),
    terminalDaily: toDaily(daily),
    perTrade,
    matrix: buildMatrix(pnls, cumul),
    dist: buildDistribution(pnls),
    dayStats: buildDayStats(daily),
    spanDays:
      daily.length > 1
        ? Math.round((Date.parse(daily[daily.length - 1].date) - Date.parse(daily[0].date)) / 86_400_000)
        : 0,
  };
}
