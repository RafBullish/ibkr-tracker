// ═══════════════════════════════════════════════════════════════
//  OBSIDIENNE — source unique des constantes charts (v1.0 · 1.A)
//
//  Tout chart de l'app consomme ces constantes : trait, couleurs,
//  ticks, curseur. Valeurs MIDNIGHT (daylight hors périmètre v1.0).
//  Le tooltip unique vit dans ObsidienneTooltip.jsx ; les styles
//  (pulse LIVE, overrides) dans src/styles/obsidienne-charts.css.
//
//  Fichier .js volontairement SANS JSX (Vite ne parse pas le JSX
//  hors .jsx) — le helper de dégradé expose les stops en data, le
//  consommateur les mappe sur <linearGradient>/<stop> dans ses defs.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';

// Même pile que --qc-font-num (canonical.css) — les ticks SVG Recharts
// ne peuvent pas lire les custom properties CSS via props JSX.
const FONT_NUM =
  "'IBM Plex Sans Condensed', 'Arial Narrow', 'Inter Tight', ui-sans-serif, system-ui, sans-serif";

export const OBS = {
  // Trait de série : 1.5 arrondi, partout.
  stroke: {
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },

  // Couleurs midnight. up/down = P&L d'argent réel UNIQUEMENT
  // (loi de couleur) ; hero = la série élue de l'écran (une seule).
  color: {
    hero: '#FFA028',
    context: '#9A9AA2',
    up: '#10B981',
    down: '#EF4444',
    grid: 'rgba(255,255,255,.04)',
    cursor: 'rgba(255,255,255,.16)',
    tick: '#8A8A92',
  },

  // Props ticks XAxis/YAxis Recharts — fontSize 14 = cap data-viz S2.
  tick: {
    fill: '#8A8A92',
    fontSize: 14,
    fontFamily: FONT_NUM,
    style: { fontVariantNumeric: 'tabular-nums' },
  },

  // Curseur de survol (Tooltip cursor).
  cursor: {
    stroke: 'rgba(255,255,255,.16)',
    strokeWidth: 1,
    strokeDasharray: '3 3',
  },
};

/**
 * Dégradé d'aire Obsidienne — stops d'un linearGradient VERTICAL
 * (x1=0 y1=0 x2=0 y2=1) : couleur de série 12 % → 0. Aucun fill >16 %.
 *
 * Usage (dans les <defs> du chart) :
 *   <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
 *     {obsAreaGradientStops(color).map((s) => <stop key={s.offset} {...s} />)}
 *   </linearGradient>
 */
export function obsAreaGradientStops(color) {
  return [
    { offset: '0%', stopColor: color, stopOpacity: 0.12 },
    { offset: '100%', stopColor: color, stopOpacity: 0 },
  ];
}

/**
 * Animation AU PREMIER MONTAGE uniquement — jamais au refresh de
 * données ; false sous prefers-reduced-motion.
 *
 * Retourne { isAnimationActive, animationDuration } à spreader sur les
 * séries Recharts. isAnimationActive retombe à false une fois la
 * fenêtre d'animation initiale écoulée → les mises à jour de data
 * suivantes ne ré-animent pas.
 */
export function useMountOnlyAnimation() {
  const [active, setActive] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(() => setActive(false), 450 + 150);
    return () => clearTimeout(t);
  }, [active]);

  return { isAnimationActive: active, animationDuration: 450 };
}
