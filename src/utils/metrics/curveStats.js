// @ts-check
// ═══════════════════════════════════════════════════════════════
//  curveStats — É3.1 « VÉRITÉ DES CHIFFRES » : maison UNIQUE des
//  métriques de courbe, PAR COURBE :
//    RÉAL = cumul réalisé (running sum des clôtures, realCurve) ;
//    NLV  = equity flow-neutral (buildNlvSeries, nlvCurve).
//
//  Un point de courbe = { date: 'YYYY-MM-DD…', value: number }.
//  Tous les panneaux du Dashboard consomment CES fonctions — plus
//  aucun pic / DD courant / jours-depuis-pic / recovery / % jours
//  gagnants recalculé localement avec sa propre variante.
//
//  Sémantiques ratifiées (É3.1) :
//  · daysSincePeak = jours CALENDAIRES entre le pic et `asOf`
//    (aujourd'hui pour une courbe figée après la dernière clôture) —
//    jamais une distance en points/trades.
//  · joursGagnants = UNE définition : jours AVEC CLÔTURE, classés au
//    signe du P&L net du jour. Un jour soldé net à 0 compte « non
//    gagnant » (rouges) → verts + rouges = total, toujours.
//  · recovery = P&L de la courbe ÷ max DD de la même courbe ; null
//    sans drawdown (pas d'Infinity d'affichage).
//
//  Côté positions, la maison canonique reste utils/greeks
//  .aggregateGreeks (sign-aware, spot) ; greeksTotals() la projette
//  en { deltaNet, deltaExposure, thetaDollarJour } — la formule
//  « Δ × qty × 100 × prime » des ex-footers est MORTE.
// ═══════════════════════════════════════════════════════════════


const DAY_MS = 86_400_000;
const dayKey = (d) => (typeof d === 'string' && d.length >= 10 ? d.slice(0, 10) : null);

/**
 * Pic (premier maximum strict) d'une courbe.
 * @param {Array<{date?: string, value: number}>} points
 * @returns {{value: number, date: string|null, index: number}|null}
 */
export function peakOf(points) {
  if (!Array.isArray(points) || points.length === 0) return null;
  let idx = -1;
  let val = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const v = points[i]?.value;
    if (Number.isFinite(v) && v > val) {
      val = v;
      idx = i;
    }
  }
  if (idx < 0) return null;
  return { value: val, date: points[idx].date ?? null, index: idx };
}

/**
 * Drawdown COURANT : pic de toute la courbe − dernier point (≥ 0).
 * @param {Array<{date?: string, value: number}>} points
 * @returns {{usd: number, peakValue: number, peakDate: string|null, lastDate: string|null}|null}
 */
export function currentDrawdownOf(points) {
  const peak = peakOf(points);
  if (!peak) return null;
  const last = points[points.length - 1];
  const lastVal = Number.isFinite(last?.value) ? last.value : peak.value;
  return {
    usd: Math.max(0, peak.value - lastVal),
    peakValue: peak.value,
    peakDate: peak.date,
    lastDate: last?.date ?? null,
  };
}

/**
 * Max drawdown pic→creux de la courbe (fenêtre = les points fournis).
 * @param {Array<{date?: string, value: number}>} points
 * @returns {{usd: number, peakDate: string|null, troughDate: string|null}|null}
 */
export function maxDrawdownOf(points) {
  if (!Array.isArray(points) || points.length === 0) return null;
  let peakVal = -Infinity;
  let peakDate = null;
  let maxDD = 0;
  let ddPeakDate = null;
  let troughDate = null;
  let any = false;
  for (const p of points) {
    const v = p?.value;
    if (!Number.isFinite(v)) continue;
    any = true;
    if (v > peakVal) {
      peakVal = v;
      peakDate = p.date ?? null;
    }
    const dd = peakVal - v;
    if (dd > maxDD) {
      maxDD = dd;
      ddPeakDate = peakDate;
      troughDate = p.date ?? null;
    }
  }
  if (!any) return null;
  return { usd: maxDD, peakDate: ddPeakDate, troughDate };
}

/**
 * Jours CALENDAIRES écoulés depuis le pic de la courbe, datés.
 * `asOf` = référence (aujourd'hui) — une courbe RÉAL est figée après la
 * dernière clôture, mesurer pic→dernier point mentirait (le « 11 » du
 * constat É3.1 pour un pic vieux de 110 jours).
 * @param {Array<{date?: string, value: number}>} points
 * @param {string} [asOf] ISO date ; défaut = date du dernier point
 * @returns {{days: number, date: string}|null}
 */
export function daysSincePeakOf(points, asOf) {
  const peak = peakOf(points);
  if (!peak || !peak.date) return null;
  const peakDay = dayKey(peak.date);
  const ref = dayKey(asOf) || dayKey(points[points.length - 1]?.date);
  if (!peakDay || !ref) return null;
  const ms = Date.parse(ref) - Date.parse(peakDay);
  if (!Number.isFinite(ms)) return null;
  return { days: Math.max(0, Math.round(ms / DAY_MS)), date: peakDay };
}

/**
 * Recovery = P&L ÷ max DD de la MÊME courbe. Null sans drawdown.
 * @param {number|null} pnl
 * @param {number|null} maxDDUsd
 * @returns {number|null}
 */
export function recoveryOf(pnl, maxDDUsd) {
  if (!Number.isFinite(pnl) || !Number.isFinite(maxDDUsd) || maxDDUsd <= 0) return null;
  return pnl / maxDDUsd;
}

/**
 * % de jours gagnants — LA définition unique (É3.1) : jours avec
 * clôture, signe du P&L net du jour. verts + rouges = total, toujours
 * (un jour net 0 est « non gagnant »).
 * @param {Array<{date?: string, pnl: number}>} dayPnls un item par jour AVEC clôture
 * @returns {{verts: number, rouges: number, total: number, pct: number|null}}
 */
export function joursGagnants(dayPnls) {
  const days = (Array.isArray(dayPnls) ? dayPnls : []).filter(
    (d) => d && Number.isFinite(d.pnl)
  );
  const total = days.length;
  let verts = 0;
  for (const d of days) if (d.pnl > 0) verts++;
  return {
    verts,
    rouges: total - verts,
    total,
    pct: total > 0 ? (verts / total) * 100 : null,
  };
}

// É4-b — `realCurve` / `nlvCurve` / `greeksTotals` SUPPRIMÉS : exports morts
// (aucun consommateur runtime, seulement leurs propres tests). Les maisons
// vivantes restent : realCurve→buildNlvSeries, greeks→aggregateGreeks.
