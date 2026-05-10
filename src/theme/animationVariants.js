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
