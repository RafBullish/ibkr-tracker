// ═══════════════════════════════════════════════════════════════
//  POSITIONS UTILS v4 brick 6 + v5 Sprint 1.3 — purs, sans React
//
//  Helpers pour le module Live Positions (19 colonnes data grid v5).
//  Toutes les fonctions sont pures, acceptent des inputs vides /
//  invalides sans throw, et sont sign-aware (Long vs Short).
//
//    - unrealizedPnlUsd   : (mark − entry) × qty × mul × dirSign − fees
//    - unrealizedPnlPct   : unrealized / |cost basis| × 100
//    - dteFromExp         : jours calendaires entre ref et exp
//    - daysHeld           : jours calendaires entre di et ref
//    - detectAlert        : alerte la plus pressante {DTE | EARN | IV | …}
//    - sparkTrend         : direction sémantique d'une mini-série price
//                           (sign-aware via dir : ↑ price short = loss)
//    - formatGate         : raccourcit le nom d'un gate Sniper pour pill
//    - deriveEdgeTier     : E0..E4 from ivRank (v5 Sprint 1.3)
//    - computeNextGate    : SL35 / DTE45 candidate per position (v5 Sprint 1.3)
// ═══════════════════════════════════════════════════════════════

import { toFloat, ensurePositive } from './math';

/**
 * Unrealized P&L en USD pour une position ouverte.
 *   Long  : (mark − entry) × qty × mul − fees
 *   Short : (entry − mark) × qty × mul − fees
 * fees = pos.fi (entry commission). On n'inclut PAS l'exit fee anticipée.
 */
export function unrealizedPnlUsd(pos) {
  if (!pos) return 0;
  const entry = toFloat(pos.pi) || 0;
  const mark = toFloat(pos.pc) || 0;
  const qty = toFloat(pos.ct) || 0;
  const mul = ensurePositive(pos.mu);
  const fees = toFloat(pos.fi) || 0;
  const sign = pos.dir === 'Short' ? -1 : 1;
  return sign * (mark - entry) * qty * mul - fees;
}

/**
 * Unrealized P&L en % du cost basis (entry × qty × mul).
 * Le signe suit unrealizedPnlUsd. Retourne 0 si cost basis nul.
 */
export function unrealizedPnlPct(pos) {
  if (!pos) return 0;
  const entry = toFloat(pos.pi) || 0;
  const qty = toFloat(pos.ct) || 0;
  const mul = ensurePositive(pos.mu);
  const cost = entry * qty * mul;
  if (Math.abs(cost) < 1e-9) return 0;
  return (unrealizedPnlUsd(pos) / Math.abs(cost)) * 100;
}

/**
 * Jours calendaires depuis une date de référence (default: now)
 * jusqu'à l'expiration `exp`. Returns null si exp manquante / invalide.
 */
export function dteFromExp(exp, ref) {
  if (!exp) return null;
  const expMs = Date.parse(exp);
  const refMs = ref instanceof Date ? ref.getTime() : ref ? Date.parse(ref) : Date.now();
  if (!Number.isFinite(expMs) || !Number.isFinite(refMs)) return null;
  return Math.max(0, Math.round((expMs - refMs) / 86_400_000));
}

/**
 * Jours calendaires depuis l'entrée `di` jusqu'à ref (default now).
 * Returns 0 si di manquant / invalide.
 */
export function daysHeld(di, ref) {
  if (!di) return 0;
  const diMs = Date.parse(di);
  const refMs = ref instanceof Date ? ref.getTime() : ref ? Date.parse(ref) : Date.now();
  if (!Number.isFinite(diMs) || !Number.isFinite(refMs)) return 0;
  return Math.max(0, Math.round((refMs - diMs) / 86_400_000));
}

/**
 * Détecte l'alerte la plus pressante pour la position. Renvoie une
 * string parmi {'DTE', 'EARN', 'IV', 'PRICE', 'TIME'} ou null.
 *
 * Priorité (de plus pressant à moins pressant) :
 *   PRICE > TIME > DTE > EARN > IV
 *
 * Brick 6 : seules DTE / EARN / IV sont câblées. PRICE et TIME
 * dépendent de mécanismes que les bricks ultérieures injecteront
 * (custom alerts table, gate-imminent timer).
 *
 * @param {Object} pos                       open position
 * @param {Object} [context]
 * @param {Date}   [context.now]
 * @param {number} [context.ivr]             IV rank actuel (0..100)
 * @param {Array}  [context.earnings]        [{ tk, dte }] — earnings calendar
 */
export function detectAlert(pos, context = {}) {
  if (!pos) return null;
  const now = context.now;

  const dte = dteFromExp(pos.ex, now);
  if (dte != null && dte < 7) return 'DTE';

  if (Array.isArray(context.earnings) && pos.tk) {
    const upcoming = context.earnings.find(
      (e) => e?.tk === pos.tk && Number.isFinite(e?.dte) && e.dte >= 0 && e.dte < 14
    );
    if (upcoming) return 'EARN';
  }

  const ivr = context.ivr;
  if (Number.isFinite(ivr) && (ivr > 70 || ivr < 20)) return 'IV';

  return null;
}

/**
 * Direction sémantique d'une série de prix de longueur ≥ 2.
 * Sign-aware : pour une position Short, mark ↑ = loss.
 *
 * @param {Array<number>} prices   chronological mark prices
 * @param {string}        [dir]    'Long' (default) | 'Short'
 * @returns {'profit' | 'loss' | 'mute'}
 */
export function sparkTrend(prices, dir) {
  if (!Array.isArray(prices) || prices.length < 2) return 'mute';
  const first = prices[0];
  const last = prices[prices.length - 1];
  if (!Number.isFinite(first) || !Number.isFinite(last)) return 'mute';
  const delta = last - first;
  if (Math.abs(delta) < 1e-9) return 'mute';
  const dirSign = dir === 'Short' ? -1 : 1;
  return delta * dirSign > 0 ? 'profit' : 'loss';
}

/**
 * Convertit un nom de gate en sa version pill courte (≤ 5 chars).
 *   'EARN-J2'  → 'E-J2'
 *   'EARN+J30' → 'E+J30'
 *   'TP+TRAIL' → 'TP+TR'
 *   autres     → input as-is
 */
const GATE_DISPLAY = {
  SL35: 'SL35',
  DTE45: 'DTE45',
  'EARN-J2': 'E-J2',
  'EARN+J30': 'E+J30',
  'TP+TRAIL': 'TP+TR',
};
export function formatGate(gate) {
  if (!gate) return null;
  return GATE_DISPLAY[gate] || gate;
}

// ═══════════════════════════════════════════════════════════════
//  v5 Sprint 1.3 — Edge Tier derivation + Next Gate per position
// ═══════════════════════════════════════════════════════════════

/**
 * Auto-derive Edge Tier (E0..E4) from IV Rank snapshot.
 * Sniper OTM v1.0 Finale convention :
 *   E0 : IVR < 25
 *   E1 : 25 ≤ IVR < 40
 *   E2 : 40 ≤ IVR < 55
 *   E3 : 55 ≤ IVR < 70
 *   E4 : IVR ≥ 70
 *
 * Returns null when ivRank is missing or non-finite — let the caller
 * decide whether to render '—' or fall back to a sidecar-tagged value.
 */
export function deriveEdgeTier(ivRank) {
  if (ivRank == null || !Number.isFinite(ivRank)) return null;
  if (ivRank < 25) return 'E0';
  if (ivRank < 40) return 'E1';
  if (ivRank < 55) return 'E2';
  if (ivRank < 70) return 'E3';
  return 'E4';
}

const NEXT_GATE_DTE45 = 45;
const NEXT_GATE_SL35 = 35;

/**
 * Compute the closest upcoming Sniper gate for an open position.
 * Sprint 1.3 scope : SL35 + DTE45 (the two derivable from `ex` alone).
 * EARN-J2 / EARN+J30 / TP / TR land in this util progressively as
 * earnings calendar (Sprint 5/6) and sniper-meta tagging (Sprint 2)
 * surface their respective inputs.
 *
 * Returns { gateType, daysToTrigger, dte } or null when the position
 * has no parseable expiry or is a stock.
 */
export function computeNextGate(pos, ref) {
  if (!pos) return null;
  if (pos.as === 'Action') return null;
  const dte = dteFromExp(pos.ex, ref);
  if (dte == null) return null;

  const daysToDTE45 = dte - NEXT_GATE_DTE45;
  if (daysToDTE45 > 0) {
    return { gateType: 'DTE45', daysToTrigger: daysToDTE45, dte };
  }
  // DTE45 already passed — SL35 is the next milestone.
  const daysToSL35 = dte - NEXT_GATE_SL35;
  return { gateType: 'SL35', daysToTrigger: daysToSL35, dte };
}
