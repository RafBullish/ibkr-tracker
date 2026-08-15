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
//  É3.1 « vérité des chiffres » : % JOURS GAGNANTS = LA définition
//  unique de curveStats (jours avec clôture, signe du P&L net du jour,
//  verts+rouges=total) — identique au pied du Héros 2. L'ex-comptage
//  up/down des deltas NLV est MORT (46↑/19↓ ≠ J. CLÔTURE 63).
//  recovery = recoveryOf (module), J. CLÔTURE = joursGagnants.total.
//
//  D6(a) — garde du % de drawdown : si la base flow-neutral rend le %
//  dénué de sens (tête de série reconstituée à base quasi nulle →
//  |%| > 100, le « −169.2 % » du seed), on rend null → « — » honnête,
//  le montant $ reste.
// ═══════════════════════════════════════════════════════════════

import { sliceSeriesWindow } from './nlvSeries';
import { joursGagnants, recoveryOf } from './metrics/curveStats';
import { tradePnlUsd } from './calculations';

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
 * @param {number} [args.rate]        USD/CHF live (fallback tradePnlUsd)
 * @returns {Object} stats — { empty } si < 2 points dans la fenêtre
 */
export function deriveHeroWindowStats({ dailyFull, range = 'ALL', closedTrades = [], rate = 1 }) {
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
  for (let i = 1; i < win.length; i++) {
    const d = win[i].flowNeutral - win[i - 1].flowNeutral;
    if (bestDay == null || d > bestDay) bestDay = d;
    if (worstDay == null || d < worstDay) worstDay = d;
  }

  // Compteurs VRAIS sur les clôtures de la fenêtre. Clé jour = do || di
  // (même convention que useDailyPnL — une seule vérité de regroupement).
  const firstDay = dayKey(first.date);
  const lastDay = dayKey(last.date);
  let tradeCount = 0;
  const pnlByDay = new Map();
  for (const t of Array.isArray(closedTrades) ? closedTrades : []) {
    const d = dayKey(t?.do || t?.di);
    if (!d || d < firstDay || d > lastDay) continue;
    tradeCount++;
    const pnl = tradePnlUsd(t, rate);
    pnlByDay.set(d, (pnlByDay.get(d) || 0) + (Number.isFinite(pnl) ? pnl : 0));
  }

  // É3.1 — % JOURS GAGNANTS : LA définition unique (curveStats), la même
  // que le pied du Héros 2 : jours avec clôture, signe du P&L net du
  // jour. L'ancien comptage up/down des deltas NLV (71 % · 46↑/19↓,
  // incohérent avec J. CLÔTURE) est MORT.
  const jg = joursGagnants(
    Array.from(pnlByDay, ([date, dayPnl]) => ({ date, pnl: dayPnl }))
  );

  const recoveryFactor = recoveryOf(pnl, maxDDUsd > 0 ? maxDDUsd : null);

  return {
    empty: false,
    pnl,
    pnlPct,
    peak: high,
    high,
    low,
    maxDDUsd,
    maxDDPct: sanePct(maxDDPctRaw),
    currentDDUsd: last.drawdownUsd,
    currentDDPct: sanePct(last.drawdownPct),
    bestDay,
    worstDay,
    joursGagnants: jg,
    closeDays: jg.total,
    tradeCount,
    recoveryFactor,
    firstDate: first.date,
    lastDate: last.date,
  };
}
