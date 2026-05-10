// ═══════════════════════════════════════════════════════════════
//  useMarketInternals v4 brick 8 — stub real-store
//
//  Brick 8 : retourne null. Le module rend son empty state. Le
//  feed breadth (TICK/TRIN/ADD/VOLD/PCR) viendra dans une brick
//  data source dédiée (probablement via Yahoo Finance ou un
//  proxy sur /api/internals/*).
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';

export function useMarketInternals() {
  return useMemo(() => null, []);
}

export default useMarketInternals;
