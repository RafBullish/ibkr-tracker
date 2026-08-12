// ═══════════════════════════════════════════════════════════════
//  NLV BACKFILL — l'histoire reconstituée (FIX-NLV, v1.0.1 brique 1).
//  PUR, sans React, LECTURE SEULE : zéro migration, zéro écriture.
//
//  Pourquoi : settings.dailySnapshots n'accumule qu'un point par jour
//  de VISITE du Dashboard (par navigateur/origine) et n'est jamais
//  reconstruit par l'import CSV/Flex — un compte riche de plusieurs
//  mois de clôtures peut n'avoir qu'UN snapshot. Le graphe regardait
//  au mauvais endroit quand le journal est vide : les données du
//  compte (clôtures, flux) sont intactes dans le store.
//
//  Formule (décision architecte, jour par jour) :
//    C0 (capital initial implicite)
//       = NLV_live − unrealized_live − Σ(pnl réalisés, tous)
//                                    − Σ(flux nets, tous)
//      (clampé à 0 si négatif — signalé via c0Clamped)
//    reconstruit(d) = C0 + cumFlux(d) + cumRéalisé(d)
//
//  Sources = les MÊMES chemins que le reste du Héros 1 :
//    · flux : extractFundingFlows (USD signés, dépôts > 0) — la même
//      normalisation que les marqueurs « apport » et le flow-neutral ;
//    · réalisé par date : tradePnlUsd(t, liveRate) groupé sur t.do —
//      la même logique que useDailyPnL.
//
//  Couverture : UNIQUEMENT les dates antérieures au premier point réel
//  (la reconstitution s'arrête la VEILLE de firstRealDate) ; un point
//  réel PRIME toujours. Les points portent { synth: true } — le Héros 1
//  affiche la note d'honnêteté « historique reconstitué » quand la
//  fenêtre en contient.
// ═══════════════════════════════════════════════════════════════

import { extractFundingFlows } from './metrics/equityTimeline';
import { tradePnlUsd } from './calculations';

const DAY_MS = 86_400_000;

const dayKey = (v) => (typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : null);

/**
 * Reconstitue la série NLV quotidienne AVANT le premier point réel.
 *
 * @param {Object} args
 * @param {Array}  args.cashFlows      state.cashFlows (forme tracker)
 * @param {Array}  args.closedTrades   state.closedTrades (forme tracker)
 * @param {number|null} args.liveNlv   NLV live USD (ancre du C0)
 * @param {number} args.liveRate       CHF par USD (conversion des flux CHF)
 * @param {number|null} args.unrealizedLive  P&L latent live USD
 * @param {string|null} args.firstRealDate   date ISO du premier point réel
 * @returns {{days: Array<{date:string, nlv:number, synth:true}>,
 *            c0: number|null, c0Clamped: boolean}}
 */
export function buildBackfillDays({
  cashFlows,
  closedTrades,
  liveNlv,
  liveRate = 1,
  unrealizedLive = null,
  firstRealDate,
}) {
  const empty = { days: [], c0: null, c0Clamped: false };
  // Sans ancre live ou sans premier point réel, C0 est incalculable —
  // on ne reconstitue rien (comportement v1.0.0 conservé).
  if (!Number.isFinite(liveNlv) || liveNlv <= 0) return empty;
  const firstReal = dayKey(firstRealDate);
  if (!firstReal) return empty;

  const flows = extractFundingFlows(cashFlows, liveRate)
    .map((f) => ({ date: dayKey(f.date), netUsd: f.netUsd }))
    .filter((f) => f.date != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const closes = [];
  for (const t of Array.isArray(closedTrades) ? closedTrades : []) {
    const d = dayKey(t?.do);
    if (!d) continue;
    const pnl = tradePnlUsd(t, liveRate);
    if (Number.isFinite(pnl)) closes.push({ date: d, pnl });
  }
  closes.sort((a, b) => a.date.localeCompare(b.date));

  // Zéro trade ET zéro flux → rien à raconter (série vide, inchangé).
  if (flows.length === 0 && closes.length === 0) return empty;

  const sumFlux = flows.reduce((a, f) => a + f.netUsd, 0);
  const sumReal = closes.reduce((a, c) => a + c.pnl, 0);
  const unreal = Number.isFinite(unrealizedLive) ? unrealizedLive : 0;
  let c0 = liveNlv - unreal - sumReal - sumFlux;
  const c0Clamped = c0 < 0;
  if (c0Clamped) c0 = 0;

  const firstEvent = [flows[0]?.date, closes[0]?.date].filter(Boolean).sort()[0];
  const startMs = Date.parse(firstEvent);
  const endMs = Date.parse(firstReal) - DAY_MS; // la VEILLE du premier réel
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
    return { days: [], c0, c0Clamped };
  }

  const days = [];
  let fi = 0;
  let ci = 0;
  let cumFlux = 0;
  let cumReal = 0;
  for (let t = startMs; t <= endMs; t += DAY_MS) {
    const d = new Date(t).toISOString().slice(0, 10);
    while (fi < flows.length && flows[fi].date <= d) cumFlux += flows[fi++].netUsd;
    while (ci < closes.length && closes[ci].date <= d) cumReal += closes[ci++].pnl;
    days.push({ date: d, nlv: c0 + cumFlux + cumReal, synth: true });
  }
  return { days, c0, c0Clamped };
}
