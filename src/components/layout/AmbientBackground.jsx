// ═══════════════════════════════════════════════════════════════
//  AMBIENT BACKGROUND v3.0
//  Fixed full-viewport background with two radial orbs that float
//  subtly. Colors come from --orb-violet / --orb-blue tokens so
//  both themes render correctly (stronger in midnight, near
//  subliminal in daylight).
//  Animation halts under prefers-reduced-motion (handled in CSS).
// ═══════════════════════════════════════════════════════════════

export default function AmbientBackground() {
  return <div className="app-ambient-bg" aria-hidden="true" />;
}
