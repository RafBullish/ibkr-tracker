// @ts-check
// ═══════════════════════════════════════════════════════════════
//  computeCalmar — gate relâchée yearsActive > 0 (anciennement ≥ 1).
//
//  Calmar = annualised CAGR / |Max Drawdown %|. La math attend une CAGR
//  annualisée — c'est au caller d'extrapoler la CAGR sur < 1 an si le
//  besoin est de surfacer une valeur même préliminaire (callsite dans
//  calculations.js force l'annualisation via (end/init)^(1/years) - 1
//  avant d'appeler ce helper). Le flag `preliminaryRatios: yearsActive < 1`
//  dans metrics + le marqueur côté UI signalent l'artefact aux échantillons
//  courts.
//
//  Historique : la version A2b gardait years ≥ 1 strict. Refonte ici
//  (single-source FX + Calmar wired) : on accepte years > 0 dès que le
//  caller a annualisé proprement. Les autres ratios (Sharpe / Sortino /
//  SQN) ont toujours été dispo sous 1 an, le gating Calmar était
//  l'incohérence visible — corrigé.
// ═══════════════════════════════════════════════════════════════

/**
 * @param {Object} args
 * @param {number|null|undefined} args.cagrPct           CAGR annualisée %, fournie par le caller
 * @param {number|null|undefined} args.maxDrawdownPct    Max DD magnitude as %, > 0
 * @param {number|null|undefined} args.yearsActive       Elapsed years — required > 0.
 * @returns {number|null} Calmar ratio, or null when inputs are invalid / years ≤ 0.
 */
export function computeCalmar({ cagrPct, maxDrawdownPct, yearsActive }) {
  if (typeof yearsActive !== 'number' || !Number.isFinite(yearsActive) || !(yearsActive > 0)) {
    return null;
  }
  if (typeof cagrPct !== 'number' || !Number.isFinite(cagrPct)) return null;
  if (typeof maxDrawdownPct !== 'number' || !Number.isFinite(maxDrawdownPct)) return null;
  if (!(maxDrawdownPct > 0)) return null;
  const calmar = cagrPct / maxDrawdownPct;
  return Number.isFinite(calmar) ? calmar : null;
}
