// ═══════════════════════════════════════════════════════════════
//  FxStaleBanner — sticky top banner when the USD/CHF rate is
//  older than 24h (stale, warning) or 7 days (critical, danger).
//
//  Mounted ONCE at App root (src/App.jsx), inside <ErrorBoundary>.
//  Reads `lastUpdated` and `refresh` from useFx() and recomputes
//  severity locally — does NOT consume useFx().isStale/isCritical
//  because those are useMemo([lastUpdated]) and a setInterval-
//  driven re-render would not invalidate them. The local useMemo
//  here depends on [lastUpdated, tick] so a 60s tick refreshes the
//  age computation. Tracked in BACKLOG.md (post-V1 hook refactor).
//
//  Severity escalation: a user who dismissed at 'stale' sees the
//  banner re-appear if the rate ages into 'critical' (7d+). The
//  visibility logic is a pure derivation from { severity,
//  dismissedAt } — no setState in effect.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { AlertTriangle, AlertOctagon, RefreshCw, X } from 'lucide-react';
import { useFx } from '../../hooks/useFx';

const STALE_MS = 24 * 60 * 60 * 1000; // 24h
const CRITICAL_MS = 7 * 24 * 60 * 60 * 1000; // 7d
const TICK_INTERVAL_MS = 60 * 1000; // 60s

function formatAge(ageMs) {
  if (ageMs == null) return '—';
  const minutes = Math.floor(ageMs / (60 * 1000));
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(ageMs / (60 * 60 * 1000));
  if (hours < 48) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} jours`;
}

export default function FxStaleBanner() {
  const { lastUpdated, refresh } = useFx();
  // `now` is the current epoch ms snapshot used to derive staleness.
  // It's read fresh in useState's lazy initializer, then refreshed
  // every 60s by setInterval below. Keeping the Date.now() reads in
  // the lazy init + interval callback (both non-render contexts)
  // satisfies react-hooks/purity, which flags Date.now() in the
  // render body or in useMemo callbacks.
  const [now, setNow] = useState(() => Date.now());
  // dismissedAt = 'stale' | 'critical' | null — severity at dismiss time.
  const [dismissedAt, setDismissedAt] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Local staleness — pure derivation from `now` (state) and
  // `lastUpdated` (props from useFx). Bypasses useFx().isStale
  // which is memoized on [lastUpdated] alone and wouldn't react
  // to the periodic tick. See BACKLOG.md for the hook-side fix.
  let severity = 'fresh';
  let ageMs = null;
  if (!lastUpdated) {
    severity = 'critical';
  } else {
    ageMs = now - new Date(lastUpdated).getTime();
    if (ageMs > CRITICAL_MS) severity = 'critical';
    else if (ageMs > STALE_MS) severity = 'stale';
  }

  // Pure derivation of visibility — no setState-in-effect needed.
  // Escalation rule: dismissedAt='stale' is overridden when severity
  // escalates to 'critical', re-showing the banner.
  const isHidden =
    dismissedAt !== null &&
    (dismissedAt === 'critical' || (dismissedAt === 'stale' && severity !== 'critical'));

  if (severity === 'fresh') return null;
  if (isHidden) return null;

  const Icon = severity === 'critical' ? AlertOctagon : AlertTriangle;
  const tone = severity === 'critical' ? 'critical' : 'stale';
  const headline =
    severity === 'critical' ? 'Taux USD/CHF gravement obsolète' : 'Taux USD/CHF obsolète';

  return (
    <div role="alert" className={`fx-stale-banner fx-stale-banner--${tone}`}>
      <Icon size={16} aria-hidden="true" />
      <span className="fx-stale-banner__text">
        {headline} — {formatAge(ageMs)}
      </span>
      <button
        type="button"
        className="fx-stale-banner__action"
        onClick={() => refresh()}
        aria-label="Actualiser le taux"
      >
        <RefreshCw size={12} aria-hidden="true" />
        Actualiser
      </button>
      <button
        type="button"
        className="fx-stale-banner__dismiss"
        onClick={() => setDismissedAt(severity)}
        aria-label="Masquer ce bandeau"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
