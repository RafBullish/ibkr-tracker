// ═══════════════════════════════════════════════════════════════
//  MACRO EVENTS 2026 — offline fallback when Finnhub is down.
//  Source: Federal Reserve schedule (FOMC) + BLS release schedule
//  (CPI / NFP) as published 2025-Q4. Dates are the announcement /
//  release date (not the period covered).
//
//  Shape mirrors the Finnhub economic-calendar rows consumed by
//  useCalendarFeeds so they slot straight into the Calendar view:
//    { time: 'YYYY-MM-DD', country: 'US', event: string, impact: 'high' }
// ═══════════════════════════════════════════════════════════════

export const MACRO_EVENTS_2026 = Object.freeze([
  // ─── FOMC meetings (rate decision, statement 14:00 ET day 2) ───
  { time: '2026-01-28', country: 'US', event: 'FOMC — Décision de taux', impact: 'high' },
  { time: '2026-03-18', country: 'US', event: 'FOMC — Décision de taux + SEP', impact: 'high' },
  { time: '2026-04-29', country: 'US', event: 'FOMC — Décision de taux', impact: 'high' },
  { time: '2026-06-17', country: 'US', event: 'FOMC — Décision de taux + SEP', impact: 'high' },
  { time: '2026-07-29', country: 'US', event: 'FOMC — Décision de taux', impact: 'high' },
  { time: '2026-09-16', country: 'US', event: 'FOMC — Décision de taux + SEP', impact: 'high' },
  { time: '2026-10-28', country: 'US', event: 'FOMC — Décision de taux', impact: 'high' },
  { time: '2026-12-16', country: 'US', event: 'FOMC — Décision de taux + SEP', impact: 'high' },

  // ─── CPI releases (BLS 08:30 ET) ───
  { time: '2026-01-13', country: 'US', event: 'CPI (décembre 2025)', impact: 'high' },
  { time: '2026-02-11', country: 'US', event: 'CPI (janvier 2026)', impact: 'high' },
  { time: '2026-03-11', country: 'US', event: 'CPI (février 2026)', impact: 'high' },
  { time: '2026-04-14', country: 'US', event: 'CPI (mars 2026)', impact: 'high' },
  { time: '2026-05-13', country: 'US', event: 'CPI (avril 2026)', impact: 'high' },
  { time: '2026-06-10', country: 'US', event: 'CPI (mai 2026)', impact: 'high' },
  { time: '2026-07-15', country: 'US', event: 'CPI (juin 2026)', impact: 'high' },
  { time: '2026-08-12', country: 'US', event: 'CPI (juillet 2026)', impact: 'high' },
  { time: '2026-09-10', country: 'US', event: 'CPI (août 2026)', impact: 'high' },
  { time: '2026-10-15', country: 'US', event: 'CPI (septembre 2026)', impact: 'high' },
  { time: '2026-11-12', country: 'US', event: 'CPI (octobre 2026)', impact: 'high' },
  { time: '2026-12-10', country: 'US', event: 'CPI (novembre 2026)', impact: 'high' },

  // ─── Non-Farm Payrolls (BLS, first Friday of month, 08:30 ET) ───
  { time: '2026-01-09', country: 'US', event: 'NFP (décembre 2025)', impact: 'high' },
  { time: '2026-02-06', country: 'US', event: 'NFP (janvier 2026)', impact: 'high' },
  { time: '2026-03-06', country: 'US', event: 'NFP (février 2026)', impact: 'high' },
  { time: '2026-04-03', country: 'US', event: 'NFP (mars 2026)', impact: 'high' },
  { time: '2026-05-01', country: 'US', event: 'NFP (avril 2026)', impact: 'high' },
  { time: '2026-06-05', country: 'US', event: 'NFP (mai 2026)', impact: 'high' },
  { time: '2026-07-02', country: 'US', event: 'NFP (juin 2026)', impact: 'high' },
  { time: '2026-08-07', country: 'US', event: 'NFP (juillet 2026)', impact: 'high' },
  { time: '2026-09-04', country: 'US', event: 'NFP (août 2026)', impact: 'high' },
  { time: '2026-10-02', country: 'US', event: 'NFP (septembre 2026)', impact: 'high' },
  { time: '2026-11-06', country: 'US', event: 'NFP (octobre 2026)', impact: 'high' },
  { time: '2026-12-04', country: 'US', event: 'NFP (novembre 2026)', impact: 'high' },
]);

export function macroEventsInRange(fromIso, toIso) {
  return MACRO_EVENTS_2026.filter((ev) => ev.time >= fromIso && ev.time <= toIso);
}

export default MACRO_EVENTS_2026;
