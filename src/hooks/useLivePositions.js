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

  return {
    id: pos.id,
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
    delta: pos.delta ?? null, // sidecar live greek si dispo
    theta: pos.theta ?? null,
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
 * Brick 6 simplification : totalNotional = Σ |mark × qty × mul|,
 * totalMaxRisk = Σ |unrealDollar quand < 0| (current open-loss).
 * Le « max risk » théorique (assignation puts ITM, etc.) sera
 * traité dans une brick risk ultérieure — ce qu'on affiche ici
 * est la perte ouverte courante en magnitude négative.
 */
function aggregate(rows) {
  let totalNotional = 0;
  let totalMaxRisk = 0;
  for (const r of rows) {
    const mul = r.type === 'STK' ? 1 : 100;
    totalNotional += Math.abs(r.mark * r.qty * mul);
    if (r.unrealDollar < 0) totalMaxRisk += r.unrealDollar;
  }
  return {
    totalNotional: Number(totalNotional.toFixed(2)),
    totalMaxRisk: Number(totalMaxRisk.toFixed(2)),
  };
}

/**
 * @param {Object} [options]
 * @param {Date}   [options.now]       reference for DTE / daysHeld
 * @param {Array}  [options.earnings]  earnings calendar for EARN alert
 */
export function useLivePositions(options = {}) {
  const openPositions = useOpenPositions();
  const metaVersion = useSniperMetaVersion();

  return useMemo(() => {
    // Deliberately reference metaVersion so ESLint sees the dep used.
    // buildRow → readSniperMeta side-effect makes the dep meaningful
    // even though the value itself isn't computed with.
    void metaVersion;
    const ctx = { now: options.now, earnings: options.earnings };
    const rows = (openPositions || []).map((p) => buildRow(p, ctx));
    const { totalNotional, totalMaxRisk } = aggregate(rows);
    return {
      positions: rows,
      totalNotional,
      totalMaxRisk,
      count: rows.length,
    };
  }, [openPositions, options.now, options.earnings, metaVersion]);
}

/**
 * Variante pure pour /__playground (pas de hook React).
 * Mêmes transforms, accept openPositions + earnings en arg.
 */
export function buildLivePositions(openPositions, options = {}) {
  const ctx = { now: options.now, earnings: options.earnings };
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
