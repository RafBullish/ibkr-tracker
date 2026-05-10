// ═══════════════════════════════════════════════════════════════
//  GLASS CARD v3.0 « Midnight Terminal »
//
//  Variants (brief §10):
//    - default  : neutral glass + subtle border
//    - elevated : stronger glass + shadow-md + thicker border
//    - subtle   : lowered opacity + subtle border (for nested cards)
//
//  Glow (brief §10):
//    - none | accent | profit | loss
//
//  Legacy variants preserved for pages not yet refactored:
//    - hero | compact | flush (mapped to equivalents under the hood)
//
//  `hover` enables a lift on hover (-2px translate + border-color
//  shift + shadow expansion). Respects prefers-reduced-motion via
//  Framer Motion's useReducedMotion.
// ═══════════════════════════════════════════════════════════════

import { forwardRef } from 'react';
import { m, useReducedMotion } from 'framer-motion';

const HOVER_SPRING = { type: 'spring', stiffness: 320, damping: 26, mass: 0.6 };
const TAP_SPRING = { type: 'spring', stiffness: 500, damping: 30 };

/** @type {Record<string, string>} */
const VARIANT_CLASS = {
  default: 'glass-card',
  elevated: 'glass-card glass-card--elevated',
  subtle: 'glass-card glass-card--subtle',
  // legacy variants (Aura v4/v5 naming)
  hero: 'glass-card glass-card-hero',
  compact: 'glass-card glass-card--compact',
  flush: 'glass-card glass-card--flush',
};

/** @type {Record<string, string>} */
const GLOW_CLASS = {
  none: '',
  accent: 'glass-card-glow-accent',
  profit: 'glass-card-glow-profit',
  loss: 'glass-card-glow-loss',
};

const GlassCard = forwardRef(function GlassCard(
  {
    children,
    style,
    onClick,
    hover = true,
    className,
    variant = 'default',
    glow = 'none',
    accent, // legacy top-border accent color
    as: Component,
    ...rest
  },
  ref
) {
  const reduced = useReducedMotion();

  const isHero = variant === 'hero';

  const cls = [
    VARIANT_CLASS[variant] || VARIANT_CLASS.default,
    GLOW_CLASS[glow] || '',
    accent === true && 'glass-card--accent',
    accent === 'profit' && 'glass-card--accent-profit',
    accent === 'loss' && 'glass-card--accent-loss',
    accent === 'warning' && 'glass-card--accent-warning',
    accent === 'info' && 'glass-card--accent-info',
    hover === false && 'no-hover',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const motionProps =
    hover && !reduced
      ? {
          whileHover: isHero
            ? { y: -4, scale: 1.002, transition: HOVER_SPRING }
            : { y: -2, transition: HOVER_SPRING },
          whileTap: onClick ? { scale: 0.985, transition: TAP_SPRING } : undefined,
        }
      : {};

  const MotionEl = Component ? m[Component] || m.div : m.div;

  return (
    <MotionEl ref={ref} className={cls} style={style} onClick={onClick} {...motionProps} {...rest}>
      {children}
    </MotionEl>
  );
});

export default GlassCard;
