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
// Q-A (16.08) — les valeurs de doctrine qui SURVIVENT en V3 viennent du
// REGISTRE (source unique), à VALEUR IDENTIQUE : SL exec -35, DTE 45, jour de
// stagnation 30. LEGACY/DIVERGENT laissés en place (Q-C recâble/réconcilie) :
// le TP fixe +50 % (tp_50, mort en V3), la fenêtre earnings 14 j après clôture
// (≠ P4 J-7/J-5), la bande de stagnation ±10 % (≠ registre P5 -20/+30).
import { SL_EXECUTION_PCT, DTE_GATE_JOURS, STAGNATION_JOUR } from '../../config/registre';

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
  if (pnlPct <= SL_EXECUTION_PCT) {
    return { reason: 'sl_35', confidence: 'high' };
  }

  // Rule 2 — TP at +50%. LEGACY : le take-profit fixe +50 % est MORT en V3
  // (supprimé le 16.08 ; remplacé par le trailing P2). Conservé ici comme
  // étiquette d'HISTORIQUE des trades passés — Q-C décide de son sort.
  if (pnlPct >= 50) {
    if (dteAtExit != null && dteAtExit <= DTE_GATE_JOURS && pnlPct >= 45 && pnlPct <= 55) {
      return { reason: 'tp_50', confidence: 'medium' };
    }
    return { reason: 'tp_50', confidence: 'high' };
  }

  // Rule 3 — pre-expiry close in the neutral band (borne haute 50 = LEGACY TP).
  if (dteAtExit != null && dteAtExit <= DTE_GATE_JOURS && pnlPct > SL_EXECUTION_PCT && pnlPct < 50) {
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

  // Rule 5 — stagnation: long hold, flat outcome. Le JOUR (30) vient du
  // registre P5 (identique). ⚠ La bande ±10 % DIVERGE du registre P5
  // (-0.20 / +0.30) : ÉCART DE VALEUR laissé en place — réconciliation en
  // Q-C (Q-A ne recâble pas la logique).
  if (hold != null && hold >= STAGNATION_JOUR && pnlPct >= -10 && pnlPct <= 10) {
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
