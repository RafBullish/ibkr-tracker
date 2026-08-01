// ═══════════════════════════════════════════════════════════════
//  Shared Framer Motion variants for v3 « Midnight Terminal ».
//  Extracted from 11 page files that all duplicated the same
//  page-stagger + tile-spring choreography.
// ═══════════════════════════════════════════════════════════════

/**
 * Container fade-in that staggers its tile children.
 * Use as the outermost <motion.div variants={CONTAINER_VARIANTS}>.
 */
export const CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

/**
 * Tile fade-up + scale-pop. Spring 300/24 matches brief §11.
 * Use on each direct child of CONTAINER_VARIANTS.
 */
export const TILE_VARIANTS = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
};

/**
 * Stagger de montage v1.0 (recette 1.F §4.6) — fondu + montée 8 px,
 * 150 ms, 30 ms par étage, UNE FOIS au mount. Utilisé par les pages
 * refondues au langage cockpit (2.A : Positions · History). Les pages
 * legacy gardent CONTAINER/TILE_VARIANTS (spring) jusqu'à leur brique.
 */
export const RISE_CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
};

export const RISE_TILE_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.15, ease: 'easeOut' },
  },
};
