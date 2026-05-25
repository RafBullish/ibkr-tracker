// ═══════════════════════════════════════════════════════════════
//  WIN RATE DONUT v3.0 — Premium SVG with glow & animated arc
//  A2b — accepts null / non-finite `winRate` (gated upstream by
//  decisive >= 10). Under the gate the donut paints in a muted
//  state and the centre label shows "—" instead of "0%".
// ═══════════════════════════════════════════════════════════════

import { useId } from 'react';
import T from '../../theme/tokens';

export default function WinRateDonut({ winRate = null, size = 56, strokeWidth = 5 }) {
  const id = useId();
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const isGated = typeof winRate !== 'number' || !Number.isFinite(winRate);
  const wr = isGated ? 0 : winRate;
  const winArc = (wr / 100) * circ;
  const cx = size / 2;
  const isGood = !isGated && wr >= 50;
  const muteColor = T.surface?.elevated || '#27272a';
  const accentColor = isGated
    ? muteColor
    : isGood
      ? T.profit || '#0ecb81'
      : T.loss || '#f6465d';

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg
        width={size}
        height={size}
        style={{
          transform: 'rotate(-90deg)',
          filter: isGated ? 'none' : `drop-shadow(0 0 4px ${accentColor}40)`,
        }}
      >
        <defs>
          <linearGradient id={`wr-win-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={accentColor} />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.65" />
          </linearGradient>
          <linearGradient id={`wr-loss-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={T.loss || '#f6465d'} stopOpacity="0.25" />
            <stop offset="100%" stopColor={T.loss || '#f6465d'} stopOpacity="0.15" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={muteColor}
          strokeWidth={strokeWidth}
        />
        {/* Win arc — gradient (only when not gated). */}
        {!isGated && (
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={`url(#wr-win-${id})`}
            strokeWidth={strokeWidth}
            strokeDasharray={`${winArc} ${circ}`}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1)',
            }}
          />
        )}
        {/* Loss arc */}
        {!isGated && wr < 100 && (
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={`url(#wr-loss-${id})`}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circ - winArc} ${circ}`}
            strokeDashoffset={-winArc}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: T.fonts?.mono || 'monospace',
          fontSize: Math.round(size * 0.24),
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: isGated ? T.text?.muted || '#71717a' : accentColor,
          textShadow: isGated ? 'none' : `0 0 8px ${accentColor}30`,
        }}
      >
        {isGated ? '—' : `${Math.round(wr)}%`}
      </div>
    </div>
  );
}
