// @ts-check
// ═══════════════════════════════════════════════════════════════
//  computeTWR — A3b time-weighted return.
//
//  TWR chained over sub-periods defined by the funding-flow schedule.
//  For each sub-period [flow_i.date, flow_{i+1}.date) :
//     MV_start = capitalDeployed_at(flow_i) + cumPnL_at(flow_i.date)
//     MV_end   = capitalDeployed_at(flow_i) + cumPnL_at(flow_{i+1}.date)
//     r_i      = MV_end / MV_start − 1
//  TWR_total = Π(1 + r_i) − 1
//
//  This NEUTRALISES the timing of deposits — a 1500-CHF apport mid-period
//  does not pollute the rendement. Result is the pure "comment ton trading
//  performe" indicator vs the simple cumulative `realised / init`
//  (REALIZED %), which mechanically rewards big later deposits.
//
//  Annualisation rule (cohérente A2.2 CAGR) :
//    yearsActive ≥ 1 → (1+TWR)^(1/years) − 1, label "annualised"
//    0 < years < 1 → TWR brut, label "cumulative"
//
//  Significance gate : trades ≥ MIN_TRADES_ANNUALIZED. Capital gate is
//  implicit (MV_start must be > 0 for the ratio to compute). When the
//  capitalDeployed schedule is empty AND initialCapital is unknown, the
//  result is null (cannot anchor any sub-period MV).
// ═══════════════════════════════════════════════════════════════

import {
  significanceCheck,
  MIN_TRADES_ANNUALIZED,
} from '../significance';
import { safeNum } from '../safeNum';

/**
 * @typedef {Object} TWRResult
 * @property {number|null} value  percentage (annualised or cumulative)
 * @property {'annualised'|'cumulative'|null} mode
 * @property {number} subPeriods  number of sub-periods chained
 * @property {number|null} totalRaw  raw (non-annualised) TWR percentage
 */

/**
 * @param {Object} args
 * @param {Array<{date: string, cumPnL: number, capitalDeployedToDate: number}>} args.points
 *   Equity timeline from buildEquityTimeline.
 * @param {Array<{date: string, netUsd: number}>} args.flows  Sorted asc funding flows.
 * @param {number}      args.yearsActive
 * @param {number}      args.tradesCount
 * @param {number|null} args.initialCapital  Used as a single-deployment fallback
 *   when `flows` is empty but a base is known.
 * @returns {TWRResult}
 */
export function computeTWR({ points, flows, yearsActive, tradesCount, initialCapital }) {
  const empty = /** @type {TWRResult} */ ({
    value: null,
    mode: null,
    subPeriods: 0,
    totalRaw: null,
  });

  // Significance gate — capital is implicit (MV_start > 0). Years > 0 required.
  const gate = significanceCheck(
    { trades: tradesCount },
    { trades: MIN_TRADES_ANNUALIZED }
  );
  if (!gate.ok) return empty;
  if (!(typeof yearsActive === 'number' && yearsActive > 0)) return empty;

  const pts = Array.isArray(points) ? points : [];
  if (pts.length === 0) return empty;

  // Build the schedule of "break points" (sub-period boundaries). If no
  // funding flows are present but we have a known initialCapital, treat
  // the first trade date as a single synthetic deployment date.
  const flowSchedule = Array.isArray(flows) && flows.length > 0
    ? flows
    : (typeof initialCapital === 'number' && initialCapital > 0
        ? [{ date: pts[0].date, netUsd: initialCapital }]
        : []);
  if (flowSchedule.length === 0) return empty;

  // Helper : cumPnL at (or just before) a given date. If the date is
  // before any trade, cumPnL = 0. If after all trades, the last cumPnL.
  function cumPnLAtOrBefore(d) {
    let last = 0;
    for (const p of pts) {
      if (p.date <= d) last = p.cumPnL;
      else break;
    }
    return last;
  }

  // Helper : capital deployed at (or just before) `d` — cumulative flows.
  function capitalDeployedAt(d) {
    let sum = 0;
    for (const f of flowSchedule) {
      if (f.date <= d) sum += f.netUsd;
      else break;
    }
    return sum;
  }

  // Sub-period boundaries : flow dates, plus the very last trade date as
  // the implicit "end of last sub-period".
  const lastTradeDate = pts[pts.length - 1].date;
  /** @type {string[]} */
  const boundaries = flowSchedule.map((f) => f.date);
  if (boundaries[boundaries.length - 1] < lastTradeDate) {
    boundaries.push(lastTradeDate);
  }

  let chain = 1;
  let subPeriods = 0;
  for (let i = 0; i < boundaries.length - 1; i++) {
    const startDate = boundaries[i];
    const endDate = boundaries[i + 1];
    // Capital deployed at start (includes the flow at startDate).
    const capStart = capitalDeployedAt(startDate);
    const pnlStart = cumPnLAtOrBefore(startDate);
    const pnlEnd = cumPnLAtOrBefore(endDate);
    const mvStart = capStart + pnlStart;
    const mvEnd = capStart + pnlEnd;
    if (!(mvStart > 0)) continue;
    if (!Number.isFinite(mvEnd) || !Number.isFinite(mvStart)) continue;
    const r = mvEnd / mvStart - 1;
    if (!Number.isFinite(r)) continue;
    chain *= 1 + r;
    subPeriods++;
  }

  if (subPeriods === 0) return empty;

  const total = chain - 1;
  const totalPct = total * 100;
  if (!Number.isFinite(totalPct)) return empty;

  if (yearsActive >= 1) {
    const annualised = (Math.pow(1 + total, 1 / yearsActive) - 1) * 100;
    return {
      value: safeNum(annualised, null),
      mode: 'annualised',
      subPeriods,
      totalRaw: safeNum(totalPct, null),
    };
  }
  return {
    value: safeNum(totalPct, null),
    mode: 'cumulative',
    subPeriods,
    totalRaw: safeNum(totalPct, null),
  };
}
