// ═══════════════════════════════════════════════════════════════
//  BANDE DÉCISION (1.F) — parts partagées.
//
//  TickValue : micro-mouvement au changement de valeur LIVE — fondu +
//  translation 2 px, 180 ms (repris du pattern DeckValue historique).
//  Remonte UNIQUEMENT quand le texte affiché change (key={text}) ;
//  coupé proprement sous prefers-reduced-motion. LazyMotion (features
//  domAnimation) est déjà monté à la racine (App.jsx) → composant `m.`
//  allégé, aucune nouvelle dépendance.
// ═══════════════════════════════════════════════════════════════

import { m, useReducedMotion } from 'framer-motion';

export function TickValue({ text, className }) {
  const reduced = useReducedMotion();
  if (text == null) return null;
  if (reduced) return <span className={className}>{text}</span>;
  return (
    <m.span
      key={text}
      className={className}
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {text}
    </m.span>
  );
}
