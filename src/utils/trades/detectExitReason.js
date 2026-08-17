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
// Q-A/Q-C — les valeurs de doctrine qui SURVIVENT viennent du REGISTRE
// (source unique) : SL exec -35, DTE 45, jour de stagnation 30, ET la bande
// de stagnation -20/+30 (RÉCONCILIÉE en Q-C, ex-±10). `tp_50` est CONSERVÉ
// comme LABEL D'HISTORIQUE (les trades passés ont bien sorti autour de +50 %
// sous la doctrine V2) — ce n'est plus une porte live (le TP fixe est mort,
// remplacé par le trailing P2). La fenêtre earnings 14 j est RETIRÉE (Q-C :
// elle n'était pas la porte P4 J-7/J-5 et ne se déclenchait jamais).
import {
  SL_EXECUTION_PCT,
  DTE_GATE_JOURS,
  STAGNATION_JOUR,
  STAGNATION_BANDE_BASSE_PCT,
  STAGNATION_BANDE_HAUTE_PCT,
} from '../../config/registre';

/**
 * @param {object} trade  closed trade (tracker shape)
 * @returns {{ reason: string, confidence: 'high'|'medium'|'low' }}
 */
export function detectExitReason(trade) {
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

  // Rule 4 (earnings 14 j après clôture) RETIRÉE en Q-C : ce n'était pas la
  // porte P4 (J-7 à J-5 AVANT les résultats) et elle ne se déclenchait jamais
  // (aucun calendrier n'était passé). La porte P4 live est dans utils/gates.

  // Rule 4 (ex-5) — stagnation : longue tenue, résultat plat. Le JOUR (30) et
  // la BANDE (-20/+30) viennent du registre P5 (bande RÉCONCILIÉE en Q-C, ex-±10).
  if (
    hold != null &&
    hold >= STAGNATION_JOUR &&
    pnlPct >= STAGNATION_BANDE_BASSE_PCT &&
    pnlPct <= STAGNATION_BANDE_HAUTE_PCT
  ) {
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
