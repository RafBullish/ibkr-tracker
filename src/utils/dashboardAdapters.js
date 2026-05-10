// ═══════════════════════════════════════════════════════════════
//  DASHBOARD ADAPTERS
//
//  Pure helpers that derive the extra signals consumed by the
//  top-row KPI cards (NLV hero, P&L Today context, P&L Open
//  breakdown). Kept here so the Dashboard component stays focused
//  on composition rather than math.
// ═══════════════════════════════════════════════════════════════

import { tradePnlUsd, calculateOpenPositionPnl } from './calculations';

export function computeEquityStats(equityCurve) {
  if (!Array.isArray(equityCurve) || equityCurve.length === 0) {
    return { delta7d: null, delta30d: null, ath: null, athDate: null };
  }

  let ath = -Infinity;
  let athDate = null;
  for (const pt of equityCurve) {
    if (pt.equity > ath) {
      ath = pt.equity;
      athDate = pt.date;
    }
  }
  if (!Number.isFinite(ath)) return { delta7d: null, delta30d: null, ath: null, athDate: null };

  const last = equityCurve[equityCurve.length - 1].equity;

  const pickOffset = (n) => {
    const targetIdx = equityCurve.length - 1 - n;
    if (targetIdx < 0) return null;
    return equityCurve[targetIdx];
  };

  const ref7 = pickOffset(7);
  const ref30 = pickOffset(30);

  // Require a non-trivial baseline: the reference equity must be at
  // least 5 % (in absolute terms) of the current equity to avoid
  // blow-ups when the account starts near zero.
  const pct = (ref) => {
    if (!ref || !Number.isFinite(ref.equity) || ref.equity === 0) return null;
    const absLast = Math.abs(last);
    const absRef = Math.abs(ref.equity);
    if (absLast > 0 && absRef < absLast * 0.05) return null;
    return ((last - ref.equity) / absRef) * 100;
  };

  return {
    delta7d: pct(ref7),
    delta30d: pct(ref30),
    ath,
    athDate,
  };
}

export function computeTodayActivity(closedTrades, openPositions, liveRate) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const closedToday = (closedTrades || []).filter((t) => t.do === todayIso);
  const openedToday = (openPositions || []).filter((p) => p.di === todayIso);

  if (closedToday.length === 0) {
    return {
      hasActivity: false,
      closedCount: 0,
      openedCount: openedToday.length,
      best: null,
      worst: null,
    };
  }

  let best = null;
  let worst = null;
  for (const t of closedToday) {
    const pnl = tradePnlUsd(t, liveRate);
    if (!Number.isFinite(pnl)) continue;
    if (best == null || pnl > best.pnl) best = { tk: t.tk || '—', pnl };
    if (worst == null || pnl < worst.pnl) worst = { tk: t.tk || '—', pnl };
  }

  return {
    hasActivity: true,
    closedCount: closedToday.length,
    openedCount: openedToday.length,
    best,
    worst,
  };
}

export function computePortfolioBreakdown(openPositions, liveRate) {
  if (!Array.isArray(openPositions) || openPositions.length === 0) return null;

  let callsVal = 0,
    putsVal = 0,
    stocksVal = 0;
  let callsCt = 0,
    putsCt = 0,
    stocksCt = 0;
  let best = null;
  let worst = null;

  for (const p of openPositions) {
    let mv = 0;
    let upnl = 0;
    try {
      const r = calculateOpenPositionPnl(p, liveRate);
      mv = Math.abs(r.marketValueUsd || 0);
      upnl = Number.isFinite(r.unrealizedPnlUsd) ? r.unrealizedPnlUsd : 0;
    } catch {
      mv = 0;
      upnl = 0;
    }

    if (p.as === 'Option') {
      if (p.ty === 'CALL') {
        callsVal += mv;
        callsCt++;
      } else if (p.ty === 'PUT') {
        putsVal += mv;
        putsCt++;
      } else {
        stocksVal += mv;
        stocksCt++;
      }
    } else {
      stocksVal += mv;
      stocksCt++;
    }

    if (best == null || upnl > best.pnl) best = { tk: p.tk || '—', pnl: upnl };
    if (worst == null || upnl < worst.pnl) worst = { tk: p.tk || '—', pnl: upnl };
  }

  const total = callsVal + putsVal + stocksVal;
  const pct = (v) => (total > 0 ? (v / total) * 100 : 0);

  return {
    calls: { count: callsCt, valueUsd: callsVal, pct: pct(callsVal) },
    puts: { count: putsCt, valueUsd: putsVal, pct: pct(putsVal) },
    stocks: { count: stocksCt, valueUsd: stocksVal, pct: pct(stocksVal) },
    totalExposureUsd: total,
    best,
    worst,
  };
}

/**
 * Resolve the closest upcoming earnings date among the supplied
 * earnings list. `earnings` is expected to follow the shape returned
 * by `useCalendarFeeds`: [{ date: 'YYYY-MM-DD', symbol, hour, … }].
 */
export function findNextEarnings(earnings) {
  if (!Array.isArray(earnings) || earnings.length === 0) return null;
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = earnings
    .filter((e) => e && typeof e.date === 'string' && e.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!upcoming.length) return null;

  const d0 = new Date(todayIso + 'T00:00:00Z').getTime();
  const d1 = new Date(upcoming[0].date + 'T00:00:00Z').getTime();
  const daysUntil = Math.max(0, Math.round((d1 - d0) / 86400000));
  return {
    symbol: upcoming[0].symbol,
    date: upcoming[0].date,
    daysUntil,
  };
}
