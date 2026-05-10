// ═══════════════════════════════════════════════════════════════
//  IV RANK UTILS v4 brick 7 — purs
//
//  Helpers pour le module IV Rank Movers :
//    - sortByMoveAbs    : tri ASC par |ivRankD1| décroissant
//    - ivrTone          : seuil tone IVR (vert <30, ambre 30-70, rouge >70)
//    - deltaTone        : warn si |Δ| > 10, mute sinon
// ═══════════════════════════════════════════════════════════════

/**
 * Tri par magnitude descendant : les plus gros mouvements (positifs
 * ou négatifs) en haut. Utile pour « Top Movers ».
 *
 * @param {Array<{ivRankD1: number}>} items
 */
export function sortByMoveAbs(items) {
  return (items || [])
    .slice()
    .sort((a, b) => Math.abs(b.ivRankD1 || 0) - Math.abs(a.ivRankD1 || 0));
}

/**
 * Tone IVR :
 *   < 30  → 'profit'  (low IV, premium cheap, opportunité long)
 *   30-70 → 'mute'    (neutre)
 *   > 70  → 'loss'    (high IV, premium cher / risk d'IV crush)
 */
export function ivrTone(ivr) {
  if (ivr == null || !Number.isFinite(ivr)) return 'mute';
  if (ivr < 30) return 'profit';
  if (ivr > 70) return 'loss';
  return 'mute';
}

/**
 * Tone delta IVR 1D :
 *   |Δ| > 10  → 'warn'
 *   sinon     → 'mute'
 */
export function deltaTone(d) {
  if (d == null || !Number.isFinite(d)) return 'mute';
  if (Math.abs(d) > 10) return 'warn';
  return 'mute';
}
