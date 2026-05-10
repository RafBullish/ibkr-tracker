// ═══════════════════════════════════════════════════════════════
//  WIN RATE DONUT v3.0 — Premium SVG with glow & animated arc
// ═══════════════════════════════════════════════════════════════

import { useId } from 'react';
import T from '../../theme/tokens';

export default function WinRateDonut({ winRate = 0, size = 56, strokeWidth = 5 }) {
  const id = useId();
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const winArc = (winRate / 100) * circ;
  const cx = size / 2;
  const isGood = winRate >= 50;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg
        width={size}
        height={size}
        style={{
          transform: 'rotate(-90deg)',
          filter: `drop-shadow(0 0 4px ${isGood ? T.profit || '#0ecb81' : T.loss || '#f6465d'}40)`,
        }}
      >
        <defs>
          <linearGradient id={`wr-win-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={T.profit || '#0ecb81'} />
            <stop offset="100%" stopColor={T.profit || '#0ecb81'} stopOpacity="0.65" />
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
          stroke={T.surface?.elevated || '#27272a'}
          strokeWidth={strokeWidth}
        />
        {/* Win arc — gradient */}
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
        {/* Loss arc */}
        {winRate < 100 && (
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
          color: isGood ? T.profit || '#0ecb81' : T.loss || '#f6465d',
          textShadow: `0 0 8px ${isGood ? T.profit || '#0ecb81' : T.loss || '#f6465d'}30`,
        }}
      >
        {Math.round(winRate)}%
      </div>
    </div>
  );
}
