// ═══════════════════════════════════════════════════════════════
//  EQUITY UTILS v4 brick 3 — purs, sans React
//
//  Fonctions de transformation appliquées sur une série d'equity
//  triée par date croissante :
//    - computeUnderwaterCurve : annote chaque point avec running
//                                peak + underwater (≤ 0) + underwater %
//    - computeDailyPnl        : ajoute dailyPnl = equity[i] − equity[i-1]
//    - filterByTimeframe      : filtre la série sur 5D/1M/3M/YTD/1Y/ALL
//
//  Toutes les fonctions sont pures et idempotentes — la sortie d'une
//  peut servir d'entrée à une autre. Aucune mutation, aucune
//  dépendance React/store. Testées en isolation.
//
//  Shape canonique du point : { date: 'YYYY-MM-DD', equity: number,
//                               ...annotations ajoutées par les utils }.
// ═══════════════════════════════════════════════════════════════

/**
 * Pour chaque point, calcule le peak (running max) et le drawdown
 * relatif. underwater est ≤ 0 (l'écart au peak), underwaterPct est
 * un pourcentage signé négatif (au plus 0 quand on touche un nouveau
 * peak).
 *
 * @param {Array<{date: string, equity: number}>} points  date-ordered
 * @returns {Array<{date, equity, peak, underwater, underwaterPct}>}
 */
export function computeUnderwaterCurve(points) {
  if (!points || !points.length) return [];
  let peak = points[0].equity;
  return points.map((p) => {
    if (p.equity > peak) peak = p.equity;
    const underwater = p.equity - peak; // ≤ 0
    const underwaterPct = peak !== 0 ? (underwater / Math.abs(peak)) * 100 : 0;
    return {
      ...p,
      peak: Number(peak.toFixed(2)),
      underwater: Number(underwater.toFixed(2)),
      underwaterPct: Number(underwaterPct.toFixed(2)),
    };
  });
}

/**
 * Ajoute la P&L journalière (delta vs jour précédent) à chaque point.
 * Premier point : dailyPnl = 0 (pas d'antériorité).
 *
 * @param {Array<{date, equity}>} points
 * @returns {Array<{date, equity, dailyPnl}>}
 */
export function computeDailyPnl(points) {
  if (!points || !points.length) return [];
  return points.map((p, i) => ({
    ...p,
    dailyPnl: i === 0 ? 0 : Number((p.equity - points[i - 1].equity).toFixed(2)),
  }));
}

/**
 * Coupe la série au timeframe demandé. Les points sont supposés
 * triés ASC par date.
 *
 * Range keys :
 *   '5D'  — 5 derniers jours calendaires
 *   '1M'  — 30 derniers jours
 *   '3M'  — 90 derniers jours
 *   'YTD' — depuis le 1er janvier de l'année du dernier point
 *   '1Y'  — 365 derniers jours
 *   'ALL' — toute la série, no-op
 *
 * `referenceDate` permet de tester de manière déterministe (la
 * fonction utilise `points[points.length - 1].date` comme repère
 * par défaut, donc elle est déjà pure si on lui passe des données
 * fixées).
 *
 * @param {Array<{date, equity}>} points
 * @param {'5D'|'1M'|'3M'|'YTD'|'1Y'|'ALL'} range
 * @param {string} [referenceDate] — ISO YYYY-MM-DD, default = last point
 * @returns {Array} sliced array
 */
export function filterByTimeframe(points, range, referenceDate) {
  if (!points || !points.length || range === 'ALL') return points || [];
  const ref = referenceDate || points[points.length - 1].date;
  const refMs = Date.parse(ref);
  if (!Number.isFinite(refMs)) return points;

  let cutoffMs;
  if (range === 'YTD') {
    const refDate = new Date(refMs);
    cutoffMs = Date.UTC(refDate.getUTCFullYear(), 0, 1);
  } else {
    const days = TF_DAYS[range];
    if (!Number.isFinite(days)) return points;
    cutoffMs = refMs - days * 86_400_000;
  }
  return points.filter((p) => Date.parse(p.date) >= cutoffMs);
}

const TF_DAYS = {
  '5D': 5,
  '1M': 30,
  '3M': 90,
  '1Y': 365,
};

export const TIMEFRAMES = ['5D', '1M', '3M', 'YTD', '1Y', 'ALL'];
