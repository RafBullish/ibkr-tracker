// ═══════════════════════════════════════════════════════════════
//  useLivePositions v4 brick 6 + v5 Sprint 1.3 — store → rows enrichies
//  (É3.2 : slots fantômes ivr/betaSPY/spark7d retirés des rows)
//
//  Transforme openPositions du store en rows enrichies pour
//  <LivePositions />. Trois sources d'enrichissement :
//
//  1. Position fields directement (pi, pc, ct, ex, di, …)
//  2. Sidecar localStorage `qc:sniperMeta:{positionId}` (Sprint 1.3) :
//     edgeTier (E0..E4) et capitalTier (C1..C5) tagués manuellement
//     via Sprint 2 UI. Override la dérivation auto.
//  3. Auto-derivation d'edgeTier depuis ivRankAtEntry quand le
//     sidecar ne porte pas d'override explicite (formule Sniper
//     OTM v1.0 Finale : E0 IVR<25, E1 25-40, E2 40-55, E3 55-70,
//     E4 ≥70).
//
//  É3 §4.2.1 : le champ nextGate (computeNextGate, vocabulaire propre
//  « SL35 ARMED ») est MORT — la colonne GATE de LivePositions lit le
//  classifieur unique deriveAttention via useAttentionMap.
//
//  Greeks live (delta / theta / ivr live) toujours hors scope ici —
//  les colonnes Δ et IVR rendent les snapshots from sidecar fixture
//  ou '—' si absents (cf. CANONICAL_GUIDE alignment note #6).
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useOpenPositions } from '../store/useStore';
import { toFloat } from '../utils/math';
import { calculateOpenPositionPnl } from '../utils/calculations';
import {
  unrealizedPnlUsd,
  unrealizedPnlPct,
  dteFromExp,
  isExpired,
  daysHeld,
  detectAlert,
} from '../utils/positions';

// É4-b — le sidecar `qc:sniperMeta` (edgeTier/capitalTier) + l'écouteur
// `useSniperMetaVersion` sont MORTS avec la doctrine tier V1 (éditeur retiré).

function buildRow(pos, context) {
  const isStock = pos.as === 'Action';
  const dte = isStock ? null : dteFromExp(pos.ex, context.now);
  // É3 §4.2.6 — une option expirée s'affiche comme telle (« EXP »),
  // jamais un DTE négatif ni un « 0 » ambigu.
  const expired = isStock ? false : isExpired(pos.ex, context.now);
  const days = daysHeld(pos.di, context.now);
  const unrealDollar = unrealizedPnlUsd(pos);
  const unrealPct = unrealizedPnlPct(pos);
  // B5-3 — capital engagé (prime payée + frais) en USD. Source canonique :
  // calculateOpenPositionPnl. liveRate=1 OK ici, costBasisUsd ne dépend
  // pas du taux (pi × mul × qty ± fi en USD pur).
  const { costBasisUsd } = calculateOpenPositionPnl(pos, 1);

  // ivrSnapshot reste un INTERNE : il alimente detectAlert. La colonne IVR
  // est morte (import réel écrit toujours ivRankAtEntry: null). É4-b —
  // edgeTier/capitalTier + sidecar retirés (doctrine tier V1 morte).
  const ivrSnapshot = Number.isFinite(pos.ivr)
    ? pos.ivr
    : Number.isFinite(pos.ivRankAtEntry)
      ? pos.ivRankAtEntry
      : null;

  // Q-B — plus d'earnings ici : la branche EARN de detectAlert est morte
  // (P4 tire de position.earningsDate, câblage Q-C). Finnhub reste au calendrier.
  const alert = detectAlert(pos, {
    now: context.now,
    ivr: ivrSnapshot,
  });

  // Greeks projetés depuis greeksMap (single source of truth, calculé
  // par greeksApi/positionGreeks avec cascade σ a→b→c). Stock = pas de
  // greek. Fallback sur pos.delta/theta legacy si pas de map (e.g. avant
  // que le fetch async ait résolu).
  //
  // Convention LivePositions : delta per-share, theta per-share-per-DAY.
  // greeksMap stocke per-share-per-YEAR ; on /365 ici.
  const greeks = !isStock ? context.greeksMap?.get(pos.id) : null;
  const delta =
    greeks?.delta != null ? greeks.delta : (pos.delta != null ? pos.delta : null);
  const theta =
    greeks?.theta != null ? greeks.theta / 365 : (pos.theta != null ? pos.theta : null);
  const ivEstimated = !!(greeks?.ivEstimated);
  const greeksSource = greeks?.source ?? null;

  return {
    // B5.3 — id défensif : si pos.id manque (positions importées hors
    // migration v3→v4), génère un id déterministe basé sur les champs
    // identifiants. Empêche les clés React dupliquées dans LivePositions.
    id:
      pos.id ||
      `${pos.tk || 'unknown'}-${pos.ex || ''}-${pos.st || ''}-${pos.di || ''}-${pos.ty || ''}`,
    ticker: pos.tk,
    type: isStock ? 'STK' : pos.ty,
    dir: pos.dir,
    strike: isStock ? null : pos.st || null,
    exp: isStock ? null : pos.ex || null,
    dte,
    expired,
    qty: toFloat(pos.ct) || 0,
    entry: toFloat(pos.pi) || 0,
    mark: toFloat(pos.pc) || 0,
    unrealDollar,
    unrealPct,
    costBasisUsd,
    delta,
    theta,
    ivEstimated,
    greeksSource,
    daysHeld: days,
    // É3.2 — ivr, betaSPY et spark7d ne sont plus exposés : slots morts
    // (aucun producteur réel ; betaSPY vit dans le sidecar, lu par
    // SniperMetaEditor directement).
    alert,
  };
}

/**
 * totalNotional = Σ |mark × qty × mul|.
 *
 * B5-3 — totalMaxRisk = perte potentielle MAXIMALE de chaque position.
 * Pour la stratégie Sniper OTM long-premium de Rafael, le risque max
 * d'un long call/put = 100 % de la prime payée (= costBasisUsd).
 * Convention : Max Risk affiché en négatif (perte). Σ négative sur
 * positions longues.
 *
 * Pre-B5 ce champ sommait `unrealDollar quand < 0` (perte latente
 * courante) — fluctuant et sans rapport avec le risque effectif d'un
 * long-premium. Le label "Σ MAX RISK" parlait d'un truc, le calcul
 * en faisait un autre. Σ Unreal Loss reste lisible ailleurs via Σ UNREAL.
 */
function aggregate(rows) {
  // É4-b — `totalNotional` (Σ|mark×qty×mul|) RETIRÉ : même mensonge mark que
  // la cellule NOTIONNEL du deck (É4-a), jamais le strike (§8). Plus aucun
  // consommateur ne l'affiche.
  let totalMaxRisk = 0;
  for (const r of rows) {
    if (Number.isFinite(r.costBasisUsd)) totalMaxRisk -= r.costBasisUsd;
  }
  return {
    totalMaxRisk: Number(totalMaxRisk.toFixed(2)),
  };
}

/**
 * @param {Object} [options]
 * @param {Date}   [options.now]        reference for DTE / daysHeld
 * @param {Map}    [options.greeksMap]  greeks par position id (single source
 *                                      of truth de greeksApi). Si absent,
 *                                      les colonnes Δ/Θ tombent sur
 *                                      pos.delta/pos.theta legacy (fixture).
 */
export function useLivePositions(options = {}) {
  const openPositions = useOpenPositions();

  return useMemo(() => {
    const ctx = {
      now: options.now,
      greeksMap: options.greeksMap,
    };
    const rows = (openPositions || []).map((p) => buildRow(p, ctx));
    const { totalMaxRisk } = aggregate(rows);
    return {
      positions: rows,
      totalMaxRisk,
      count: rows.length,
    };
  }, [openPositions, options.now, options.greeksMap]);
}

/**
 * Variante pure pour /__playground (pas de hook React).
 * Mêmes transforms, accept openPositions + greeksMap en arg.
 */
export function buildLivePositions(openPositions, options = {}) {
  const ctx = {
    now: options.now,
    greeksMap: options.greeksMap,
  };
  const rows = (openPositions || []).map((p) => buildRow(p, ctx));
  const { totalMaxRisk } = aggregate(rows);
  return {
    positions: rows,
    totalMaxRisk,
    count: rows.length,
  };
}

export default useLivePositions;
