// ═══════════════════════════════════════════════════════════════
//  useCalendarFeeds
//  Fetches earnings + economic calendars for a date range.
//  Auto-filters earnings to tickers in `myTickers` (positions).
//  Keeps the feeds in memory so switching months stays cheap.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  fetchEarningsCalendar,
  fetchEconomicCalendar,
  clearCalendarCache,
} from '../utils/calendarApi';

// Only show medium/high impact macro events — filters noise.
const IMPACT_THRESHOLD = { low: 0, medium: 1, high: 2 };

function pad2(n) {
  return String(n).padStart(2, '0');
}

function rangeKey(from, to) {
  return `${from}:${to}`;
}

function buildRange(viewYear, viewMonth) {
  // Grab the viewed month ±1 so navigating neighbours doesn't refetch.
  const start = new Date(Date.UTC(viewYear, viewMonth - 1, 1));
  const end = new Date(Date.UTC(viewYear, viewMonth + 2, 0)); // last day of (viewMonth+1)
  const iso = (d) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  return { from: iso(start), to: iso(end) };
}

export default function useCalendarFeeds({
  viewYear,
  viewMonth,
  myTickers = [],
  minImpact = 'medium',
  enabled = true,
} = {}) {
  const [earnings, setEarnings] = useState([]);
  const [macro, setMacro] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastKey = useRef('');

  // Pre-compute a stable join of myTickers so the dep array stays statically
  // analysable (eslint-react-hooks complains about complex expressions).
  const myTickersKey = myTickers.join('|');

  const run = useCallback(
    async (force = false) => {
      if (!enabled) return;
      const { from, to } = buildRange(viewYear, viewMonth);
      const key = rangeKey(from, to);
      if (!force && key === lastKey.current) return;
      lastKey.current = key;

      setLoading(true);
      setError(null);
      try {
        const [earnRes, econRes] = await Promise.allSettled([
          fetchEarningsCalendar(from, to),
          fetchEconomicCalendar(from, to),
        ]);

        const earn = earnRes.status === 'fulfilled' ? earnRes.value : [];
        const econ = econRes.status === 'fulfilled' ? econRes.value : [];
        const errs = [];
        if (earnRes.status === 'rejected') {
          console.warn('earnings', earnRes.reason);
          errs.push(`earnings: ${earnRes.reason?.message || earnRes.reason}`);
        }
        if (econRes.status === 'rejected') {
          console.warn('econ', econRes.reason);
          errs.push(`macro: ${econRes.reason?.message || econRes.reason}`);
        }

        // Keep only earnings for tickers we hold (case-insensitive).
        const tickerSet = new Set(myTickers.map((t) => String(t || '').toUpperCase()));
        const filteredEarn = tickerSet.size
          ? earn.filter((e) => tickerSet.has(String(e.symbol || '').toUpperCase()))
          : earn;

        const threshold = IMPACT_THRESHOLD[minImpact] ?? 1;
        const filteredMacro = econ.filter((e) => (IMPACT_THRESHOLD[e.impact] ?? 0) >= threshold);

        setEarnings(filteredEarn);
        setMacro(filteredMacro);
        // Only surface as a hard error when BOTH feeds failed — otherwise
        // we still render whichever one came back.
        if (errs.length === 2) {
          setError(errs.join(' · '));
        } else if (errs.length === 1) {
          setError(errs[0]);
        } else {
          setError(null);
        }
      } catch (e) {
        setError(e.message || 'Erreur de récupération du calendrier');
      } finally {
        setLoading(false);
      }
    },
    // myTickers is stable per-render via the join() — extract it to keep
    // the dep array statically analysable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewYear, viewMonth, enabled, myTickersKey, minImpact]
  );

  useEffect(() => {
    run(false);
  }, [run]);

  const refresh = useCallback(() => {
    clearCalendarCache();
    lastKey.current = '';
    run(true);
  }, [run]);

  return { earnings, macro, loading, error, refresh };
}
