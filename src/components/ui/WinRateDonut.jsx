// ═══════════════════════════════════════════════════════════════
//  WIN RATE DONUT — système Obsidienne (migré brique 2.A)
//
//  SVG pur, kit OBS : aplats désaturés SANS glow/gradient (DA §5 —
//  l'ex-drop-shadow/textShadow v3.0 meurt), arcs win/loss = proportion
//  de résultats d'argent réel (exception chartée) ; le NUMÉRAL central
//  est un RATIO → encre neutre (loi de couleur).
//
//  A2b — accepts null / non-finite `winRate` (gated upstream by
//  decisive >= 10). Under the gate the donut paints muted and the
//  centre label shows "—" instead of "0%".
//
//  Consommateurs : History (étage ANALYSE) + Analytics (héritage
//  visuel sans recomposition — API inchangée).
// ═══════════════════════════════════════════════════════════════

import { OBS } from '../charts/obsidienne';

const TRACK = 'rgba(255,255,255,.07)';
const INK_PURE = '#FAFAFA';
const INK_MUTE = '#8A8A92';

export default function WinRateDonut({ winRate = null, size = 56, strokeWidth = 5 }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const isGated = typeof winRate !== 'number' || !Number.isFinite(winRate);
  const wr = isGated ? 0 : Math.max(0, Math.min(100, winRate));
  const winArc = (wr / 100) * circ;
  const cx = size / 2;

  return (
    <div className="wr-donut" style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={TRACK} strokeWidth={strokeWidth} />
        {/* Arc win — aplat désaturé (P&L réalisé positif). */}
        {!isGated && wr > 0 && (
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={OBS.color.up}
            strokeOpacity={0.78}
            strokeWidth={strokeWidth}
            strokeDasharray={`${winArc} ${circ}`}
            strokeLinecap="butt"
            style={{ transition: 'stroke-dasharray 0.45s ease-out' }}
          />
        )}
        {/* Arc loss — aplat désaturé (P&L réalisé négatif). */}
        {!isGated && wr < 100 && (
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={OBS.color.down}
            strokeOpacity={0.4}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circ - winArc} ${circ}`}
            strokeDashoffset={-winArc}
            strokeLinecap="butt"
          />
        )}
      </svg>
      <div
        className="wr-donut__label"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: OBS.tick.fontFamily,
          fontSize: Math.round(size * 0.24),
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: isGated ? INK_MUTE : INK_PURE,
        }}
      >
        {isGated ? '—' : `${Math.round(wr)}%`}
      </div>
    </div>
  );
}
