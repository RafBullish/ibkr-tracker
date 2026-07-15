// ═══════════════════════════════════════════════════════════════
//  usePriceFlash — flash au tick (v1.0 · 1.B.3, qualité production)
//
//  Au changement de la valeur observée (prix d'un instrument),
//  retourne { dir: 'up'|'down', id } pendant ~700 ms, puis null.
//  `id` est un compteur monotone : le consommateur le pose en `key`
//  sur l'overlay de flash pour re-déclencher l'animation CSS à
//  chaque tick, même rapproché.
//
//  Styles associés : .tape-flash / .tape-flash--up / --down
//  (v4-shell.css) — aplat color-mix 10 % de --pnl-up/down qui
//  s'éteint en ~600 ms ease-out. Aucun glow. Désactivé sous
//  prefers-reduced-motion (ici même : aucun état émis).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';

export default function usePriceFlash(price) {
  const prevRef = useRef(price);
  const idRef = useRef(0);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = price;
    if (
      prev == null ||
      price == null ||
      !Number.isFinite(prev) ||
      !Number.isFinite(price) ||
      price === prev
    ) {
      return undefined;
    }
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return undefined;
    }
    idRef.current += 1;
    setFlash({ dir: price > prev ? 'up' : 'down', id: idRef.current });
    const t = setTimeout(() => setFlash(null), 700);
    return () => clearTimeout(t);
  }, [price]);

  return flash;
}
