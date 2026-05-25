// @ts-check
// ═══════════════════════════════════════════════════════════════
//  computeWinRate — A2b : decisive-gated percentage.
//
//  ALWAYS exposes the raw counters (winCount, lossCount, breakEvenCount,
//  decisive) so the display layer can render the bare fraction "x/y" when
//  there isn't enough data. The PERCENTAGE (`winRate`, `lossRate`) is
//  null when `decisive < MIN_DECISIVE_WINRATE (10)` — a 1/1 trade should
//  never paint the donut as "100 % win" with a green tone.
// ═══════════════════════════════════════════════════════════════

import { MIN_DECISIVE_WINRATE } from '../significance';

/**
 * @typedef {Object} WinRateResult
 * @property {number|null} winRate     % wins among decisive trades, or null when decisive < 10
 * @property {number|null} lossRate    % losses among decisive trades, or null when decisive < 10
 * @property {number} winCount         number of trades with pnl > 0
 * @property {number} lossCount        number of trades with pnl < 0
 * @property {number} breakEvenCount   number of trades with pnl === 0
 * @property {number} decisive         winCount + lossCount
 */

/**
 * @param {number[]} pnls per-trade P&L (order does not matter)
 * @returns {WinRateResult}
 */
export function computeWinRate(pnls) {
  let winCount = 0;
  let lossCount = 0;
  let breakEvenCount = 0;
  if (Array.isArray(pnls)) {
    for (let i = 0; i < pnls.length; i++) {
      const pnl = pnls[i];
      if (typeof pnl !== 'number' || !Number.isFinite(pnl)) continue;
      if (pnl > 0) winCount++;
      else if (pnl < 0) lossCount++;
      else breakEvenCount++;
    }
  }
  const decisive = winCount + lossCount;
  // A2b gate : percentage only meaningful when at least
  // MIN_DECISIVE_WINRATE decisive trades have happened. Counters always
  // returned so the display can render the bare fraction.
  const gated = decisive >= MIN_DECISIVE_WINRATE;
  const winRate = gated ? (winCount / decisive) * 100 : null;
  const lossRate = gated ? (lossCount / decisive) * 100 : null;
  return { winRate, lossRate, winCount, lossCount, breakEvenCount, decisive };
}
