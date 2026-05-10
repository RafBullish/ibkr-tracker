// ═══════════════════════════════════════════════════════════════
//  useAlertsFeed v4 brick 8 — stub real-store
//
//  Brick 8 : retourne []. Le stream alerts nécessite un système
//  d'événements global (gate fires, fills, sync events, errors)
//  qui sera bâti dans une brick alerts engine dédiée.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';

export function useAlertsFeed() {
  return useMemo(() => [], []);
}

export default useAlertsFeed;
