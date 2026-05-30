// ═══════════════════════════════════════════════════════════════
//  useLivePositions v4 brick 6 + v5 Sprint 1.3 — store → 19-col rows
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
//  v5 Sprint 1.3 : nextGate (objet { gateType, daysToTrigger, dte })
//  est calculé par computeNextGate(pos, now). Remplace l'ancien
//  champ `gates` (array) qui dépendait de la fixture Sniper.
//
//  Greeks live (delta / theta / ivr live) toujours hors scope ici —
//  les colonnes Δ et IVR rendent les snapshots from sidecar fixture
//  ou '—' si absents (cf. CANONICAL_GUIDE alignment note #6).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { useOpenPositions } from '../store/useStore';
import { toFloat } from '../utils/math';
import { calculateOpenPositionPnl } from '../utils/calculations';
import {
  unrealizedPnlUsd,
  unrealizedPnlPct,
  dteFromExp,
  daysHeld,
  detectAlert,
  deriveEdgeTier,
  computeNextGate,
} from '../utils/positions';
import { readSniperMeta } from '../utils/sniperMeta';

// v5 Sprint 2.2 : sniper meta sidecar can change between renders when
// the user tags a position via SniperMetaEditor. We listen for the
// `qc:sniperMeta:change` window event and bump a counter so useMemo
// recomputes rows. Decoupled from React state so any consumer can
// subscribe without prop drilling.
function useSniperMetaVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => setVersion((v) => v + 1);
    window.addEventListener('qc:sniperMeta:change', handler);
    return () => window.removeEventListener('qc:sniperMeta:change', handler);
  }, []);
  return version;
}

function buildRow(pos, context) {
  const isStock = pos.as === 'Action';
  const dte = isStock ? null : dteFromExp(pos.ex, context.now);
  const days = daysHeld(pos.di, context.now);
  const unrealDollar = unrealizedPnlUsd(pos);
  const unrealPct = unrealizedPnlPct(pos);
  // B5-3 — capital engagé (prime payée + frais) en USD. Source canonique :
  // calculateOpenPositionPnl. liveRate=1 OK ici, costBasisUsd ne dépend
  // pas du taux (pi × mul × qty ± fi en USD pur).
  const { costBasisUsd } = calculateOpenPositionPnl(pos, 1);

  // Sidecar lookup. Sprint 1.3 ne livre PAS le tagging UI : la
  // sidecar reste vide pour les positions du vrai compte. La
  // fixture Sniper d'origine continue à porter edgeTier/capitalTier
  // sur le shape (rétro-compat fixture). Priorité de résolution :
  //   sidecar override > pos.<field> (fixture) > deriveEdgeTier(ivr)
  const sidecar = readSniperMeta(pos.id);
  const ivrSnapshot = Number.isFinite(pos.ivr)
    ? pos.ivr
    : Number.isFinite(pos.ivRankAtEntry)
      ? pos.ivRankAtEntry
      : null;
  const edgeTier = sidecar?.edgeTier ?? pos.edgeTier ?? deriveEdgeTier(ivrSnapshot) ?? null;
  const capitalTier = sidecar?.capitalTier ?? pos.capitalTier ?? null;
  const betaSPY = sidecar?.betaSPY ?? null;

  // Sprint 1.3 : nextGate computed from expiry alone (SL35 / DTE45).
  // EARN-J2 / EARN+J30 / TP / TR will land here progressively.
  const nextGate = isStock ? null : computeNextGate(pos, context.now);

  const alert = detectAlert(pos, {
    now: context.now,
    earnings: context.earnings,
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
    ivr: ivrSnapshot,
    edgeTier,
    capitalTier,
    betaSPY,
    nextGate,
    // gates kept for legacy fixture compat (some test rendering
    // paths still iterate this array). New code uses nextGate.
    gates: Array.isArray(pos.gates) ? pos.gates : [],
    daysHeld: days,
    spark7d: Array.isArray(pos.spark7d) ? pos.spark7d : null,
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
  let totalNotional = 0;
  let totalMaxRisk = 0;
  for (const r of rows) {
    const mul = r.type === 'STK' ? 1 : 100;
    totalNotional += Math.abs(r.mark * r.qty * mul);
    if (Number.isFinite(r.costBasisUsd)) totalMaxRisk -= r.costBasisUsd;
  }
  return {
    totalNotional: Number(totalNotional.toFixed(2)),
    totalMaxRisk: Number(totalMaxRisk.toFixed(2)),
  };
}

/**
 * @param {Object} [options]
 * @param {Date}   [options.now]        reference for DTE / daysHeld
 * @param {Array}  [options.earnings]   earnings calendar for EARN alert
 * @param {Map}    [options.greeksMap]  greeks par position id (single source
 *                                      of truth de greeksApi). Si absent,
 *                                      les colonnes Δ/Θ tombent sur
 *                                      pos.delta/pos.theta legacy (fixture).
 */
export function useLivePositions(options = {}) {
  const openPositions = useOpenPositions();
  const metaVersion = useSniperMetaVersion();

  return useMemo(() => {
    // Deliberately reference metaVersion so ESLint sees the dep used.
    // buildRow → readSniperMeta side-effect makes the dep meaningful
    // even though the value itself isn't computed with.
    void metaVersion;
    const ctx = {
      now: options.now,
      earnings: options.earnings,
      greeksMap: options.greeksMap,
    };
    const rows = (openPositions || []).map((p) => buildRow(p, ctx));
    const { totalNotional, totalMaxRisk } = aggregate(rows);
    return {
      positions: rows,
      totalNotional,
      totalMaxRisk,
      count: rows.length,
    };
  }, [openPositions, options.now, options.earnings, options.greeksMap, metaVersion]);
}

/**
 * Variante pure pour /__playground (pas de hook React).
 * Mêmes transforms, accept openPositions + earnings + greeksMap en arg.
 */
export function buildLivePositions(openPositions, options = {}) {
  const ctx = {
    now: options.now,
    earnings: options.earnings,
    greeksMap: options.greeksMap,
  };
  const rows = (openPositions || []).map((p) => buildRow(p, ctx));
  const { totalNotional, totalMaxRisk } = aggregate(rows);
  return {
    positions: rows,
    totalNotional,
    totalMaxRisk,
    count: rows.length,
  };
}

export default useLivePositions;
