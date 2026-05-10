// ═══════════════════════════════════════════════════════════════
//  STATUS BADGE v3.0 « Midnight Terminal »
//
//  Atomic badge for every status in the app. 12 variants per brief
//  §10 covering mode, API, position state.
//
//  variant:
//    live | paper | real | offline | stale
//    open | closed | expired
//    pass | fail | warn | na
//
//  Optional `pulse` adds an animated dot on the left (used for live
//  streaming indicators). Optional `size`=xs|sm. A label override is
//  possible via the `label` prop, otherwise the French default is
//  used.
// ═══════════════════════════════════════════════════════════════

import { forwardRef } from 'react';

const DEFAULTS = {
  live: { label: 'LIVE', tone: 'profit', dot: true },
  paper: { label: 'PAPER', tone: 'warning', dot: false },
  real: { label: 'REAL', tone: 'accent', dot: false },
  offline: { label: 'OFFLINE', tone: 'neutral', dot: false },
  stale: { label: 'DIFFÉRÉ', tone: 'warning', dot: false },
  open: { label: 'OUVERT', tone: 'accent', dot: false },
  closed: { label: 'FERMÉ', tone: 'neutral', dot: false },
  expired: { label: 'EXPIRÉ', tone: 'loss', dot: false },
  pass: { label: 'PASS', tone: 'profit', dot: false },
  fail: { label: 'FAIL', tone: 'loss', dot: false },
  warn: { label: 'WARN', tone: 'warning', dot: false },
  na: { label: 'N/A', tone: 'neutral', dot: false },
  // Tone-aliased variants — let callers pass `accent` / `profit` / `loss`
  // / `neutral` directly when the badge isn't tied to a domain status.
  // Without these, callers fell through to `na` and rendered grey.
  accent: { label: 'ACCENT', tone: 'accent', dot: false },
  profit: { label: 'PROFIT', tone: 'profit', dot: false },
  loss: { label: 'LOSS', tone: 'loss', dot: false },
  neutral: { label: 'NEUTRAL', tone: 'neutral', dot: false },
};

const StatusBadge = forwardRef(function StatusBadge(
  { variant = 'na', label, pulse, size = 'sm', className, ...rest },
  ref
) {
  const spec = DEFAULTS[variant] || DEFAULTS.na;
  const text = label ?? spec.label;
  const showDot = (pulse ?? spec.dot) === true;

  const cls = [
    'status-badge',
    `status-badge--${spec.tone}`,
    `status-badge--${size}`,
    showDot && 'status-badge--with-dot',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      ref={ref}
      className={cls}
      data-variant={variant}
      role="status"
      aria-label={`Statut : ${text}`}
      {...rest}
    >
      {showDot && <span className="status-badge__dot" aria-hidden="true" />}
      <span className="status-badge__label">{text}</span>
    </span>
  );
});

export default StatusBadge;
