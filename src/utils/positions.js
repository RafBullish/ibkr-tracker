// ═══════════════════════════════════════════════════════════════
//  POSITIONS UTILS v4 brick 6 + v5 Sprint 1.3 — purs, sans React
//
//  Helpers pour le module Live Positions (data grid v5, 15 col É3.2).
//  Toutes les fonctions sont pures, acceptent des inputs vides /
//  invalides sans throw, et sont sign-aware (Long vs Short).
//
//    - unrealizedPnlUsd   : (mark − entry) × qty × mul × dirSign − fees
//    - unrealizedPnlPct   : unrealized / |cost basis| × 100
//    - dteFromExp         : jours calendaires entre ref et exp
//    - daysHeld           : jours calendaires entre di et ref
//    - detectAlert        : alerte la plus pressante {DTE | EARN | IV | …}
//                           (sign-aware via dir : ↑ price short = loss)
//    - deriveEdgeTier     : E0..E4 from ivRank (v5 Sprint 1.3)
//
//  É3 §4.2.1 : computeNextGate et formatGate sont MORTS (0 consommateur
//  après le passage de la colonne GATE au classifieur deriveAttention).
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
 * É3 §4.2.6 — moteur DTE UNIQUE de l'app, clampé à 0 : jamais de
 * « DTE −3 j » à l'écran. Une position expirée se détecte via
 * isExpired() et s'affiche comme telle (libellé honnête).
 */
export function dteFromExp(exp, ref) {
  if (!exp) return null;
  const expMs = Date.parse(exp);
  const refMs = ref instanceof Date ? ref.getTime() : ref ? Date.parse(ref) : Date.now();
  if (!Number.isFinite(expMs) || !Number.isFinite(refMs)) return null;
  return Math.max(0, Math.round((expMs - refMs) / 86_400_000));
}

/**
 * Option déjà expirée ? Même arithmétique que dteFromExp AVANT clamp
 * (round négatif = date passée) — les deux restent alignés par
 * construction. false si exp manquante / invalide.
 */
export function isExpired(exp, ref) {
  if (!exp) return false;
  const expMs = Date.parse(exp);
  const refMs = ref instanceof Date ? ref.getTime() : ref ? Date.parse(ref) : Date.now();
  if (!Number.isFinite(expMs) || !Number.isFinite(refMs)) return false;
  return Math.round((expMs - refMs) / 86_400_000) < 0;
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
 *
 * Q-B (16.08) — la branche EARN est MORTE : la porte P4 (earnings) tire
 * désormais sa vérité de `position.earningsDate` (tri-état saisi, câblage
 * du gate en Q-C), plus du calendrier Finnhub injecté ici. Finnhub survit
 * en pur affichage de calendrier (Calendar / PreMarket / CalendarMini) —
 * il ne pilote plus aucune alerte de position.
 */
export function detectAlert(pos, context = {}) {
  if (!pos) return null;
  const now = context.now;

  const dte = dteFromExp(pos.ex, now);
  if (dte != null && dte < 7) return 'DTE';

  const ivr = context.ivr;
  if (Number.isFinite(ivr) && (ivr > 70 || ivr < 20)) return 'IV';

  return null;
}

/**
 * Signature stable d'une position — indépendante de l'id (qui change à
 * chaque ré-import) et de la date d'entrée. Clé de dédup à l'import ET
 * clé du sidecar de métadonnées saisies (earningsDate / entryNote), pour
 * qu'une annotation SURVIVE au ré-import du même CSV.
 * Forme identique à l'ancienne positionKey de merge.js : tk|as|dir|ty|st|ex.
 */
export function positionSignature(p) {
  if (!p) return '';
  return `${p.tk}|${p.as}|${p.dir}|${p.ty ?? ''}|${p.st ?? ''}|${p.ex ?? ''}`;
}

// É3.2 — sparkTrend MORTE avec PositionSparkline (colonne SPARK 7D
// fantôme : aucun producteur de marks datés par position).

// ═══════════════════════════════════════════════════════════════
//  v5 Sprint 1.3 — Edge Tier derivation
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
