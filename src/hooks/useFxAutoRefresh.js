// ═══════════════════════════════════════════════════════════════
//  useFxAutoRefresh — boot fetch + 5-min interval orchestrator.
//
//  Mounted ONCE at the App root (src/App.jsx). Reads useFx() and
//  triggers refresh() according to:
//    - Boot: fetch if lastUpdated is null OR mode === 'auto'
//    - Interval: every 5 min when mode === 'auto' (cleared when
//      mode flips to 'manual' or component unmounts)
//
//  Pure side-effect hook — no return value, no state of its own.
//  The actual fetch + dispatch live in useFx.refresh(); errors are
//  swallowed there and exposed via the local instance's error state.
//  An auto-refresh failure therefore does NOT surface to UI; the
//  next manual refresh in Settings will re-attempt and toast on
//  failure. A stale banner (commit #8) is the proper signal.
//
//  StrictMode: a useRef-guarded boot gate prevents the dev double-
//  mount from firing two boot fetches. Production builds do not
//  StrictMode-double-mount, so the ref is neutral there.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { useFx } from './useFx';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function useFxAutoRefresh() {
  const { mode, lastUpdated, refresh } = useFx();
  const bootedRef = useRef(false);

  // Boot fetch — fires once per component lifecycle.
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    if (lastUpdated === null || mode === 'auto') {
      refresh();
    }
  }, [mode, lastUpdated, refresh]);

  // 5-min interval — only when mode === 'auto'. `refresh` is stable
  // (useCallback([dispatch]) inside useFx), so this effect re-runs
  // only when mode flips, not on every render.
  useEffect(() => {
    if (mode !== 'auto') return;
    const id = setInterval(() => {
      refresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [mode, refresh]);
}
