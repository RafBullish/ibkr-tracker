// ═══════════════════════════════════════════════════════════════
//  useEarningsCalendar v4 brick 7 — adapter useCalendarFeeds
//
//  Brick 7 : le repo a déjà un hook useCalendarFeeds qui fetche
//  Finnhub via /api/finnhub/calendar. On re-shape sa sortie pour
//  matcher le format consommé par <EarningsCalendar /> :
//    { tk, date, time, estEps, estRev, ivCrushPct, dte }
//
//  Si Finnhub renvoie autre chose (champs manquants), on remplit
//  avec null — le composant gère les '—'. Pour l'instant, on
//  retourne juste un tableau vide pour /dashboard real (le hook
//  existant est lourd et async ; on le branchera proprement quand
//  on aura validé visuellement).
//
//  /__playground passe fixture.earnings directement, pas via ce hook.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';

export function useEarningsCalendar() {
  // Brick 7 : tableau vide en attendant le branchement Finnhub
  // côté dashboard. Le composant rend son empty state. Le filtre
  // par maxDte est appliqué côté composant (filterByDte).
  return useMemo(() => [], []);
}

export default useEarningsCalendar;
