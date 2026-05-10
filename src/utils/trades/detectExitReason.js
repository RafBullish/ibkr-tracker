// ═══════════════════════════════════════════════════════════════
//  EXIT-REASON DETECTION
//
//  Pure rule engine that infers why a closed trade exited the book,
//  based on the Sniper OTM playbook:
//    TP +50%       — profit target hit
//    SL -35%       — stop-loss tripped
//    45 DTE        — closed to avoid gamma/theta collapse near expiry
//    Pre-earnings  — closed before a reported earnings event
//    Stagnation    — held 30+ days with P&L flat (|pnl%| ≤ 10)
//    Manual / Unknown — anything else
//
//  Used by:
//    - The v2→v3 store migration (auto-backfill on every closed trade)
//    - The History Sniper view popover (re-detection on demand)
//
//  The function stays entirely pure — no React, no store, no I/O —
//  so tests and UI paths can share the same logic.
// ═══════════════════════════════════════════════════════════════

import { toFloat, ensurePositive } from '../math';
import { holdingDays, dteAtEntry as dayDiff } from '../dates';

const DAY_MS = 86400000;

/**
 * @param {object} trade  closed trade (tracker shape)
 * @param {object} [opts]
 * @param {Array<{ticker:string, date:string}>} [opts.earningsCalendar]
 *   Upcoming earnings dates per ticker. Used for the pre_earnings rule.
 * @returns {{ reason: string, confidence: 'high'|'medium'|'low' }}
 */
export function detectExitReason(trade, opts = {}) {
  const earningsCalendar = opts.earningsCalendar || [];

  const pi = toFloat(trade.pi);
  const ct = toFloat(trade.ct);
  const mu = ensurePositive(trade.mu);
  const cost = Math.abs(pi * mu * ct);
  const pnl = toFloat(trade.pnl);
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

  const hold = trade.di && trade.do ? holdingDays(trade.di, trade.do) : null;
  const dteAtExit = trade.do && trade.ex ? dayDiff(trade.do, trade.ex) : null;

  // Rule 1 — hard SL first: a -35%+ loss dominates any other concurrent signal.
  if (pnlPct <= -35) {
    return { reason: 'sl_35', confidence: 'high' };
  }

  // Rule 2 — TP at +50%. Flag medium confidence when the exit is also
  // near expiry with a borderline gain, because it could plausibly be
  // a dte_45 close that happened to land in the profit band.
  if (pnlPct >= 50) {
    if (dteAtExit != null && dteAtExit <= 45 && pnlPct >= 45 && pnlPct <= 55) {
      return { reason: 'tp_50', confidence: 'medium' };
    }
    return { reason: 'tp_50', confidence: 'high' };
  }

  // Rule 3 — pre-expiry close in the neutral band.
  if (dteAtExit != null && dteAtExit <= 45 && pnlPct > -35 && pnlPct < 50) {
    return { reason: 'dte_45', confidence: 'high' };
  }

  // Rule 4 — earnings event within 14 days after the close, for the
  // same ticker. Only evaluated when a calendar is provided.
  if (earningsCalendar.length > 0 && trade.do && trade.tk) {
    const exitMs = new Date(trade.do + 'T12:00:00').getTime();
    if (Number.isFinite(exitMs)) {
      const cutoff = exitMs + 14 * DAY_MS;
      const match = earningsCalendar.find((e) => {
        if (!e || e.ticker !== trade.tk || !e.date) return false;
        const earnMs = new Date(e.date + 'T12:00:00').getTime();
        return Number.isFinite(earnMs) && earnMs > exitMs && earnMs <= cutoff;
      });
      if (match) return { reason: 'pre_earnings', confidence: 'medium' };
    }
  }

  // Rule 5 — stagnation: long hold, flat outcome.
  if (hold != null && hold >= 30 && pnlPct >= -10 && pnlPct <= 10) {
    return { reason: 'stagnation', confidence: 'medium' };
  }

  return { reason: 'unknown', confidence: 'low' };
}

export const EXIT_REASONS = [
  'tp_50',
  'sl_35',
  'dte_45',
  'pre_earnings',
  'stagnation',
  'manual',
  'unknown',
];
