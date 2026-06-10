// ═══════════════════════════════════════════════════════════════
//  RISK UTILS v4 brick 4 — purs, sans React, sans store
//
//  Fonctions composables qui produisent les métriques de risque
//  affichées par le module Risk Matrix (14 lignes). Toutes opèrent
//  sur des structures simples : equityPoints (Array<{date, equity}>)
//  et closedTrades / openPositions (formes du store).
//
//  Réutilise délibérément ce qui existe dans utils/calculations.js
//  et utils/equity.js pour éviter la duplication. N'ajoute QUE les
//  primitives manquantes (currentDrawdown, recovery, max concurrent)
//  puis compose le tout dans computeRiskMatrix() qui produit l'objet
//  14-clés consommé par le composant. A2a — vol primitive moved to
//  src/utils/metrics/computeVolatility.js (read here via m.volAnnPct).
//
//  Toutes acceptent des inputs vides sans throw — retournent 0 ou
//  null selon la sémantique de la métrique. Documentés en JSDoc.
// ═══════════════════════════════════════════════════════════════

import { calculatePortfolioMetrics, computeEquityCurve } from './calculations';

/**
 * Drawdown courant en % du peak — signé négatif.
 * 0 si pas de drawdown ou input vide / peak ≤ 0.
 *
 * @param {Array<{equity: number}>} points  date-ordered, equity USD
 * @returns {number} ≤ 0
 */
export function currentDrawdownPct(points) {
  if (!points || !points.length) return 0;
  let peak = points[0].equity;
  for (const p of points) {
    if (p.equity > peak) peak = p.equity;
  }
  if (peak <= 0) return 0;
  const last = points[points.length - 1].equity;
  return Number((((last - peak) / peak) * 100).toFixed(2));
}

/**
 * Jours calendaires depuis le dernier all-time peak. 0 si on est
 * au peak ou pas de data.
 *
 * @param {Array<{date: string, equity: number}>} points
 * @returns {number} ≥ 0
 */
export function currentDrawdownAge(points) {
  if (!points || !points.length) return 0;
  let peakIdx = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].equity >= points[peakIdx].equity) peakIdx = i;
  }
  const peakMs = Date.parse(points[peakIdx].date);
  const lastMs = Date.parse(points[points.length - 1].date);
  if (!Number.isFinite(peakMs) || !Number.isFinite(lastMs)) return 0;
  return Math.max(0, Math.round((lastMs - peakMs) / 86_400_000));
}

/**
 * Max drawdown sur la fenêtre YTD seulement. Retourne {pct, date}
 * — pct est positif (magnitude), date est l'ISO du trough.
 *
 * @param {Array<{date, equity}>} points
 * @returns {{ pct: number, date: string|null }}
 */
export function maxDrawdownYTDFromEquity(points) {
  if (!points || !points.length) return { pct: 0, date: null };
  const lastDate = points[points.length - 1].date;
  const yearStart = `${lastDate.slice(0, 4)}-01-01`;
  const ytd = points.filter((p) => p.date >= yearStart);
  if (!ytd.length) return { pct: 0, date: null };

  let peak = ytd[0].equity;
  let maxDd = 0;
  let troughDate = null;
  for (const p of ytd) {
    if (p.equity > peak) peak = p.equity;
    const dd = peak - p.equity;
    if (dd > maxDd) {
      maxDd = dd;
      troughDate = p.date;
    }
  }
  if (peak <= 0) return { pct: 0, date: troughDate };
  const pct = Number(((maxDd / peak) * 100).toFixed(2));
  return { pct, date: troughDate };
}

/**
 * % de récupération depuis le trough du max drawdown all-time.
 * 100 = full recovery (ou pas de drawdown). 0 = au trough.
 *
 * @param {Array<{equity}>} points
 * @returns {number} 0..100
 */
export function recoveryPct(points) {
  if (!points || !points.length) return 100;
  let peak = points[0].equity;
  let trough = points[0].equity;
  let troughIdx = 0;
  for (let i = 0; i < points.length; i++) {
    if (points[i].equity > peak) {
      peak = points[i].equity;
      trough = points[i].equity;
      troughIdx = i;
    } else if (points[i].equity < trough) {
      trough = points[i].equity;
      troughIdx = i;
    }
  }
  // Pas de drawdown observé.
  if (peak === trough) return 100;
  // Cherche le meilleur point post-trough pour mesurer la récup.
  let postTroughHigh = points[troughIdx].equity;
  for (let i = troughIdx; i < points.length; i++) {
    if (points[i].equity > postTroughHigh) postTroughHigh = points[i].equity;
  }
  const drop = peak - trough;
  const recovered = postTroughHigh - trough;
  if (drop <= 0) return 100;
  return Number(Math.min(100, Math.max(0, (recovered / drop) * 100)).toFixed(2));
}

// A2a — vol30dAnnualized() retired. The 30-trade window was statistically
// empty at ~75 trades/year and the per-trade equity step / capitalBase
// approach inflated the value (cf. Vol 419 % observed in production). The
// canonical annualised volatility now lives in
// src/utils/metrics/computeVolatility.js (returns-based, gated, single
// source) and is exposed via calculatePortfolioMetrics().volAnnPct.

/**
 * Max nombre de positions ouvertes simultanément sur l'historique.
 * Sweep-line sur tous les intervalles (di, do) des closed trades +
 * (di, today) des positions encore ouvertes.
 *
 * @param {Array} closedTrades   {di, do} required
 * @param {Array} openPositions  {di} required
 * @param {string} [today]       ISO YYYY-MM-DD pour borner les open
 * @returns {number} ≥ 0
 */
export function maxConcurrentTrades(closedTrades, openPositions, today) {
  const events = [];
  const todayStr = today || (closedTrades?.[0]?.do ? new Date().toISOString().slice(0, 10) : null);

  (closedTrades || []).forEach((t) => {
    if (!t.di || !t.do) return;
    events.push({ ts: Date.parse(t.di), delta: 1 });
    events.push({ ts: Date.parse(t.do), delta: -1 });
  });
  (openPositions || []).forEach((p) => {
    if (!p.di) return;
    events.push({ ts: Date.parse(p.di), delta: 1 });
    if (todayStr) events.push({ ts: Date.parse(todayStr), delta: -1 });
  });

  if (!events.length) return 0;
  // Open events traités avant close events au même timestamp pour
  // ne pas sous-estimer le pic.
  events.sort((a, b) => a.ts - b.ts || b.delta - a.delta);

  let active = 0;
  let max = 0;
  for (const e of events) {
    active += e.delta;
    if (active > max) max = active;
  }
  return max;
}

/**
 * Aggrège l'objet 14-clés consommé par <RiskMatrix />.
 * Composes calculatePortfolioMetrics + risk primitives ci-dessus.
 * Pure — pas de React, pas de store.
 *
 * @param {Object} state                  {closedTrades, openPositions, cashFlows, settings}
 * @param {Array}  [equityPoints]         override (sinon computeEquityCurve(state))
 * @returns {Object} 14 valeurs + meta {closedCount, sufficient}
 */
// ═══════════════════════════════════════════════════════════════
//  v5 Sprint 2.3 — exposure metrics
//  Concentration (Herfindahl), Notional %NLV, Net Δ exposure
// ═══════════════════════════════════════════════════════════════

const toFloat = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Notional dollar exposure for a single position.
 *   Stocks (Action) : |mark × qty × 1|
 *   Options          : |mark × qty × multiplier|
 * mark = pos.pc (live mark) ; falls back to entry pos.pi if mark missing.
 * Returns 0 for invalid input. Sign-stripped (always ≥ 0).
 */
export function positionNotional(pos) {
  if (!pos) return 0;
  const mark = toFloat(pos.pc) || toFloat(pos.pi);
  const qty = toFloat(pos.ct);
  const mul = pos.as === 'Action' ? 1 : toFloat(pos.mu) || 100;
  return Math.abs(mark * qty * mul);
}

// ─── Brique 13 — risque max par position (gate SL35) ───────────

const SL_DERIVED_FRACTION = 0.35;

/**
 * Risque max en USD pour UNE position ouverte — le montant perdu si
 * le stop SL35 (35 % de la prime, Sniper OTM v1.0) se déclenche.
 *
 * Dérivation par défaut : pi × ct × mu × 0.35 (coût d'entrée hors
 * commissions × fraction SL35). Surcharge manuelle optionnelle via
 * pos.slDollar (string, convention du modèle ; null = dérivé).
 *
 * Retourne null quand le coût d'entrée n'est pas calculable (inputs
 * absents/invalides) ET qu'aucune surcharge valide n'existe — le
 * caller affiche '—', il n'invente pas un 0.
 *
 * @param {object} pos  open position (formes du store, numbers-as-strings)
 * @returns {number|null} ≥ 0
 */
export function effectiveSlDollar(pos) {
  if (!pos) return null;
  const manual = toFloat(pos.slDollar);
  if (manual > 0) return manual;
  const pi = toFloat(pos.pi);
  const qty = toFloat(pos.ct);
  const mul = pos.as === 'Action' ? 1 : toFloat(pos.mu) || 100;
  const entryCost = pi * qty * mul;
  if (!(entryCost > 0)) return null;
  return entryCost * SL_DERIVED_FRACTION;
}

/**
 * Somme des risques max (effectiveSlDollar) sur les positions
 * ouvertes. null quand aucune position n'a de risque calculable.
 *
 * @param {Array<object>} openPositions
 * @returns {number|null} ≥ 0
 */
export function totalSlDollar(openPositions) {
  if (!Array.isArray(openPositions) || openPositions.length === 0) return null;
  let sum = 0;
  let any = false;
  for (const p of openPositions) {
    const sl = effectiveSlDollar(p);
    if (sl != null) {
      sum += sl;
      any = true;
    }
  }
  return any ? sum : null;
}

/**
 * Total notional exposure across all open positions, in USD.
 */
export function totalNotional(openPositions) {
  if (!Array.isArray(openPositions)) return 0;
  return openPositions.reduce((sum, p) => sum + positionNotional(p), 0);
}

/**
 * Notional as a fraction of NLV (× 100 for percent display).
 * NLV missing or ≤ 0 → null (caller renders '—').
 */
export function notionalPctNLV(openPositions, nlvUsd) {
  if (!Number.isFinite(nlvUsd) || nlvUsd <= 0) return null;
  const tot = totalNotional(openPositions);
  return (tot / nlvUsd) * 100;
}

/**
 * Herfindahl concentration index (× 10000 for the standard 0–10000
 * scale). H = Σ (weight_i)² where weight = notional_i / Σ notional.
 * < 1500 = competitive (low concentration), > 2500 = concentrated.
 * Returns null when the portfolio is empty.
 */
export function herfindahlConcentration(openPositions) {
  if (!Array.isArray(openPositions) || openPositions.length === 0) return null;
  const tot = totalNotional(openPositions);
  if (tot === 0) return null;
  let h = 0;
  for (const p of openPositions) {
    const w = positionNotional(p) / tot;
    h += w * w;
  }
  return h * 10000;
}

/**
 * Sum of position deltas (sign-aware via dir). Long call delta = +,
 * short call delta = −. Same for puts. β-weighting (vs SPY) layers on
 * top in Sprint 4 once useBetaSPY is wired.
 *
 * pos.delta is the per-contract delta snapshot. We multiply by qty +
 * multiplier to get the aggregate delta in shares-equivalent.
 *
 * Returns null when no position carries a parsable delta — keeps the
 * '—' rendering for real-store cases where delta isn't fetched yet.
 */
export function netDeltaExp(openPositions) {
  if (!Array.isArray(openPositions) || openPositions.length === 0) return null;
  let sum = 0;
  let any = false;
  for (const pos of openPositions) {
    if (pos.as === 'Action') {
      // Stocks have a fixed delta of ±1 per share, sign from dir.
      const qty = toFloat(pos.ct);
      if (qty === 0) continue;
      const sign = pos.dir === 'Short' ? -1 : 1;
      sum += sign * qty;
      any = true;
      continue;
    }
    const d = pos.delta;
    if (d == null || !Number.isFinite(d)) continue;
    const qty = toFloat(pos.ct);
    const mul = toFloat(pos.mu) || 100;
    const sign = pos.dir === 'Short' ? -1 : 1;
    sum += sign * d * qty * mul;
    any = true;
  }
  return any ? sum : null;
}

export function computeRiskMatrix(state, equityPoints) {
  const safe = {
    closedTrades: state?.closedTrades || [],
    openPositions: state?.openPositions || [],
    cashFlows: state?.cashFlows || [],
    journalEntries: state?.journalEntries || [],
    settings: state?.settings || { liveRate: 1 },
  };
  const m = calculatePortfolioMetrics(safe);
  // A3b — prefer the real-equity timeline (init + cumPnL per close-date)
  // exposed by calculatePortfolioMetrics. All three drawdown windows
  // (Current, YTD, All-Time) now share THIS base, ending the "YTD vs
  // All-Time" magnitude divergence the user observed. Legacy
  // `computeEquityCurve` (cumPnL-only) is the fallback for empty cases.
  const realPoints = Array.isArray(m.realEquityPoints) ? m.realEquityPoints : [];
  const points =
    equityPoints && equityPoints.length > 0
      ? equityPoints
      : realPoints.length > 0
        ? realPoints
        : computeEquityCurve(safe.closedTrades, m.liveRate);
  const initialCapital = m.totalFundedUsd + (m.liveRate > 0 ? m.totalDepositedChf / m.liveRate : 0);
  const ddYtd = maxDrawdownYTDFromEquity(points);
  const decisive = m.winCount + m.lossCount;

  // v5 Sprint 2.3 — exposure metrics from open positions
  const nlvUsd = m.netLiquidationValueUsd ?? m.netLiquidationValueUSD ?? null;
  const concentrationH = herfindahlConcentration(safe.openPositions);
  const notionalPct = notionalPctNLV(safe.openPositions, nlvUsd);
  const netDelta = netDeltaExp(safe.openPositions);

  return {
    currentDDPct: currentDrawdownPct(points),
    currentDDAgeDays: currentDrawdownAge(points),
    maxDDYtdPct: ddYtd.pct,
    maxDDYtdDate: ddYtd.date,
    recoveryPctValue: recoveryPct(points),
    // A2a — annualised volatility now sourced from calculatePortfolioMetrics
    // (single canonical pipeline). Was `vol30dPct: vol30dAnnualized(...)`.
    volAnnPct: m.volAnnPct ?? null,
    winRatePct: m.winRate,
    winRateCount: decisive,
    profitFactorValue: m.profitFactor,
    avgWinUsd: m.averageWin,
    winCount: m.winCount,
    avgLossUsd: -Math.abs(m.averageLoss), // signed negative pour display
    lossCount: m.lossCount,
    expectancyUsd: m.expectancy,
    sharpeRatio: m.sharpeRatio,
    sortinoRatio: m.sortinoRatio,
    calmarRatio: m.calmarRatio,
    kellyPct: m.kellyPercent,
    maxConcurrent: maxConcurrentTrades(safe.closedTrades, safe.openPositions),
    closedCount: safe.closedTrades.length,
    sufficient: safe.closedTrades.length >= 5,
    // v5 Sprint 2.3 exposure
    concentrationH,
    notionalPct,
    netDelta,
    openPositionsCount: safe.openPositions.length,
  };
}
