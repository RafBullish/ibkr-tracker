// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — MODÈLE KPI (DEV-only, purgé fin 1.D)
//
//  Une seule forme de sortie (toKpiCells) alimentée par DEUX sources :
//    · deriveKpisReal(ctx) — lit les hooks réels (store)
//    · deriveKpisDemo(...)  — synthétique dense (captures sans seed)
//
//  Bande = 7 KPI conservés (NET LIQ, DAY P&L, UNREALIZED, REALIZED,
//  EXPOSURE, WIN RATE, PROFIT FACTOR) + ajouts de suivi quotidien.
//  RÈGLE DE HIÉRARCHIE : Θ/j et Δ net EXISTENT dans le cockpit Σ (plus
//  bas, hors 1.D) → on les PROMEUT ici en « coup d'œil du matin », on
//  ne les duplique pas (le cockpit garde l'analyse). Poudre sèche =
//  ESTIMATION (availableUsd cash-A), PAS la Buying Power IBKR réelle
//  (Sprint C non câblé) → marquée `est`.
//
//  Couleur : profit/loss UNIQUEMENT sur de l'argent réel (DAY P&L,
//  UNREALIZED, REALIZED). NET LIQ, EXPOSURE, poudre, WR, PF, Θ, Δ,
//  DTE, RISQUE = NEUTRES (loi de couleur ; Θ/Δ signés ≠ perte).
// ═══════════════════════════════════════════════════════════════

import { fmtUsd, fmtUsdSigned, fmtUsdCompact, toneSign } from './kit';

// Ordre canonique = hiérarchie. `head:true` = coup d'œil du matin.
export function toKpiCells(v) {
  const c = (id, label, value, opts = {}) => ({ id, label, value, ...opts });
  return [
    c('nlv', 'NET LIQ', v.nlv == null ? '—' : fmtUsdCompact(v.nlv), { head: true, hero: true, spark: v.nlvSpark }),
    c('day', 'DAY P&L', v.dayPnl == null ? '—' : fmtUsdSigned(v.dayPnl), { head: true, tone: toneSign(v.dayPnl), sub: v.dayPct != null ? `${v.dayPct >= 0 ? '+' : '−'}${Math.abs(v.dayPct).toFixed(2)} %` : null }),
    c('powder', 'POUDRE SÈCHE', v.powder == null ? '—' : fmtUsdCompact(v.powder), { head: true, sub: v.powderPct != null ? `est. · ${Math.round(v.powderPct)} % NLV` : 'est.' }),
    c('risk', 'CAP. RISQUE', v.riskDollar == null ? '—' : fmtUsd(v.riskDollar), { head: true, sub: 'SL35 · ≠ Max Loss', hint: 'Σ risque stop (35 % prime) — distinct de Max Loss/EXPOSURE' }),
    c('unreal', 'UNREALIZED', v.unrealized == null ? '—' : fmtUsdSigned(v.unrealized), { tone: toneSign(v.unrealized), sub: v.upDown }),
    c('realized', 'REALIZED', v.realized == null ? '—' : fmtUsdSigned(v.realized), { tone: toneSign(v.realized), sub: v.ytd != null ? `YTD ${fmtUsdSigned(v.ytd)}` : null }),
    c('exposure', 'EXPOSURE', v.exposure == null ? '—' : fmtUsdCompact(v.exposure), { sub: v.expoPct != null ? `${Math.round(v.expoPct)} % NLV` : null, hint: 'Capital DÉPLOYÉ (primes) = Max Loss long' }),
    c('theta', 'Θ / JOUR', v.thetaDay == null ? '—' : fmtUsdSigned(v.thetaDay), { sub: 'carry', hint: 'Coût de portage — promu du cockpit Σ' }),
    c('delta', 'Δ NET', v.netDelta == null ? '—' : (v.netDelta >= 0 ? '+' : '−') + Math.abs(Math.round(v.netDelta)).toLocaleString('de-CH'), { sub: 'directionnel', hint: 'Δ agrégé — promu du cockpit Σ' }),
    c('win', 'WIN RATE', v.winRate == null ? '—' : `${v.winRate.toFixed(0)}%`, { sub: v.trades != null ? `${v.trades} tr.` : null }),
    c('pf', 'PROFIT FACTOR', v.profitFactor == null ? '—' : (Number.isFinite(v.profitFactor) ? v.profitFactor.toFixed(2) : '∞'), {}),
    c('dte', 'DTE PROCHE', v.dte == null ? '—' : `${v.dte} j`, { sub: v.dteTicker || null }),
    c('ret', 'RENDEMENT', v.retPct == null ? '—' : `${v.retPct >= 0 ? '+' : '−'}${Math.abs(v.retPct).toFixed(1)}%`, { sub: 'période', hint: 'Rendement honnête sur base capital' }),
  ];
}

// ─── Réel : depuis les hooks du store ───────────────────────────
export function deriveKpisReal(ctx) {
  const { metrics, greeks, availableUsd, riskDollar, positions, series, closedCount, winRate, profitFactor, today } = ctx;
  const nlv = metrics?.netLiquidationValueUsd ?? null;
  const last = series && series.length ? series[series.length - 1] : null;
  const prev = series && series.length > 1 ? series[series.length - 2] : null;
  const dayPnl = last && prev ? last.flowNeutral - prev.flowNeutral : null;
  const dayPct = dayPnl != null && prev && prev.nlv > 0 ? (dayPnl / prev.nlv) * 100 : null;
  const startNlv = series && series.length ? series[0].nlv : null;
  const retPct = last && startNlv > 0 ? (last.flowNeutral / (last.nlv - last.flowNeutral || startNlv)) * 100 : null;

  // DTE le plus proche (positions option ouvertes).
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
    netDelta: Number.isFinite(greeks?.notionalDelta) ? greeks.notionalDelta : (Number.isFinite(greeks?.sumDelta) ? greeks.sumDelta : null),
    winRate: winRate ?? null,
    profitFactor: profitFactor ?? null,
    dte,
    dteTicker,
    retPct,
    nlvSpark: (series || []).slice(-30).map((p) => p.nlv),
  };
}

// ─── Démo : synthétique dense (aucune écriture store) ───────────
export function deriveKpisDemo(variant, series, inputs) {
  if (!series || series.length === 0) {
    return { nlv: null, dayPnl: null, powder: null, riskDollar: null, unrealized: null, realized: null, exposure: null, thetaDay: null, netDelta: null, winRate: null, profitFactor: null, dte: null, retPct: null };
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
  const capitalBase = last.nlv - last.flowNeutral || 8000;
  const exposure = Math.round(last.nlv * 0.42);
  const scale = variant === 'drawdown' ? 1.4 : 1;

  return {
    nlv: last.nlv,
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
    netDelta: Math.round((variant === 'drawdown' ? -140 : 420)),
    winRate,
    profitFactor: pf,
    dte: variant === 'sparse' ? 44 : 9,
    dteTicker: variant === 'sparse' ? 'XOM' : 'MSFT',
    retPct: capitalBase > 0 ? (last.flowNeutral / capitalBase) * 100 : null,
    nlvSpark: series.slice(-30).map((p) => p.nlv),
  };
}
