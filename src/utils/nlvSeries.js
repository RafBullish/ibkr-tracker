// ═══════════════════════════════════════════════════════════════
//  NLV SERIES — série NLV dense du Héros 1 (brique 1.D). PUR, sans React.
//
//  « Donnée d'abord » : le héros trace une SÉRIE NLV DENSE (1 point/jour,
//  la NLV existe tous les jours même à zéro clôture), pas le P&L cumulé
//  par trade. Source = settings.dailySnapshots[].nlv + point live du jour.
//
//  GOTCHA APPORT (honnête) : un dépôt fait sauter la NLV → un drawdown
//  serait « guéri » par un simple virement. On neutralise les flux : le
//  drawdown/underwater est calculé sur `flowNeutral = nlv − dépôts
//  cumulés` (magnitude $, toujours honnête), le % rapporté au high-water
//  mark AJUSTÉ DES FLUX. Les dépôts sont marqués sur la courbe.
// ═══════════════════════════════════════════════════════════════

import { extractFundingFlows } from './metrics/equityTimeline';
import { buildBackfillDays } from './nlvBackfill';

const DAY_MS = 86_400_000;

// POLISH-1 (E5) — garde d'écriture des writers de snapshots NLV :
// n'écrire que du NLV réel (nombre fini strictement > 0). Alignée sur
// la garde intraday (nlvIntraday.appendIntradaySample) ; consommée par
// useDailySnapshotWriter (Dashboard).
export const isWritableNlv = (nlv) =>
  typeof nlv === 'number' && Number.isFinite(nlv) && nlv > 0;

/**
 * Dérive la série NLV dense annotée à partir des inputs bruts (store).
 * FIX-NLV (v1.0.1) : les jours ANTÉRIEURS au premier point réel sont
 * reconstitués à la lecture depuis clôtures + flux (cf. nlvBackfill) —
 * points marqués synth:true, un point réel PRIME toujours.
 * @param {{snapshots:Array, cashFlows:Array, closedTrades:Array,
 *          liveNlv:number|null, liveRate:number, today:string,
 *          unrealizedLive:number|null}} args
 * @returns {Array<Object>} points date-ordered, annotés
 */
export function buildNlvSeries({ snapshots, cashFlows, closedTrades, liveNlv, liveRate = 1, today, unrealizedLive = null }) {
  const clean = (Array.isArray(snapshots) ? snapshots : [])
    .filter((s) => s && typeof s.date === 'string' && Number.isFinite(s.nlv) && s.nlv > 0)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  const byDate = new Map();
  // Copies superficielles (POLISH-1 E6) : le merge du point live du
  // jour écrase `nlv` sur SA copie — jamais sur l'objet du store.
  for (const s of clean) byDate.set(s.date, { ...s });
  const days = Array.from(byDate.values());

  if (Number.isFinite(liveNlv) && liveNlv > 0 && today) {
    const existing = byDate.get(today);
    if (existing) existing.nlv = liveNlv;
    else {
      days.push({ date: today, nlv: liveNlv, live: true });
      days.sort((a, b) => a.date.localeCompare(b.date));
    }
  }
  if (days.length === 0) return [];

  // L'histoire reconstituée : uniquement AVANT le premier point réel
  // (la veille au plus tard). Si le journal des snapshots couvre déjà
  // l'historique, backfill est vide et rien ne change.
  const { days: backfill } = buildBackfillDays({
    cashFlows,
    closedTrades,
    liveNlv,
    liveRate,
    unrealizedLive,
    firstRealDate: days[0].date,
  });
  const full = backfill.length
    ? [...backfill.filter((b) => b.date < days[0].date), ...days]
    : days;

  const flows = extractFundingFlows(cashFlows, liveRate);
  const depositDates = new Set(flows.filter((f) => f.netUsd > 0).map((f) => f.date));
  const depositAmountByDate = new Map();
  for (const f of flows) {
    if (f.netUsd > 0) depositAmountByDate.set(f.date, (depositAmountByDate.get(f.date) || 0) + f.netUsd);
  }

  const closesByDate = new Map();
  for (const t of closedTrades || []) {
    const d = t?.do;
    if (!d) continue;
    const pnl = Number(t.pnl);
    const cur = closesByDate.get(d) || { pnl: 0, count: 0 };
    cur.pnl += Number.isFinite(pnl) ? pnl : 0;
    cur.count += 1;
    closesByDate.set(d, cur);
  }

  const cumDepositsAt = (date) => {
    let sum = 0;
    for (const f of flows) {
      if (f.date <= date) sum += f.netUsd;
      else break;
    }
    return sum;
  };

  let peakFN = -Infinity;
  let hwmNlv = 0;
  let prevFN = null;
  return full.map((d, idx) => {
    const dep = cumDepositsAt(d.date);
    const flowNeutral = d.nlv - dep;
    const chg = prevFN == null ? 0 : Math.round(flowNeutral - prevFN);
    prevFN = flowNeutral;
    if (flowNeutral > peakFN) { peakFN = flowNeutral; hwmNlv = d.nlv; }
    const dayKey = d.date.slice(0, 10);
    const drawdownUsd = Math.max(0, peakFN - flowNeutral);
    const underwater = -Math.round(drawdownUsd);
    const drawdownPct = hwmNlv > 0 ? -(drawdownUsd / hwmNlv) * 100 : 0;
    const close = closesByDate.get(dayKey) || null;
    return {
      date: d.date,
      nlv: Math.round(d.nlv),
      flowNeutral: Math.round(flowNeutral),
      underwater,
      drawdownUsd: Math.round(drawdownUsd),
      drawdownPct: Number(drawdownPct.toFixed(2)),
      chg,
      deposit: idx > 0 && depositDates.has(dayKey),
      depositAmount: idx > 0 ? depositAmountByDate.get(dayKey) || 0 : 0,
      dayPnl: close ? Math.round(close.pnl) : null,
      tradeCount: close ? close.count : 0,
      live: Boolean(d.live),
      synth: Boolean(d.synth),
      unrealized: Number.isFinite(d.unrealized) ? d.unrealized : null,
      exposure: Number.isFinite(d.exposure) ? d.exposure : null,
    };
  });
}

// ─── Rééchantillonnage RÉEL par période ─────────────────────────
const TF_DAYS = { '1D': 1, '5D': 5, '1M': 31, '3M': 92, '1Y': 366 };
export const TIMEFRAMES = ['5D', '1M', '3M', 'YTD', '1Y', 'ALL'];
// FF-données : « 1D » n'existe QUE sur Héros 1 (série NLV, densifiable en
// intraday). TIMEFRAMES reste la liste partagée (Héros 2 réalisé inclus).
export const TIMEFRAMES_HERO1 = ['1D', ...TIMEFRAMES];

function bucketKey(dateMs, mode) {
  const d = new Date(dateMs);
  if (mode === 'week') {
    const day = (d.getUTCDay() + 6) % 7;
    const monday = dateMs - day * DAY_MS;
    return new Date(monday).toISOString().slice(0, 10);
  }
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function resampleSeries(series, range) {
  if (!Array.isArray(series) || series.length === 0) return [];
  const lastMs = Date.parse(series[series.length - 1].date);
  let sliced = series;
  if (range !== 'ALL') {
    let cutoff;
    if (range === 'YTD') {
      const d = new Date(lastMs);
      cutoff = Date.UTC(d.getUTCFullYear(), 0, 1);
    } else {
      const n = TF_DAYS[range];
      cutoff = Number.isFinite(n) ? lastMs - n * DAY_MS : -Infinity;
    }
    sliced = series.filter((p) => Date.parse(p.date) >= cutoff);
  }
  if (sliced.length === 0) return [];

  const MAX = 190;
  if (sliced.length <= MAX) return sliced;
  const spanDays = (Date.parse(sliced[sliced.length - 1].date) - Date.parse(sliced[0].date)) / DAY_MS;
  const mode = spanDays > 400 ? 'month' : 'week';
  const buckets = new Map();
  for (const p of sliced) {
    const k = bucketKey(Date.parse(p.date), mode);
    const cur = buckets.get(k);
    if (!cur) buckets.set(k, { ...p });
    else {
      const merged = { ...p };
      merged.deposit = cur.deposit || p.deposit;
      merged.synth = Boolean(cur.synth || p.synth);
      merged.tradeCount = (cur.tradeCount || 0) + (p.tradeCount || 0);
      merged.dayPnl = (cur.dayPnl || 0) + (p.dayPnl || 0) || (cur.dayPnl == null && p.dayPnl == null ? null : 0);
      buckets.set(k, merged);
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Série INTRADAY (FF-données) ────────────────────────────────
// Déplie le buffer qc:nlvIntraday (échantillons ~5 min en séance RTH)
// en série TvChart pour les ranges 1D/5D. Même sémantique honnête que
// la série quotidienne : flowNeutral = nlv − dépôts cumulés du jour
// (dérivés du daily annoté : dep = nlv − flowNeutral), et le drawdown
// est mesuré contre le HIGH-WATER MARK flow-neutral SEEDÉ de tout
// l'historique quotidien antérieur à la fenêtre — jamais contre le
// début de fenêtre. Un apport intraday ne « guérit » donc rien.
//
// Chaque point porte `t` = epoch décalée à l'heure LOCALE (l'axe temps
// de lightweight-charts affiche l'UTC de l'epoch reçue : le décalage
// rend l'axe et le crosshair lisibles en heure murale locale).
export function buildIntradaySeries({ dailySeries, intradayDays, liveNlv = null, sessionDays = 5, nowMs = Date.now() }) {
  const days = (Array.isArray(intradayDays) ? intradayDays : [])
    .filter((d) => d && typeof d.d === 'string' && Array.isArray(d.pts) && d.pts.length > 0)
    .slice(-Math.max(1, sessionDays));
  if (days.length === 0) return [];

  const daily = Array.isArray(dailySeries) ? dailySeries : [];
  const depByDate = new Map();
  for (const p of daily) depByDate.set(p.date.slice(0, 10), p.nlv - p.flowNeutral);
  const depFor = (day) => {
    if (depByDate.has(day)) return depByDate.get(day);
    let dep = 0;
    for (const p of daily) {
      if (p.date.slice(0, 10) <= day) dep = p.nlv - p.flowNeutral;
      else break;
    }
    return dep;
  };

  const firstDay = days[0].d;
  let peakFN = -Infinity;
  let hwmNlv = 0;
  for (const p of daily) {
    if (p.date.slice(0, 10) >= firstDay) break;
    if (p.flowNeutral > peakFN) { peakFN = p.flowNeutral; hwmNlv = p.nlv; }
  }

  const toPoint = (tsSec, nlv, day, live) => {
    const dep = depFor(day);
    const flowNeutral = nlv - dep;
    if (flowNeutral > peakFN) { peakFN = flowNeutral; hwmNlv = nlv; }
    const drawdownUsd = Math.max(0, peakFN - flowNeutral);
    const dt = new Date(tsSec * 1000);
    return {
      date: `${day}T${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`,
      t: tsSec - dt.getTimezoneOffset() * 60,
      nlv: Math.round(nlv),
      flowNeutral: Math.round(flowNeutral),
      underwater: -Math.round(drawdownUsd),
      drawdownUsd: Math.round(drawdownUsd),
      drawdownPct: hwmNlv > 0 ? Number((-(drawdownUsd / hwmNlv) * 100).toFixed(2)) : 0,
      chg: 0,
      deposit: false,
      depositAmount: 0,
      dayPnl: null,
      tradeCount: 0,
      live: Boolean(live),
    };
  };

  const out = [];
  for (const d of days) {
    for (const [ts, nlv] of d.pts) {
      if (!Number.isFinite(ts) || !Number.isFinite(nlv) || nlv <= 0) continue;
      out.push(toPoint(ts, nlv, d.d));
    }
  }
  // Point live : la NLV courante du store, plus fraîche que le dernier
  // échantillon 5 min (même rôle que le point live de la série quotidienne).
  if (Number.isFinite(liveNlv) && liveNlv > 0 && out.length > 0) {
    const nowSec = Math.floor(nowMs / 1000);
    const lastTs = days[days.length - 1].pts[days[days.length - 1].pts.length - 1][0];
    if (nowSec > lastTs) out.push(toPoint(nowSec, liveNlv, new Date(nowMs).toISOString().slice(0, 10), true));
  }

  let prevFN = null;
  for (const p of out) {
    p.chg = prevFN == null ? 0 : Math.round(p.flowNeutral - prevFN);
    prevFN = p.flowNeutral;
  }
  return out;
}

// ─── Stats de la fenêtre affichée (bande perf) ──────────────────
export function deriveWindowStats(series) {
  if (!Array.isArray(series) || series.length < 2) return { empty: true };
  const first = series[0];
  const last = series[series.length - 1];
  const pnl = last.flowNeutral - first.flowNeutral;
  const startCapital = first.nlv || 1;
  const pnlPct = startCapital > 0 ? (pnl / startCapital) * 100 : null;
  const nlvs = series.map((p) => p.nlv);
  const high = Math.max(...nlvs);
  const low = Math.min(...nlvs);

  let bestDay = null;
  let worstDay = null;
  let up = 0;
  let down = 0;
  for (let i = 1; i < series.length; i++) {
    const d = series[i].flowNeutral - series[i - 1].flowNeutral;
    if (bestDay == null || d > bestDay) bestDay = d;
    if (worstDay == null || d < worstDay) worstDay = d;
    if (d > 0) up++;
    else if (d < 0) down++;
  }

  let peakFN = series[0].flowNeutral;
  let hwmNlv = series[0].nlv;
  let maxDDUsd = 0;
  let maxDDPct = 0;
  for (const p of series) {
    if (p.flowNeutral > peakFN) { peakFN = p.flowNeutral; hwmNlv = p.nlv; }
    const dd = peakFN - p.flowNeutral;
    if (dd > maxDDUsd) maxDDUsd = dd;
    if (hwmNlv > 0) { const ddp = (dd / hwmNlv) * 100; if (ddp > maxDDPct) maxDDPct = ddp; }
  }

  const closes = series.filter((p) => p.dayPnl != null);
  const wins = closes.filter((p) => p.dayPnl > 0).length;
  const winRate = closes.length ? (wins / closes.length) * 100 : null;

  return { empty: false, pnl, pnlPct, high, low, bestDay, worstDay, maxDDUsd, maxDDPct: -maxDDPct, closeCount: closes.length, winRate, up, down };
}

// ─── Stats de référence (bande stats du bas) ────────────────────
export function deriveSeriesStats(series) {
  if (!Array.isArray(series) || series.length === 0) return { empty: true };
  const nlvs = series.map((p) => p.nlv);
  const high = Math.max(...nlvs);
  const low = Math.min(...nlvs);
  const last = series[series.length - 1];
  let maxDDUsd = 0;
  let maxDDPct = 0;
  for (const p of series) {
    if (p.drawdownUsd > maxDDUsd) maxDDUsd = p.drawdownUsd;
    if (Math.abs(p.drawdownPct) > maxDDPct) maxDDPct = Math.abs(p.drawdownPct);
  }
  const closes = series.filter((p) => p.dayPnl != null);
  const dayPnls = closes.map((p) => p.dayPnl);
  const best = dayPnls.length ? Math.max(...dayPnls) : null;
  const worst = dayPnls.length ? Math.min(...dayPnls) : null;
  const spanDays = Math.round((Date.parse(last.date) - Date.parse(series[0].date)) / DAY_MS);

  const winsArr = dayPnls.filter((v) => v > 0);
  const lossArr = dayPnls.filter((v) => v < 0);
  const avgWin = winsArr.length ? winsArr.reduce((a, b) => a + b, 0) / winsArr.length : null;
  const avgLoss = lossArr.length ? lossArr.reduce((a, b) => a + b, 0) / lossArr.length : null;
  const expectancy = dayPnls.length ? dayPnls.reduce((a, b) => a + b, 0) / dayPnls.length : null;
  const netProfit = last.flowNeutral - series[0].flowNeutral;
  const recoveryFactor = maxDDUsd > 0 ? netProfit / maxDDUsd : null;

  let upDays = 0;
  let dayCount = 0;
  let longWin = 0;
  let longLoss = 0;
  let curWin = 0;
  let curLoss = 0;
  for (let i = 1; i < series.length; i++) {
    const d = series[i].flowNeutral - series[i - 1].flowNeutral;
    if (d === 0) continue;
    dayCount++;
    if (d > 0) { upDays++; curWin++; curLoss = 0; if (curWin > longWin) longWin = curWin; }
    else { curLoss++; curWin = 0; if (curLoss > longLoss) longLoss = curLoss; }
  }
  const pctWinDays = dayCount ? (upDays / dayCount) * 100 : null;

  return {
    empty: false, high, low, peak: high, maxDDUsd, maxDDPct: -maxDDPct,
    currentDDUsd: last.drawdownUsd, currentDDPct: last.drawdownPct,
    best, worst, spanDays, points: series.length, closeCount: closes.length,
    avgWin, avgLoss, expectancy, recoveryFactor, pctWinDays, longWin, longLoss,
    firstDate: series[0].date, lastDate: last.date,
  };
}
