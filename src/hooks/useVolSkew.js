// ═══════════════════════════════════════════════════════════════
//  useVolSkew v4 brick 8 — stub real-store
//
//  Brick 8 : retourne null. Le calcul du skew SPX 25Δ + ATM IV +
//  VVIX nécessite un fetch options chain SPX par expiration. À
//  brancher dans une brick data source dédiée plus tard.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';

export function useVolSkew() {
  return useMemo(() => null, []);
}

export default useVolSkew;
