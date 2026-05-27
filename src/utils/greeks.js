// ═══════════════════════════════════════════════════════════════
//  GREEKS AGGREGATE — CANONICAL sign-aware aggregator.
//
//  Aggrège un greeksMap (Map<positionId, {delta, gamma, theta,
//  vega, spot, …}>) et la liste des openPositions en un objet
//  consommé par toute card / table Greeks (Positions.jsx KPI
//  cards, Greeks.jsx Greeks Center, RiskMatrix Greeks strip).
//
//  SIGN HANDLING
//    Chaque greek est multiplié par dirSign (+1 Long, −1 Short)
//    AVANT l'agrégation. Pour un short call (Sniper OTM short
//    premium) : Θ devient positif (decay encaissé), ν négatif
//    (short vol). Le legacy `computePortfolioGreeks` (sign-
//    agnostic, calculations.js) a été retiré en A1 ; toutes les
//    autres pipelines manuelles ont été migrées en A3c.
//
//  UNIT CONVENTIONS
//    Black-Scholes (utils/options/blackScholes.js) émet :
//      - theta per share, per YEAR
//      - vega  per share, per 1.00 change in sigma (= +100 % IV)
//    Cette fonction convertit en valeurs lisibles dashboard :
//      - thetaDaily   = Σ (theta / 365 × ct × mul × sign) USD/day
//      - vegaPer1Pct  = Σ (vega  /  100 × ct × mul × sign) USD/1 % IV
//      - sumDelta     = Σ (delta × ct × mul × sign)        delta-eq shares
//      - sumGamma     = Σ (gamma × ct × mul × sign)        gamma exposure
//      - notionalDelta= Σ (delta × ct × mul × sign × spot) USD exposure
//
//  STOCKS
//    Stocks (pos.as === 'Action') contribuent au sumDelta (qty × sign,
//    delta-per-share = ±1) et au notionalDelta (qty × sign × pc) mais
//    pas aux autres greeks. Côté display, leurs cellules Δ Γ Θ ν
//    rendent '—' par convention (le composant gère ce cas via
//    type: 'STK' + delta: null dans la row).
//
//  UNAVAILABLE
//    Quand greeksApi marque une position `source: 'unavailable'`
//    (réseau down, contrat introuvable, IV manquante), la position
//    est insérée dans `positions[]` avec tous les Greeks à null
//    mais N'EST PAS agrégée. Donc agrégats restent à 0 / null
//    sans NaN — c'est le cas runtime actuel quand /api/cboe répond 403.
// ═══════════════════════════════════════════════════════════════

import { toFloat, ensurePositive, roundTo2 } from './math';

/**
 * @param {Array} openPositions
 * @param {Map<string, {delta, gamma, theta, vega, spot}>} greeksMap
 * @returns {{
 *   sumDelta, sumGamma, sumTheta, sumVega,
 *   notionalDelta, thetaDaily, vegaPer1Pct,
 *   optionsCount,
 *   positions: Array<{id, ticker, type, contracts, delta, gamma, theta, vega}>
 * }}
 */
export function aggregateGreeks(openPositions, greeksMap) {
  let sumDelta = 0;
  let sumGamma = 0;
  let thetaDaily = 0;
  let vegaPer1Pct = 0;
  let notionalDelta = 0;
  let optionsCount = 0;
  const positions = [];

  const list = openPositions || [];
  for (const pos of list) {
    const sign = pos.dir === 'Short' ? -1 : 1;
    const qty = toFloat(pos.ct) || 0;
    const mul = ensurePositive(pos.mu);

    if (pos.as === 'Option') {
      const g = greeksMap?.get(pos.id);
      // Position sans greeks API → on l'inclut dans la table (avec
      // valeurs null) mais elle ne participe pas à l'agrégation.
      if (!g || g.source === 'unavailable' || g.delta == null) {
        positions.push({
          id: pos.id,
          ticker: pos.tk,
          type: pos.ty,
          contracts: qty,
          delta: null,
          gamma: null,
          theta: null,
          vega: null,
        });
        continue;
      }

      // Per-share greeks signed by direction (display values).
      const dShare = g.delta * sign;
      const gShare = (g.gamma ?? 0) * sign;
      const tDayShare = (g.theta != null ? g.theta / 365 : 0) * sign; // per-share per-day
      const vPctShare = (g.vega != null ? g.vega / 100 : 0) * sign; // per-share per-1%-IV

      // Portfolio-scale aggregates (× ct × mul).
      const scale = qty * mul;
      sumDelta += dShare * scale;
      sumGamma += gShare * scale;
      thetaDaily += tDayShare * scale;
      vegaPer1Pct += vPctShare * scale;

      const spot = Number.isFinite(g.spot) && g.spot > 0 ? g.spot : null;
      if (spot != null) notionalDelta += dShare * scale * spot;

      optionsCount++;

      positions.push({
        id: pos.id,
        ticker: pos.tk,
        type: pos.ty,
        contracts: qty,
        delta: roundTo2(dShare),
        gamma: Number(gShare.toFixed(3)),
        theta: roundTo2(tDayShare),
        vega: roundTo2(vPctShare),
      });
      continue;
    }

    if (pos.as === 'Action') {
      // Stock : delta = ±1 per share, no other greeks.
      // Contribue au sumDelta (qty × sign × 1) et au notionalDelta
      // (qty × sign × pc) mais pas aux autres aggregates.
      const stockDelta = sign * qty;
      sumDelta += stockDelta;
      const spot = parseFloat(pos.pc) || 0;
      if (spot > 0) notionalDelta += stockDelta * spot;

      positions.push({
        id: pos.id,
        ticker: pos.tk,
        type: 'STK',
        contracts: qty,
        delta: null, // affiché '—' dans la cellule par spec
        gamma: null,
        theta: null,
        vega: null,
      });
    }
  }

  return {
    sumDelta: roundTo2(sumDelta),
    sumGamma: roundTo2(sumGamma),
    sumTheta: roundTo2(thetaDaily),
    sumVega: roundTo2(vegaPer1Pct),
    notionalDelta: roundTo2(notionalDelta),
    thetaDaily: roundTo2(thetaDaily),
    vegaPer1Pct: roundTo2(vegaPer1Pct),
    optionsCount,
    positions,
  };
}

export default aggregateGreeks;
