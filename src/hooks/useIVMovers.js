// ═══════════════════════════════════════════════════════════════
//  useIVMovers v4 brick 7 — empty stub côté dashboard
//
//  Pas de feed IV rank historique dans le store. Le module rend
//  son empty state sur /dashboard. /__playground utilise
//  fixture.ivRankMovers directement.
//
//  Migration ultérieure : on pourrait calculer IVR localement
//  depuis l'historique IV des tickers de la watchlist (rolling
//  52-semaines), à brancher quand on aura l'historique IV.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';

export function useIVMovers() {
  return useMemo(() => [], []);
}

export default useIVMovers;
