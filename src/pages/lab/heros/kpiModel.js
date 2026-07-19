// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — MODÈLE KPI (DEV-only, purgé fin 1.D)
//
//  Bande LIVE (état courant, pas période) = 7 conservés + Θ/j + Δ net
//  + CAP. RISQUE + POUDRE + DTE. NET LIQ est sorti en HÉROS (rendu à
//  part par le Cartouche). RENDEMENT déménage dans la bande PERF (elle
//  se recalcule par période). Θ/j et Δ net PROMUS du cockpit Σ.
//
//  Double devise : cellules monétaires portent `usd` (nombre brut) +
//  `money:true` → le rendu affiche USD (grand) + CHF (petit, FX live).
//  Ratios (WIN, PF, DTE) : pas de CHF.
//
//  Loi de couleur : profit/loss UNIQUEMENT sur argent réel (DAY,
//  UNREALIZED, REALIZED). NET LIQ, EXPOSURE, poudre, WR, PF, Θ, Δ,
//  DTE, CAP. RISQUE = NEUTRES (Θ/Δ signés ≠ perte).
// ═══════════════════════════════════════════════════════════════

import { fmtUsd, fmtUsdSigned, fmtUsdCompact, toneSign } from './kit';

// deltaMode : 'dollar' (exposition $) | 'shares' (équivalent actions).
export function toKpiCells(v, deltaMode = 'dollar') {
  const c = (id, label, opts = {}) => ({ id, label, ...opts });
  const deltaCell =
    deltaMode === 'shares'
      ? c('delta', 'Δ NET', {
          value: v.netDeltaShares == null ? '—' : (v.netDeltaShares >= 0 ? '+' : '−') + Math.abs(Math.round(v.netDeltaShares)).toLocaleString('de-CH'),
          sub: 'actions-équiv', hint: 'Δ net en actions-équivalent — promu du cockpit Σ',
        })
      : c('delta', 'Δ NET', {
          value: v.netDeltaDollar == null ? '—' : fmtUsdSigned(v.netDeltaDollar), usd: v.netDeltaDollar, money: true,
          sub: 'exposition $', hint: 'Δ-dollar (exposition directionnelle) — promu du cockpit Σ',
        });
  return [
    c('day', 'DAY P&L', { value: v.dayPnl == null ? '—' : fmtUsdSigned(v.dayPnl), usd: v.dayPnl, money: true, tone: toneSign(v.dayPnl), sub: v.dayPct != null ? `${v.dayPct >= 0 ? '+' : '−'}${Math.abs(v.dayPct).toFixed(2)} %` : null }),
    c('unreal', 'UNREALIZED', { value: v.unrealized == null ? '—' : fmtUsdSigned(v.unrealized), usd: v.unrealized, money: true, tone: toneSign(v.unrealized), sub: v.upDown }),
    c('realized', 'REALIZED', { value: v.realized == null ? '—' : fmtUsdSigned(v.realized), usd: v.realized, money: true, tone: toneSign(v.realized), sub: v.ytd != null ? `YTD ${fmtUsdSigned(v.ytd)}` : null }),
    c('exposure', 'EXPOSURE', { value: v.exposure == null ? '—' : fmtUsdCompact(v.exposure), usd: v.exposure, money: true, sub: v.expoPct != null ? `${Math.round(v.expoPct)} % NLV` : null, hint: 'Capital DÉPLOYÉ (primes) = Max Loss long' }),
    c('risk', 'CAP. RISQUE', { value: v.riskDollar == null ? '—' : fmtUsd(v.riskDollar), usd: v.riskDollar, money: true, sub: 'SL35 · ≠ Max Loss', hint: 'Σ risque stop (35 % prime) — distinct de Max Loss/EXPOSURE' }),
    c('powder', 'POUDRE SÈCHE', { value: v.powder == null ? '—' : fmtUsdCompact(v.powder), usd: v.powder, money: true, sub: v.powderPct != null ? `est. · ${Math.round(v.powderPct)} % NLV` : 'est.', est: true, hint: 'Estimation (availableUsd cash-A) — PAS la Buying Power IBKR (TODO Sprint C)' }),
    c('theta', 'Θ / JOUR', { value: v.thetaDay == null ? '—' : fmtUsdSigned(v.thetaDay), usd: v.thetaDay, money: true, sub: 'carry', hint: 'Coût de portage — promu du cockpit Σ' }),
    deltaCell,
    c('win', 'WIN RATE', { value: v.winRate == null ? '—' : `${v.winRate.toFixed(0)}%`, sub: v.trades != null ? `${v.trades} tr.` : null }),
    c('pf', 'PROFIT FACTOR', { value: v.profitFactor == null ? '—' : (Number.isFinite(v.profitFactor) ? v.profitFactor.toFixed(2) : '∞') }),
    c('dte', 'DTE PROCHE', { value: v.dte == null ? '—' : `${v.dte} j`, sub: v.dteTicker || null }),
  ];
}

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
    if (Number.isFinite(d) && (dte == null || d < dte)) {
      dte = d;
      dteTicker = p.tk || null;
    }
  }

  return {
    nlv,
    nlvSpark: (series || []).slice(-30).map((p) => p.nlv),
    dayPnl,
    dayPct,
    powder: availableUsd ?? null,
    powderPct: availableUsd != null && nlv > 0 ? (availableUsd / nlv) * 100 : null,
    riskDollar: riskDollar ?? null,
    unrealized: metrics?.unrealizedPnlUsd ?? null,
    upDown: null,
    realized: metrics?.realizedPnlUsd ?? null,
    ytd: null,
    exposure: metrics?.totalExposure ?? null,
    expoPct: metrics?.totalExposure != null && nlv > 0 ? (metrics.totalExposure / nlv) * 100 : null,
    thetaDay: Number.isFinite(greeks?.thetaDaily) ? greeks.thetaDaily : null,
    netDeltaDollar: Number.isFinite(greeks?.notionalDelta) ? greeks.notionalDelta : null,
    netDeltaShares: Number.isFinite(greeks?.sumDelta) ? greeks.sumDelta : null,
    winRate: winRate ?? null,
    profitFactor: profitFactor ?? null,
    trades: null,
    dte,
    dteTicker,
  };
}

// ─── Démo : synthétique dense (aucune écriture store) ───────────
export function deriveKpisDemo(variant, series, inputs) {
  if (!series || series.length === 0) {
    return { nlv: null, dayPnl: null, powder: null, riskDollar: null, unrealized: null, realized: null, exposure: null, thetaDay: null, netDeltaDollar: null, netDeltaShares: null, winRate: null, profitFactor: null, dte: null };
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
    nlv: last.nlv,
    nlvSpark: series.slice(-30).map((p) => p.nlv),
    dayPnl,
    dayPct,
    powder: Math.round(last.nlv * 0.46),
    powderPct: 46,
    riskDollar: Math.round(exposure * 0.35),
    unrealized: variant === 'drawdown' ? -180 : 312,
    upDown: variant === 'drawdown' ? '1↑ · 3↓' : '3↑ · 1↓',
    realized: last.flowNeutral,
    ytd: Math.round(last.flowNeutral * 0.7),
    exposure,
    expoPct: 42,
    thetaDay: -Math.round(96 * scale),
    netDeltaDollar: Math.round((variant === 'drawdown' ? -14200 : 34800)),
    netDeltaShares: Math.round((variant === 'drawdown' ? -140 : 420)),
    winRate,
    profitFactor: pf,
    trades: closed.length || null,
    dte: variant === 'sparse' ? 44 : 9,
    dteTicker: variant === 'sparse' ? 'XOM' : 'MSFT',
  };
}
