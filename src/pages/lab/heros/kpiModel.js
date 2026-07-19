// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — MODÈLE KPI (DEV-only, purgé 1.D)
//
//  Bande GÉNÉRALE (état live) = TOUS les KPI SAUF le NLV (héros du
//  graphe). 12 cellules RICHES et DENSES (micro-contexte + micro-
//  sparkline là où ça a du sens) → panneau d'instruments plein.
//  Θ/j et Δ net PROMUS du cockpit Σ (non dupliqués). Poudre = est.
//
//  Double devise : cellules monétaires portent `usd` (nombre brut) +
//  `money:true`. Δ net : actions-équiv PRIMAIRE + $-exposition en sub.
//  Loi de couleur : profit/loss UNIQUEMENT sur argent réel (DAY,
//  UNREALIZED, REALIZED). Reste neutre (Θ/Δ signés ≠ perte).
// ═══════════════════════════════════════════════════════════════

import { fmtUsd, fmtUsdSigned, fmtUsdCompact, toneSign } from './kit';

export function toKpiCells(v) {
  const c = (id, label, opts = {}) => ({ id, label, ...opts });
  const thetaMonth = Number.isFinite(v.thetaDay) ? v.thetaDay * 22 : null;
  return [
    c('day', 'DAY P&L', { value: v.dayPnl == null ? '—' : fmtUsdSigned(v.dayPnl), usd: v.dayPnl, money: true, tone: toneSign(v.dayPnl), sub: v.dayPct != null ? `${v.dayPct >= 0 ? '+' : '−'}${Math.abs(v.dayPct).toFixed(2)} % NLV` : null, spark: v.daySpark }),
    c('unreal', 'UNREALIZED', { value: v.unrealized == null ? '—' : fmtUsdSigned(v.unrealized), usd: v.unrealized, money: true, tone: toneSign(v.unrealized), sub: v.upDown || 'positions ouvertes' }),
    c('realized', 'REALIZED', { value: v.realized == null ? '—' : fmtUsdSigned(v.realized), usd: v.realized, money: true, tone: toneSign(v.realized), sub: v.ytd != null ? `YTD ${fmtUsdSigned(v.ytd)}` : 'cumulé', spark: v.realizedSpark }),
    c('exposure', 'EXPOSURE', { value: v.exposure == null ? '—' : fmtUsdCompact(v.exposure), usd: v.exposure, money: true, sub: v.expoPct != null ? `${Math.round(v.expoPct)} % NLV · déployé` : 'déployé', spark: v.exposureSpark, hint: 'Capital DÉPLOYÉ (primes) = Max Loss long' }),
    c('risk', 'CAP. RISQUE', { value: v.riskDollar == null ? '—' : fmtUsd(v.riskDollar), usd: v.riskDollar, money: true, sub: 'SL35 · ≠ Max Loss', hint: 'Σ risque stop (35 % prime) — distinct de Max Loss/EXPOSURE' }),
    c('powder', 'POUDRE SÈCHE', { value: v.powder == null ? '—' : fmtUsdCompact(v.powder), usd: v.powder, money: true, est: true, sub: v.powderPct != null ? `est. · ${Math.round(v.powderPct)} % NLV` : 'est.', hint: 'Estimation (availableUsd cash-A) — PAS la Buying Power IBKR (TODO Sprint C)' }),
    c('theta', 'Θ / JOUR', { value: v.thetaDay == null ? '—' : fmtUsdSigned(v.thetaDay), usd: v.thetaDay, money: true, sub: thetaMonth != null ? `carry · ${fmtUsdSigned(thetaMonth)}/mois` : 'carry', hint: 'Coût de portage — promu du cockpit Σ' }),
    c('delta', 'Δ NET', { value: v.netDeltaShares == null ? '—' : (v.netDeltaShares >= 0 ? '+' : '−') + Math.abs(Math.round(v.netDeltaShares)).toLocaleString('de-CH'), sub: v.netDeltaDollar == null ? 'actions-équiv' : `exp. ${fmtUsdSigned(v.netDeltaDollar)}`, hint: 'Δ actions-équiv (primaire) · $-exposition en sub — promu du cockpit Σ' }),
    c('win', 'WIN RATE', { value: v.winRate == null ? '—' : `${v.winRate.toFixed(0)}%`, sub: v.trades != null ? `${v.trades} clôtures` : null }),
    c('pf', 'PROFIT FACTOR', { value: v.profitFactor == null ? '—' : (Number.isFinite(v.profitFactor) ? v.profitFactor.toFixed(2) : '∞'), sub: v.profitFactor == null ? null : v.profitFactor >= 1 ? 'rentable · ≥ 1' : 'sous 1' }),
    c('dte', 'DTE PROCHE', { value: v.dte == null ? '—' : `${v.dte} j`, sub: v.dteTicker ? `${v.dteTicker} · échéance` : null }),
    c('positions', 'POSITIONS', { value: v.positionsCount == null ? '—' : `${v.positionsCount}`, sub: v.positionsUpDown || 'ouvertes' }),
  ];
}

const sparkFrom = (series, key, n = 24) => (Array.isArray(series) ? series.slice(-n).map((p) => p[key]).filter((x) => Number.isFinite(x)) : []);

// ─── Réel : depuis les hooks du store ───────────────────────────
export function deriveKpisReal(ctx) {
  const { metrics, greeks, availableUsd, riskDollar, positions, series, winRate, profitFactor, today } = ctx;
  const nlv = metrics?.netLiquidationValueUsd ?? null;
  const last = series && series.length ? series[series.length - 1] : null;
  const prev = series && series.length > 1 ? series[series.length - 2] : null;
  const dayPnl = last && prev ? last.flowNeutral - prev.flowNeutral : null;
  const dayPct = dayPnl != null && prev && prev.nlv > 0 ? (dayPnl / prev.nlv) * 100 : null;

  let dte = null;
  let dteTicker = null;
  const todayMs = Date.parse(today);
  for (const p of positions || []) {
    if (p?.as !== 'Option' || !p.ex) continue;
    const d = Math.round((Date.parse(p.ex) - todayMs) / 86_400_000);
    if (Number.isFinite(d) && (dte == null || d < dte)) { dte = d; dteTicker = p.tk || null; }
  }

  return {
    nlv, nlvSpark: sparkFrom(series, 'nlv', 30),
    dayPnl, dayPct, daySpark: sparkFrom(series, 'chg'),
    powder: availableUsd ?? null, powderPct: availableUsd != null && nlv > 0 ? (availableUsd / nlv) * 100 : null,
    riskDollar: riskDollar ?? null,
    unrealized: metrics?.unrealizedPnlUsd ?? null, upDown: null,
    realized: metrics?.realizedPnlUsd ?? null, ytd: null, realizedSpark: sparkFrom(series, 'flowNeutral'),
    exposure: metrics?.totalExposure ?? null, expoPct: metrics?.totalExposure != null && nlv > 0 ? (metrics.totalExposure / nlv) * 100 : null, exposureSpark: sparkFrom(series, 'exposure'),
    thetaDay: Number.isFinite(greeks?.thetaDaily) ? greeks.thetaDaily : null,
    netDeltaDollar: Number.isFinite(greeks?.notionalDelta) ? greeks.notionalDelta : null,
    netDeltaShares: Number.isFinite(greeks?.sumDelta) ? greeks.sumDelta : null,
    winRate: winRate ?? null, profitFactor: profitFactor ?? null, trades: null,
    dte, dteTicker,
    positionsCount: Array.isArray(positions) ? positions.length : null, positionsUpDown: null,
  };
}

// ─── Démo : synthétique dense (aucune écriture store) ───────────
export function deriveKpisDemo(variant, series, inputs) {
  if (!series || series.length === 0) {
    return { nlv: null, dayPnl: null, powder: null, riskDollar: null, unrealized: null, realized: null, exposure: null, thetaDay: null, netDeltaShares: null, netDeltaDollar: null, winRate: null, profitFactor: null, dte: null, positionsCount: null };
  }
  const last = series[series.length - 1];
  const prev = series[series.length - 2] || last;
  const dayPnl = last.flowNeutral - prev.flowNeutral;
  const dayPct = prev.nlv > 0 ? (dayPnl / prev.nlv) * 100 : null;
  const closed = inputs?.closedTrades || [];
  const wins = closed.filter((t) => t.pnl > 0).length;
  const winRate = closed.length ? (wins / closed.length) * 100 : null;
  const grossW = closed.filter((t) => t.pnl > 0).reduce((a, b) => a + b.pnl, 0);
  const grossL = Math.abs(closed.filter((t) => t.pnl < 0).reduce((a, b) => a + b.pnl, 0));
  const pf = grossL > 0 ? grossW / grossL : (wins ? Infinity : null);
  const exposure = Math.round(last.nlv * 0.42);
  const scale = variant === 'drawdown' ? 1.4 : 1;

  return {
    nlv: last.nlv, nlvSpark: sparkFrom(series, 'nlv', 30),
    dayPnl, dayPct, daySpark: sparkFrom(series, 'chg'),
    powder: Math.round(last.nlv * 0.46), powderPct: 46,
    riskDollar: Math.round(exposure * 0.35),
    unrealized: variant === 'drawdown' ? -180 : 312, upDown: variant === 'drawdown' ? '1↑ · 3↓' : '3↑ · 1↓',
    realized: last.flowNeutral, ytd: Math.round(last.flowNeutral * 0.7), realizedSpark: sparkFrom(series, 'flowNeutral'),
    exposure, expoPct: 42, exposureSpark: sparkFrom(series, 'exposure'),
    thetaDay: -Math.round(96 * scale),
    netDeltaShares: Math.round(variant === 'drawdown' ? -140 : 420), netDeltaDollar: Math.round(variant === 'drawdown' ? -14200 : 34800),
    winRate, profitFactor: pf, trades: closed.length || null,
    dte: variant === 'sparse' ? 44 : 9, dteTicker: variant === 'sparse' ? 'XOM' : 'MSFT',
    positionsCount: variant === 'sparse' ? 2 : 4, positionsUpDown: variant === 'drawdown' ? '1↑ · 3↓' : '3↑ · 1↓',
  };
}
