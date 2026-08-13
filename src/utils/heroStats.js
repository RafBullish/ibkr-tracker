// ═══════════════════════════════════════════════════════════════
//  HERO STATS — LA maison de vérité des stats de fenêtre du Héros 1
//  (HERO-FOOTER, v1.0.1 brique 3). PUR, sans React.
//
//  D2 « vérité avant rendu » : toutes les stats se calculent sur la
//  série QUOTIDIENNE de la fenêtre AVANT resampleSeries (le cap 190
//  est un détail d'affichage du tracé, plus jamais une source de
//  stats) + les clôtures de la fenêtre pour les compteurs. Fini les
//  buckets déguisés : le « 25 · 76 % win » qui comptait des semaines
//  au-delà de 190 points est mort — J. CLÔTURE compte des JOURS,
//  TRADES compte des CLÔTURES, quel que soit le range.
//
//  Sémantiques conservées (FIX-NLV / 1.D) :
//  · P&L de fenêtre = delta flow-neutral (un apport ne « gagne » rien) ;
//  · drawdown = celui des points quotidiens (peak seedé de TOUT
//    l'historique par buildNlvSeries), max sur la fenêtre + courant ;
//  · meilleur/pire JOUR = delta flow-neutral quotidien.
//
//  D6(a) — garde du % de drawdown : si la base flow-neutral rend le %
//  dénué de sens (tête de série reconstituée à base quasi nulle →
//  |%| > 100, le « −169.2 % » du seed), on rend null → « — » honnête,
//  le montant $ reste.
// ═══════════════════════════════════════════════════════════════

import { sliceSeriesWindow } from './nlvSeries';

const dayKey = (v) => (typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : null);

const sanePct = (pct) => (Number.isFinite(pct) && Math.abs(pct) <= 100 ? pct : null);

/**
 * Stats de fenêtre du Héros 1 — l'UNIQUE modèle du pied et de la ligne
 * de période.
 *
 * @param {Object} args
 * @param {Array}  args.dailyFull     série quotidienne COMPLÈTE (buildNlvSeries)
 * @param {string} args.range         '1D'|'5D'|'1M'|'3M'|'YTD'|'1Y'|'ALL'
 * @param {Array}  args.closedTrades  state.closedTrades (compteurs de fenêtre)
 * @returns {Object} stats — { empty } si < 2 points dans la fenêtre
 */
export function deriveHeroWindowStats({ dailyFull, range = 'ALL', closedTrades = [] }) {
  const win = sliceSeriesWindow(dailyFull, range);
  if (!Array.isArray(win) || win.length < 2) return { empty: true };

  const first = win[0];
  const last = win[win.length - 1];

  const pnl = last.flowNeutral - first.flowNeutral;
  const startCapital = first.nlv || 1;
  const pnlPct = startCapital > 0 ? (pnl / startCapital) * 100 : null;

  // Extrêmes QUOTIDIENS vrais (plus jamais des extrêmes de buckets).
  let high = -Infinity;
  let low = Infinity;
  for (const p of win) {
    if (p.nlv > high) high = p.nlv;
    if (p.nlv < low) low = p.nlv;
  }

  let maxDDUsd = 0;
  let maxDDPctRaw = 0;
  for (const p of win) {
    if (p.drawdownUsd > maxDDUsd) maxDDUsd = p.drawdownUsd;
    if (Math.abs(p.drawdownPct) > Math.abs(maxDDPctRaw)) maxDDPctRaw = p.drawdownPct;
  }

  let bestDay = null;
  let worstDay = null;
  let up = 0;
  let down = 0;
  for (let i = 1; i < win.length; i++) {
    const d = win[i].flowNeutral - win[i - 1].flowNeutral;
    if (bestDay == null || d > bestDay) bestDay = d;
    if (worstDay == null || d < worstDay) worstDay = d;
    if (d > 0) up++;
    else if (d < 0) down++;
  }
  const pctWinDays = up + down ? (up / (up + down)) * 100 : null;

  // Compteurs VRAIS sur les clôtures de la fenêtre.
  const firstDay = dayKey(first.date);
  const lastDay = dayKey(last.date);
  let tradeCount = 0;
  const closeDaySet = new Set();
  for (const t of Array.isArray(closedTrades) ? closedTrades : []) {
    const d = dayKey(t?.do);
    if (!d || d < firstDay || d > lastDay) continue;
    tradeCount++;
    closeDaySet.add(d);
  }

  const recoveryFactor = maxDDUsd > 0 ? pnl / maxDDUsd : null;

  // COULEUR (v1.0.1/4, C3) — le pic de référence du drawdown : le MÊME
  // pic flow-neutral (seedé de TOUT l'historique, FIX-NLV) qui fonde
  // MAX DD / DD COURANT — aucune nouvelle définition. On rejoue la
  // marche de buildNlvSeries (strictement supérieur) jusqu'au dernier
  // point de la fenêtre pour DATER ce pic → « DEPUIS PIC · N j ».
  let peakFN = -Infinity;
  let peakDate = null;
  for (const p of Array.isArray(dailyFull) ? dailyFull : []) {
    const d = dayKey(p.date);
    if (d == null || d > lastDay) break;
    if (p.flowNeutral > peakFN) {
      peakFN = p.flowNeutral;
      peakDate = d;
    }
  }
  const daysSincePeak =
    peakDate != null
      ? Math.max(0, Math.round((Date.parse(lastDay) - Date.parse(peakDate)) / 86_400_000))
      : null;

  return {
    empty: false,
    pnl,
    pnlPct,
    high,
    low,
    peakDate,
    daysSincePeak,
    maxDDUsd,
    maxDDPct: sanePct(maxDDPctRaw),
    currentDDUsd: last.drawdownUsd,
    currentDDPct: sanePct(last.drawdownPct),
    bestDay,
    worstDay,
    up,
    down,
    pctWinDays,
    closeDays: closeDaySet.size,
    tradeCount,
    recoveryFactor,
    firstDate: first.date,
    lastDate: last.date,
  };
}
