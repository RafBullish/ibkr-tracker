// ═══════════════════════════════════════════════════════════════
//  MARKET STATUS BADGE v3.0 « Midnight Terminal »
//
//  Displays a coloured dot + label indicating the current NY
//  equity-market session state. Self-ticks every minute.
//
//  Session boundaries (NY local time, weekdays only):
//    04:00-09:30  PRE     (orange)
//    09:30-16:00  OPEN    (green)
//    16:00-20:00  POST    (orange)
//    otherwise    CLOSED  (red)
//    Sat/Sun      CLOSED  (all day)
//
//  US exchange holidays are intentionally NOT handled — the spec
//  asked for a simple 24/7 clock with weekend awareness; adding
//  a holiday list would mean hardcoded data that decays yearly.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { POLLING } from '../../constants/timing';

const NY_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hourCycle: 'h23',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function readNyTime(date = new Date()) {
  const parts = NY_FMT.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    weekday: get('weekday'), // "Mon" … "Sun"
    hour: parseInt(get('hour'), 10) || 0,
    minute: parseInt(get('minute'), 10) || 0,
  };
}

function classifySession({ weekday, hour, minute }) {
  if (weekday === 'Sat' || weekday === 'Sun') return 'closed';
  const m = hour * 60 + minute;
  if (m >= 4 * 60 && m < 9 * 60 + 30) return 'pre'; // 04:00 → 09:30
  if (m >= 9 * 60 + 30 && m < 16 * 60) return 'open'; // 09:30 → 16:00
  if (m >= 16 * 60 && m < 20 * 60) return 'post'; // 16:00 → 20:00
  return 'closed';
}

const STATE_LABEL = {
  open: 'OPEN',
  pre: 'PRE',
  post: 'POST',
  closed: 'CLOSED',
};

export default function MarketStatusBadge() {
  const [now, setNow] = useState(() => readNyTime());

  useEffect(() => {
    // Align first refresh to the next minute boundary so the
    // displayed time flips on :00 instead of drifting by ~15-30 s.
    let intervalId;
    const first = new Date();
    const msUntilNextMinute = (60 - first.getSeconds()) * 1000 - first.getMilliseconds();
    const timeoutId = setTimeout(() => {
      setNow(readNyTime());
      intervalId = setInterval(() => setNow(readNyTime()), POLLING.NY_CLOCK_MS);
    }, msUntilNextMinute);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const state = classifySession(now);
  const hh = String(now.hour).padStart(2, '0');
  const mm = String(now.minute).padStart(2, '0');

  return (
    <div
      className="market-status"
      data-state={state}
      role="status"
      aria-label={`Marché US ${STATE_LABEL[state]} · ${hh}:${mm} New York`}
    >
      <span className="market-status__dot" aria-hidden="true" />
      <div className="market-status__body">
        <span className="market-status__state">{STATE_LABEL[state]}</span>
        <span className="market-status__time mono">
          {hh}:{mm}
        </span>
        <span className="market-status__tz">NY</span>
      </div>
    </div>
  );
}
