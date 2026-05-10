// ═══════════════════════════════════════════════════════════════
//  useDailyPnL v4 brick 3 — daily P&L bar series from real store
//
//  Aggregates closedTrades by their close date `do` and sums pnls
//  in USD. The Master Chart renders one bar per close-date, fill
//  bull/bear par signe. Pas de remplissage des jours sans trade —
//  juste les jours qui ont eu au moins un fill.
//
//  Si on veut une bar pour chaque jour calendaire (zero-padding
//  les jours blanks) on le fera plus tard quand brick 3 calibration
//  aura tranché ce qui rend mieux à l'œil.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useClosedTrades, useSettings } from '../store/useStore';
import { tradePnlUsd } from '../utils/calculations';

/**
 * @returns {Array<{ date: string, dailyPnl: number }>}
 *          Trié par date croissante. Une entrée par close-date qui
 *          a eu au moins un trade. Empty si pas de closed trades.
 */
export function useDailyPnL() {
  const closedTrades = useClosedTrades();
  const settings = useSettings();
  const liveRate = settings?.liveRate || 1;

  return useMemo(() => {
    if (!closedTrades.length) return [];
    const byDate = new Map();
    for (const t of closedTrades) {
      const d = t.do || t.di;
      if (!d) continue;
      const cur = byDate.get(d) || 0;
      byDate.set(d, cur + tradePnlUsd(t, liveRate));
    }
    return [...byDate.entries()]
      .map(([date, dailyPnl]) => ({ date, dailyPnl: Number(dailyPnl.toFixed(2)) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [closedTrades, liveRate]);
}

export default useDailyPnL;
