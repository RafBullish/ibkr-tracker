// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros2 (brique 1.E « Héros 2 — Realized »). DEV-only,
//  purgé en fin de brique. Modèle de données RÉALISÉ dérivé du store
//  réel (closedTrades → useDailyPnL) — mêmes sources que le Dashboard.
//
//  Produit : série QUOTIDIENNE (réalisé par date), série CUMULÉE
//  (running sum), adaptateur GRAPHE TERMINAL (TvChart lit .nlv),
//  DISTRIBUTION par bucket de P&L par-trade, et la MATRICE DE
//  NON-PERTE (win rate · payoff · profit factor · expectancy · max DD
//  cumul · recovery). Loi de couleur : tout ce qui est réalisé en $ est
//  argent réel (rouge/vert par signe autorisé) ; ratios/comptes neutres.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useClosedTrades, useSettings } from '../../store/useStore';
import useDailyPnL from '../../hooks/useDailyPnL';
import { tradePnlUsd } from '../../utils/calculations';
import { filterByTimeframe } from '../../utils/equity';

// Running sum de la série quotidienne réalisée → trajectoire cumulée.
export function buildCumul(daily) {
  let c = 0;
  return (daily || []).map((p) => {
    c += p.dailyPnl || 0;
    return { date: p.date, cumul: Math.round(c * 100) / 100, dailyPnl: p.dailyPnl || 0 };
  });
}

// Adaptateur graphe terminal : TvChart lit `.nlv` (+ `.chg`/`.dayPnl`
// pour le crosshair et les marqueurs de clôture). On projette la
// trajectoire cumulée réalisée sur ce contrat → réutilisation directe.
export function toTerminal(cumulSeries) {
  return (cumulSeries || []).map((p) => ({
    date: p.date,
    nlv: p.cumul,
    chg: p.dailyPnl,
    dayPnl: p.dailyPnl,
  }));
}

// Distribution des P&L par-trade en buckets symétriques autour de 0.
// bins = [{ from, to, count, side: 'loss'|'win', label }]. La hauteur
// (count) est neutre ; le côté (perte/gain) reflète de l'argent réalisé.
export function buildDistribution(pnls) {
  const clean = (pnls || []).filter((v) => Number.isFinite(v));
  if (!clean.length) return { bins: [], maxCount: 0, n: 0 };
  const maxAbs = Math.max(...clean.map((v) => Math.abs(v)), 1);
  // Pas « rond » : 100 sous 1k, 250 sous 2.5k, sinon 500.
  const step = maxAbs <= 1000 ? 100 : maxAbs <= 2500 ? 250 : 500;
  const edge = Math.ceil(maxAbs / step) * step;
  const bins = [];
  for (let lo = -edge; lo < edge; lo += step) {
    const hi = lo + step;
    bins.push({ from: lo, to: hi, count: 0, side: hi <= 0 ? 'loss' : 'win' });
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

  // Max drawdown de la trajectoire CUMULÉE réalisée (peak-to-trough).
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

/**
 * Modèle RÉALISÉ complet pour une fenêtre temporelle. Toutes les
 * dérivations sont fenêtrées de façon cohérente (même référence de date).
 *
 * @param {string} range  '5D'|'1M'|'3M'|'YTD'|'1Y'|'ALL'
 */
export function useRealizedModel(range = 'ALL') {
  const closed = useClosedTrades();
  const settings = useSettings();
  const rate = settings?.liveRate || null;
  const dailyAll = useDailyPnL();

  return useMemo(() => {
    const daily = filterByTimeframe(dailyAll, range);
    const cumul = buildCumul(daily);
    const refDate = daily.length ? daily[daily.length - 1].date : null;

    // P&L par-trade (argent réalisé), fenêtré par la même référence.
    const perTradeAll = (closed || [])
      .map((t) => ({ pnl: tradePnlUsd(t, rate || 1), date: t.do || t.di, tk: t.tk || '—' }))
      .filter((t) => Number.isFinite(t.pnl) && t.date)
      .sort((a, b) => a.date.localeCompare(b.date));
    const perTrade = filterByTimeframe(perTradeAll, range, refDate);
    const pnls = perTrade.map((t) => t.pnl);

    return {
      rate,
      empty: cumul.length === 0,
      daily,
      cumul,
      terminal: toTerminal(cumul),
      perTrade,
      matrix: buildMatrix(pnls, cumul),
      dist: buildDistribution(pnls),
      spanDays:
        daily.length > 1
          ? Math.round((Date.parse(daily[daily.length - 1].date) - Date.parse(daily[0].date)) / 86_400_000)
          : 0,
    };
  }, [closed, dailyAll, rate, range]);
}

export default useRealizedModel;
