// ═══════════════════════════════════════════════════════════════
//  useWatchlist v4 brick 7 — store-or-fixture wrapper
//
//  Brick 7 simplified : la persistence (add/remove ticker) n'est PAS
//  câblée. Le store n'a pas encore de slice 'watchlist' — donc en
//  attendant cette migration, ce hook retourne un tableau vide pour
//  /dashboard real-store. Le module Watchlist affichera son empty
//  state. /__playground utilise fixture.watchlist directement.
//
//  Une brick ultérieure (« Watchlist persistence ») ajoutera :
//    - une slice store qc:watchlist
//    - les reducer actions ADD_TICKER / REMOVE_TICKER
//    - la persistence localStorage avec debounce
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';

export function useWatchlist() {
  // Brick 7 : pas de slice store → tableau vide. Le composant est
  // déjà capable d'afficher l'empty state proprement.
  return useMemo(() => [], []);
}

export default useWatchlist;
