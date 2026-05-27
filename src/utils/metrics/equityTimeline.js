// @ts-check
// ═══════════════════════════════════════════════════════════════
//  equityTimeline — A3b foundation primitive.
//
//  Produces a date-ordered series of {date, cumPnL, capitalDeployedToDate,
//  realEquity} points — ONE source for the three A3b deliverables :
//    1. TWR (chained over sub-periods between funding flows).
//    2. Drawdowns unified (Current / YTD / All-Time, all on realEquity).
//    3. NLV hero badge (% growth of real equity over the window).
//
//  Funding flows extracted from `cashFlows` entries with funding `ty`
//  (dep_chf, wit_chf, dep_usd, wit_usd, adj_usd, fee_usd legacy). CHF
//  amounts converted to USD via liveRate as a documented approximation
//  (the per-transfer historical rate isn't stored — limitation tracked).
//
//  Null-safety :
//    - initialCapital null (A2.1 "unknown" state) → realEquity is still
//      computed from cumPnL only, but the helper flags `hasKnownBase`
//      so consumers can choose to skip relative computations.
//    - fxValid false (A3a) → CHF flows in the conversion will produce a
//      degraded picture ; we still emit a timeline (USD side stays sound).
// ═══════════════════════════════════════════════════════════════

import { toFloat } from '../math';
import { safeNum } from '../safeNum';
import { isValidFxRate } from '../fx/helpers';
import { tradePnlUsd } from '../calculations';

/**
 * @typedef {Object} TimelinePoint
 * @property {string} date                  ISO close date (or the synthetic seed date).
 * @property {number} cumPnL                cumulative realised PnL up to and including this trade (USD).
 * @property {number} capitalDeployedToDate sum of net funding flows AT OR BEFORE `date` (USD).
 * @property {number} realEquity            capitalDeployedToDate + cumPnL (USD).
 */

/**
 * @typedef {Object} FundingFlow
 * @property {string} date     ISO date of the flow.
 * @property {number} netUsd   signed amount in USD (positive = deposit).
 */

/**
 * @typedef {Object} EquityTimeline
 * @property {TimelinePoint[]} points
 * @property {FundingFlow[]}  flows           sorted asc by date.
 * @property {string|null}    firstFlowDate
 * @property {boolean}        hasKnownBase    true iff initialCapital > 0.
 */

/**
 * Extract funding flows from the cashFlows array, in USD-equivalent.
 * CHF amounts converted via the CURRENT liveRate — known limitation,
 * the historical per-transfer rate is not stored. Non-funding entries
 * (dividends, fees, fx trades) are ignored.
 *
 * @param {Array<Object>} cashFlows
 * @param {number|null|undefined} liveRate  CHF per USD
 * @returns {FundingFlow[]}                 sorted ascending by date
 */
export function extractFundingFlows(cashFlows, liveRate) {
  if (!Array.isArray(cashFlows)) return [];
  const lr = isValidFxRate(liveRate) ? liveRate : null;
  /** @type {FundingFlow[]} */
  const out = [];
  for (const cf of cashFlows) {
    const date = cf?.da;
    const a1 = toFloat(cf?.a1);
    if (!date || a1 === 0) continue;
    let netUsd = 0;
    switch (cf.ty) {
      case 'dep_chf':
      case 'adj_chf':
        if (lr == null) continue;
        netUsd = a1 / lr;
        break;
      case 'wit_chf':
        if (lr == null) continue;
        netUsd = -a1 / lr;
        break;
      case 'dep_usd':
      case 'adj_usd':
        netUsd = a1;
        break;
      case 'wit_usd':
      case 'fee_usd':
        netUsd = -a1;
        break;
      default:
        continue;
    }
    if (Number.isFinite(netUsd) && netUsd !== 0) {
      out.push({ date, netUsd });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/**
 * Build the equity timeline from closed trades + funding flows.
 *
 * @param {Object} args
 * @param {Array<Object>} args.closedTrades  tracker shape
 * @param {Array<Object>} args.cashFlows     state.cashFlows
 * @param {number|null}   args.initialCapital  USD-equivalent (A2.2 resolution). null = unknown.
 * @param {number|null}   args.liveRate
 * @returns {EquityTimeline}
 */
export function buildEquityTimeline({ closedTrades, cashFlows, initialCapital, liveRate }) {
  const flows = extractFundingFlows(cashFlows, liveRate);
  const firstFlowDate = flows.length > 0 ? flows[0].date : null;
  const hasKnownBase = typeof initialCapital === 'number' && initialCapital > 0;

  const trades = Array.isArray(closedTrades) ? closedTrades : [];
  const sorted = trades
    .slice()
    .filter((t) => t && t.do)
    .sort((a, b) => (a.do || '').localeCompare(b.do || ''));

  /** @type {TimelinePoint[]} */
  const points = [];

  // Helper : capital deployed at (or just before) `date`, computed
  // cumulatively from flows. When flows are empty but initialCapital
  // is known, fall back to initialCapital constant (single deployment
  // at the start of the period).
  function capitalDeployedAt(date) {
    if (flows.length === 0) {
      return hasKnownBase ? /** @type {number} */ (initialCapital) : 0;
    }
    let sum = 0;
    for (const f of flows) {
      if (f.date <= date) sum += f.netUsd;
      else break;
    }
    return sum;
  }

  let cumPnL = 0;
  for (const t of sorted) {
    const pnl = safeNum(tradePnlUsd(t, isValidFxRate(liveRate) ? liveRate : 1), 0);
    cumPnL += pnl;
    const cap = capitalDeployedAt(t.do);
    points.push({
      date: t.do,
      cumPnL: Number(cumPnL.toFixed(2)),
      capitalDeployedToDate: Number(cap.toFixed(2)),
      realEquity: Number((cap + cumPnL).toFixed(2)),
    });
  }

  return {
    points,
    flows,
    firstFlowDate,
    hasKnownBase,
  };
}
