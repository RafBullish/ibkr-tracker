// ═══════════════════════════════════════════════════════════════
//  useGreeksAggregate v4 brick 5 — async fetch + sign-aware aggregate
//
//  Fetch les greeks Yahoo via getGreeksForAllPositions (existant),
//  puis aggrège via aggregateGreeks (brick 5 nouveau, sign-aware).
//
//  Ordre des states :
//    initial         → { loading: true, ... null/0 }
//    fetch failed    → { loading: false, error: <err> }
//    fetch ok        → { loading: false, ...aggregate }
//
//  Re-fetch quand openPositions change. AbortController via
//  cancelled flag — pas de race-condition sur unmount/refetch.
//
//  Ce hook n'est PAS utilisé par /__playground qui passe
//  fixture.greeksMap directement à aggregateGreeks() inline.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState, useMemo } from 'react';
import { useOpenPositions } from '../store/useStore';
import { getGreeksForAllPositions } from '../utils/greeksApi';
import { aggregateGreeks } from '../utils/greeks';

const EMPTY_AGGREGATE = {
  sumDelta: 0,
  sumGamma: 0,
  sumTheta: 0,
  sumVega: 0,
  notionalDelta: 0,
  thetaDaily: 0,
  vegaPer1Pct: 0,
  optionsCount: 0,
  positions: [],
};

export function useGreeksAggregate() {
  const openPositions = useOpenPositions();
  const [greeksMap, setGreeksMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Pas de setState synchrone dans le body de l'effet (lint rule
    // react-hooks/set-state-in-effect). On laisse loading=true depuis
    // l'initial useState, et on toggle uniquement dans les callbacks
    // .then / .catch — donc le hook montre stale data pendant un
    // refetch, fresh data dès résolution. Acceptable UX-wise sur un
    // dashboard temps-réel.
    let cancelled = false;
    getGreeksForAllPositions(openPositions || [])
      .then((map) => {
        if (cancelled) return;
        setGreeksMap(map);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setGreeksMap(new Map()); // empty map → aggregate retourne empty
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [openPositions]);

  return useMemo(() => {
    const base = greeksMap ? aggregateGreeks(openPositions, greeksMap) : EMPTY_AGGREGATE;
    // Expose la map brute pour les consumers qui veulent projeter
    // par-position (LivePositions Dashboard, Greeks/Positions tables).
    // Une seule source de vérité ; greeksApi memoize en interne.
    return { ...base, loading, error, greeksMap: greeksMap || null };
  }, [openPositions, greeksMap, loading, error]);
}

export default useGreeksAggregate;
