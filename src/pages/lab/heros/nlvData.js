// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — COUCHE DONNÉE NLV (DEV-only, purgé fin 1.D)
//
//  « Donnée d'abord » : le héros trace une SÉRIE NLV DENSE (1 point
//  par jour, la NLV existe tous les jours même à zéro clôture), pas
//  le P&L cumulé par trade (abandonné comme source du héros).
//
//  Source réelle = settings.dailySnapshots[].nlv (persisté par le
//  writer du Dashboard) + point live du jour. La dérivation est PURE
//  (buildNlvSeries) : le même pipeline sert le mode « démo dense »
//  (snapshots synthétiques EN MÉMOIRE, zéro écriture localStorage —
//  §7) et le mode « store réel ». Aucune donnée inventée en prod.
//
//  GOTCHA APPORT (honnête) : un dépôt fait SAUTER la NLV → un drawdown
//  serait « guéri » par un simple virement. On neutralise les flux :
//  le drawdown/underwater est calculé sur `flowNeutral = nlv −
//  dépôts cumulés` (magnitude en $, toujours honnête), et le % de DD
//  est rapporté au high-water mark AJUSTÉ DES FLUX (base capital
//  réelle, jamais dishonnête). Les dépôts sont AUSSI marqués sur la
//  courbe → le saut est expliqué, pas masqué.
// ═══════════════════════════════════════════════════════════════

import { extractFundingFlows } from '../../../utils/metrics/equityTimeline';

const DAY_MS = 86_400_000;

/**
 * Dérive la série NLV dense annotée à partir des inputs bruts.
 *
 * @param {Object} args
 * @param {Array<{date,nlv,unrealized?,realized?,exposure?,availCapital?}>} args.snapshots
 * @param {Array} args.cashFlows       state.cashFlows (dépôts/retraits)
 * @param {Array} args.closedTrades    {do, pnl} pour les marqueurs de trade
 * @param {number|null} args.liveNlv   NLV live du jour (point intraday)
 * @param {number} args.liveRate       CHF/USD (conversion des flux CHF)
 * @param {string} args.today          ISO YYYY-MM-DD
 * @returns {Array<Object>} points date-ordered, annotés
 */
export function buildNlvSeries({ snapshots, cashFlows, closedTrades, liveNlv, liveRate = 1, today }) {
  const clean = (Array.isArray(snapshots) ? snapshots : [])
    .filter((s) => s && typeof s.date === 'string' && Number.isFinite(s.nlv) && s.nlv > 0)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  // Dé-duplication par date (dernière valeur gagne).
  const byDate = new Map();
  for (const s of clean) byDate.set(s.date, s);
  const days = Array.from(byDate.values());

  // Point live du jour : override / append si NLV live fraîche.
  if (Number.isFinite(liveNlv) && liveNlv > 0 && today) {
    const existing = byDate.get(today);
    if (existing) existing.nlv = liveNlv;
    else {
      days.push({ date: today, nlv: liveNlv, live: true });
      days.sort((a, b) => a.date.localeCompare(b.date));
    }
  }
  if (days.length === 0) return [];

  // Flux de financement (dépôts/retraits) en USD, triés.
  const flows = extractFundingFlows(cashFlows, liveRate);
  const depositDates = new Set(flows.filter((f) => f.netUsd > 0).map((f) => f.date));
  const depositAmountByDate = new Map();
  for (const f of flows) {
    if (f.netUsd > 0) depositAmountByDate.set(f.date, (depositAmountByDate.get(f.date) || 0) + f.netUsd);
  }

  // Clôtures par date (P&L net du jour + compte) pour les marqueurs.
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
  let hwmNlv = 0; // NLV au high-water mark flow-neutral (base capital honnête)
  let prevFN = null;
  const out = days.map((d, idx) => {
    const dep = cumDepositsAt(d.date);
    const flowNeutral = d.nlv - dep;
    const chg = prevFN == null ? 0 : Math.round(flowNeutral - prevFN); // Δ jour flow-neutral
    prevFN = flowNeutral;
    if (flowNeutral > peakFN) {
      peakFN = flowNeutral;
      hwmNlv = d.nlv;
    }
    // Clé de dépôt : jour (l'intraday utilise la date jour du préfixe).
    const dayKey = d.date.slice(0, 10);
    const drawdownUsd = Math.max(0, peakFN - flowNeutral); // ≥ 0, deposit-neutral
    const underwater = -Math.round(drawdownUsd); // ≤ 0 $ (tracé)
    // % rapporté au HWM ajusté des flux → base capital réelle, honnête.
    const drawdownPct = hwmNlv > 0 ? -(drawdownUsd / hwmNlv) * 100 : 0;
    const close = closesByDate.get(d.date) || null;
    return {
      date: d.date,
      nlv: Math.round(d.nlv),
      flowNeutral: Math.round(flowNeutral),
      underwater,
      drawdownUsd: Math.round(drawdownUsd),
      drawdownPct: Number(drawdownPct.toFixed(2)),
      chg,
      // Le financement initial (1er point) n'est PAS un « apport en cours »
      // → on ne marque que les dépôts postérieurs (ceux qui « guérissent »
      // un drawdown, le vrai gotcha à expliquer).
      deposit: idx > 0 && depositDates.has(dayKey),
      depositAmount: idx > 0 ? depositAmountByDate.get(dayKey) || 0 : 0,
      dayPnl: close ? Math.round(close.pnl) : null,
      tradeCount: close ? close.count : 0,
      live: Boolean(d.live),
      unrealized: Number.isFinite(d.unrealized) ? d.unrealized : null,
    };
  });

  return out;
}

// ─── Rééchantillonnage RÉEL par période ─────────────────────────
// Slice à la fenêtre puis, si trop de points, agrège en buckets
// (dernière valeur du bucket = clôture ; conserve flags dépôt/trade).
const TF_DAYS = { '5D': 5, '1M': 31, '3M': 92, '1Y': 366 };
export const TIMEFRAMES = ['5D', '1M', '3M', 'YTD', '1Y', 'ALL'];

function bucketKey(dateMs, mode) {
  const d = new Date(dateMs);
  if (mode === 'week') {
    // Lundi de la semaine ISO (approx UTC).
    const day = (d.getUTCDay() + 6) % 7;
    const monday = dateMs - day * DAY_MS;
    return new Date(monday).toISOString().slice(0, 10);
  }
  // month
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

  // Downsample si densité excessive → lisibilité (vrai rééchantillonnage).
  const MAX = 190;
  if (sliced.length <= MAX) return sliced;
  const spanDays = (Date.parse(sliced[sliced.length - 1].date) - Date.parse(sliced[0].date)) / DAY_MS;
  const mode = spanDays > 400 ? 'month' : 'week';
  const buckets = new Map();
  for (const p of sliced) {
    const k = bucketKey(Date.parse(p.date), mode);
    const cur = buckets.get(k);
    if (!cur) {
      buckets.set(k, { ...p });
    } else {
      // Conserve la dernière valeur mais agrège les flags/P&L du bucket.
      const merged = { ...p };
      merged.deposit = cur.deposit || p.deposit;
      merged.tradeCount = (cur.tradeCount || 0) + (p.tradeCount || 0);
      merged.dayPnl =
        (cur.dayPnl || 0) + (p.dayPnl || 0) || (cur.dayPnl == null && p.dayPnl == null ? null : 0);
      buckets.set(k, merged);
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Snapshots DÉMO denses (EN MÉMOIRE — jamais écrits) ─────────
// Déterministe (LCG seedé) : ~180 jours, 1 point/jour, drift positif +
// bruit + un vrai creux + 2 apports datés + jours de clôture épars.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ANCHOR_MS = Date.parse('2026-07-18');
const isoOff = (off) => new Date(ANCHOR_MS + off * DAY_MS).toISOString().slice(0, 10);

/**
 * Construit un jeu démo dense { snapshots, cashFlows, closedTrades,
 * liveNlv, today } prêt pour buildNlvSeries — EN MÉMOIRE.
 * @param {'nominal'|'drawdown'|'sparse'|'empty'} variant
 */
export function makeDemoInputs(variant = 'nominal') {
  const today = isoOff(0);
  if (variant === 'empty') {
    return { snapshots: [], cashFlows: [], closedTrades: [], liveNlv: null, today };
  }
  const rnd = mulberry32(variant === 'drawdown' ? 42 : 7);
  const spanDays = variant === 'sparse' ? 6 : 182;
  const base = 8000;
  const cashFlows = [
    { id: 'f1', da: isoOff(-spanDays), ty: 'dep_usd', a1: String(base) },
  ];
  if (variant !== 'sparse') {
    cashFlows.push({ id: 'f2', da: isoOff(-70), ty: 'dep_usd', a1: '3000' });
  }

  const snapshots = [];
  let pnl = 0; // cumulé flow-neutral
  const ddStart = variant === 'drawdown' ? 0.34 : 0.5;
  const ddEnd = variant === 'drawdown' ? 0.52 : 0.62;
  const drift = variant === 'drawdown' ? 4 : 9;
  const vol = variant === 'drawdown' ? 42 : 30;
  for (let i = 0; i <= spanDays; i++) {
    const off = -spanDays + i;
    const frac = i / spanDays;
    let step = drift + (rnd() - 0.5) * 2 * vol;
    // Zone de creux : biais négatif marqué.
    if (frac > ddStart && frac < ddEnd) step -= variant === 'drawdown' ? 78 : 42;
    pnl += step;
    let deployed = base + (off >= -70 && variant !== 'sparse' ? 3000 : 0);
    const nlv = Math.max(1, Math.round(deployed + pnl));
    snapshots.push({
      date: isoOff(off),
      nlv,
      unrealized: Math.round((rnd() - 0.4) * 400),
      realized: Math.round(pnl),
      exposure: Math.round(deployed * (0.3 + rnd() * 0.25)),
      availCapital: Math.round(nlv * (0.4 + rnd() * 0.2)),
    });
  }

  // Jours de clôture épars (marqueurs de trade colorés par P&L réel).
  const closedTrades = [];
  const tks = ['AAPL', 'NVDA', 'MSFT', 'XOM', 'CVX', 'AMD', 'META', 'GOOG', 'SPY', 'TSLA'];
  const nCloses = variant === 'sparse' ? 2 : 16;
  for (let k = 0; k < nCloses; k++) {
    const off = -Math.round((k + 0.5) * (spanDays / nCloses));
    const win = rnd() > (variant === 'drawdown' ? 0.5 : 0.38);
    const mag = 120 + Math.round(rnd() * 520);
    closedTrades.push({
      id: `c${k}`,
      tk: tks[k % tks.length],
      as: 'Option',
      dir: 'Long',
      pnl: win ? mag : -Math.round(mag * 0.7),
      do: isoOff(off),
      di: isoOff(off - 12),
    });
  }

  // ── Intraday (5 derniers jours, ~7 pts/séance) — DÉMO uniquement.
  //    L'infra réelle n'existe pas (snapshots quotidiens seuls) → ceci
  //    MONTRE la cible ; le câblage intraday réel est un TODO app-side.
  const intradaySnapshots = [];
  if (variant !== 'empty' && snapshots.length >= 5) {
    const hours = ['09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:00', '16:00'];
    for (let dOff = 4; dOff >= 0; dOff--) {
      const dayIdx = snapshots.length - 1 - dOff;
      if (dayIdx < 1) continue;
      const prevClose = snapshots[dayIdx - 1].nlv;
      const close = snapshots[dayIdx].nlv;
      const dayDate = snapshots[dayIdx].date;
      for (let h = 0; h < hours.length; h++) {
        const frac = h / (hours.length - 1);
        // Interpole prevClose→close + bruit intraday.
        const v = prevClose + (close - prevClose) * frac + (rnd() - 0.5) * 2 * 55;
        intradaySnapshots.push({ date: `${dayDate}T${hours[h]}`, nlv: Math.max(1, Math.round(v)) });
      }
    }
  }

  const liveNlv = snapshots[snapshots.length - 1]?.nlv ?? null;
  return { snapshots, intradaySnapshots, cashFlows, closedTrades, liveNlv, today };
}

// Perf DE LA FENÊTRE affichée — métriques CONCRÈTES « sur cette période,
// voilà ». P&L flow-neutral (dépôts neutralisés), extrêmes NLV de la
// fenêtre, max DD de la fenêtre, clôtures + win rate de la fenêtre.
export function deriveWindowStats(series) {
  if (!Array.isArray(series) || series.length < 2) return { empty: true };
  const first = series[0];
  const last = series[series.length - 1];
  const pnl = last.flowNeutral - first.flowNeutral; // P&L de la période
  const startCapital = first.nlv || 1;
  const pnlPct = startCapital > 0 ? (pnl / startCapital) * 100 : null;

  const nlvs = series.map((p) => p.nlv);
  const high = Math.max(...nlvs);
  const low = Math.min(...nlvs);

  // Meilleur / pire jour (Δ flow-neutral quotidien) + séances ↑/↓.
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

  // Max drawdown DE LA FENÊTRE (recalculé flow-neutral sur la fenêtre).
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

  // Clôtures de la fenêtre + win rate de la fenêtre.
  const closes = series.filter((p) => p.dayPnl != null);
  const wins = closes.filter((p) => p.dayPnl > 0).length;
  const winRate = closes.length ? (wins / closes.length) * 100 : null;

  return {
    empty: false,
    pnl, pnlPct,
    high, low,
    bestDay, worstDay,
    maxDDUsd, maxDDPct: -maxDDPct,
    closeCount: closes.length, winRate,
    up, down,
  };
}

// Stats denses du pied de graphe, dérivées de la série (annotée).
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

  // Enrichissements (bande stats du bas) — clôtures = argent réel.
  const winsArr = dayPnls.filter((v) => v > 0);
  const lossArr = dayPnls.filter((v) => v < 0);
  const avgWin = winsArr.length ? winsArr.reduce((a, b) => a + b, 0) / winsArr.length : null;
  const avgLoss = lossArr.length ? lossArr.reduce((a, b) => a + b, 0) / lossArr.length : null;
  const expectancy = dayPnls.length ? dayPnls.reduce((a, b) => a + b, 0) / dayPnls.length : null;
  const netProfit = last.flowNeutral - series[0].flowNeutral;
  const recoveryFactor = maxDDUsd > 0 ? netProfit / maxDDUsd : null;

  // Jours ↑ / plus longues séries (Δ flow-neutral quotidien).
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
    empty: false,
    high, low, peak: high,
    maxDDUsd, maxDDPct: -maxDDPct,
    currentDDUsd: last.drawdownUsd, currentDDPct: last.drawdownPct,
    best, worst, spanDays,
    points: series.length,
    closeCount: closes.length,
    avgWin, avgLoss, expectancy, recoveryFactor,
    pctWinDays, longWin, longLoss,
    firstDate: series[0].date, lastDate: last.date,
  };
}

export const DEMO_VARIANTS = [
  ['nominal', 'Démo dense · nominal'],
  ['drawdown', 'Démo · gros drawdown'],
  ['sparse', 'Démo · naissant'],
  ['empty', 'Vide (compte neuf)'],
];
