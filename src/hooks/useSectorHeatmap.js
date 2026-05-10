// ═══════════════════════════════════════════════════════════════
//  useSectorHeatmap v4 brick 7 — empty stub côté dashboard
//
//  Pas de feed sector data dans le store actuel. Le module rend
//  son empty state sur /dashboard. /__playground utilise
//  fixture.sectors directement.
//
//  Migration ultérieure : pull depuis API gratuite (Finnhub
//  /sector-performance ou Yahoo) ou agréger soi-même les tickers
//  par GICS pour produire perfDay localement.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';

export function useSectorHeatmap() {
  return useMemo(() => [], []);
}

export default useSectorHeatmap;
