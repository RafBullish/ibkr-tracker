// ═══════════════════════════════════════════════════════════════
//  useLiveTheme v4 brick 11 — re-render charts on theme switch
//
//  Le snapshot T exporté par src/theme/tokens.js est figé au load
//  du module. Sur un theme switch (applyTheme dispatche
//  ibkr:theme-change), les composants CSS-driven (qui lisent
//  var(--profit) etc.) re-paint instantanément, mais les charts
//  Recharts qui passent T.profit en prop `stroke=...` restent
//  stale jusqu'au reload.
//
//  Ce hook écoute l'event ibkr:theme-change et retourne le
//  snapshot frais des tokens JS — le composant chart re-render
//  automatiquement sur le changement de référence.
//
//  Default value au mount : getThemeTokens(getCurrentThemeKey())
//  équivalent à T mais évalué AU MOMENT du mount du chart (pas
//  au load du module). Robuste si le theme a été changé avant le
//  mount du chart (ex. brick lazy-loaded).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { getCurrentThemeKey, getThemeTokens } from '../theme/tokens';

export function useLiveTheme() {
  const [tokens, setTokens] = useState(() => getThemeTokens(getCurrentThemeKey()));

  useEffect(() => {
    const handler = (e) => {
      const key = e?.detail?.key;
      if (!key) return;
      setTokens(getThemeTokens(key));
    };
    window.addEventListener('ibkr:theme-change', handler);
    return () => window.removeEventListener('ibkr:theme-change', handler);
  }, []);

  return tokens;
}

export default useLiveTheme;
