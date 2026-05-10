// ═══════════════════════════════════════════════════════════════
//  CALENDAR — Announcements grid (earnings + macro)
//              + P&L day heatmap + Year view
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOpenPositions, useClosedTrades, useSettings } from '../../store/useStore';
import { tradePnlUsd } from '../../utils/calculations';
import { formatPnlUsd } from '../../utils/format';
import { toFloat } from '../../utils/math';
import { MAJOR_US_TICKERS } from '../../utils/majorTickers';
import T from '../../theme/tokens';
import GlassCard from '../../components/ui/GlassCard';
// YearHeatmap legacy (@uiw/react-heat-map) replaced by PnLCalendarHeatmap year mode
import PnLCalendarHeatmap from '../../components/charts/PnLCalendarHeatmap';
import useCalendarFeeds from '../../hooks/useCalendarFeeds';
import useApiStatus from '../../hooks/useApiStatus';
import { macroEventsInRange } from '../../data/macroEvents2026';
import { RefreshCw, AlertTriangle } from 'lucide-react';

const mono = { fontFamily: T.fonts.mono, fontVariantNumeric: 'tabular-nums lining-nums' };
const sans = { fontFamily: T.fonts.sans };
const DAY_HEADERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const MONTH_NAMES_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

const viewTabs = [
  { key: 'announcements', label: 'Annonces' },
  { key: 'pnl', label: 'P&L Jour' },
  { key: 'year', label: 'Année' },
];

// Country flags for the macro event list. US/EU/CH are the main ones we care about.
const COUNTRY_FLAGS = {
  US: 'US',
  EU: 'EU',
  DE: 'DE',
  FR: 'FR',
  UK: 'UK',
  GB: 'UK',
  CH: 'CH',
  JP: 'JP',
  CN: 'CN',
  CA: 'CA',
};

function earningsHourBadge(hour) {
  if (hour === 'bmo') return 'Avant ouverture';
  if (hour === 'amc') return 'Après clôture';
  if (hour === 'dmh') return 'Pendant séance';
  return null;
}

function getMonthDays(year, month) {
  const first = new Date(year, month, 1);
  const startDay = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// ─── Styled Tab Buttons ───────────────────────────────────

function StyledTabs({ tabs, active, onChange }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: T.surface.base,
        border: `1px solid ${T.border?.subtle || 'rgba(255,255,255,0.06)'}`,
        borderRadius: 8,
        padding: 3,
        gap: 2,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: isActive ? 700 : 500,
              fontFamily: T.fonts.sans,
              color: isActive ? T.text.primary : T.text.muted,
              background: isActive ? T.surface.elevated : 'transparent',
              boxShadow: isActive
                ? `0 1px 4px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.05)`
                : 'none',
              transition: 'all 150ms ease',
              letterSpacing: '0.01em',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Month nav header ──────────────────────────────────────

function MonthNav({ viewYear, viewMonth, prevMonth, nextMonth }) {
  const label = `${MONTH_NAMES_FR[viewMonth]} ${viewYear}`;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
      }}
    >
      <button
        onClick={prevMonth}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: T.text.muted,
          fontSize: 20,
          padding: '4px 10px',
          borderRadius: 6,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = T.text.primary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = T.text.muted;
        }}
      >
        &#8249;
      </button>
      <span
        style={{
          ...sans,
          fontSize: 15,
          fontWeight: 700,
          color: T.text.primary,
          textTransform: 'capitalize',
        }}
      >
        {label}
      </span>
      <button
        onClick={nextMonth}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: T.text.muted,
          fontSize: 20,
          padding: '4px 10px',
          borderRadius: 6,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = T.text.primary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = T.text.muted;
        }}
      >
        &#8250;
      </button>
    </div>
  );
}

// ─── Day headers (single letter) ──────────────────────────

function DayHeaderRow({ withWeekTotal }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: withWeekTotal ? 'repeat(7, 1fr) 54px' : 'repeat(7, 1fr)',
        gap: 3,
        marginBottom: 4,
      }}
    >
      {DAY_HEADERS.map((d, i) => (
        <div
          key={`${d}-${i}`}
          style={{
            textAlign: 'center',
            fontSize: 9,
            color: T.text.muted,
            ...sans,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            padding: '4px 0',
          }}
        >
          {d}
        </div>
      ))}
      {withWeekTotal && (
        <div
          style={{
            textAlign: 'center',
            fontSize: 9,
            color: T.text.muted,
            ...sans,
            fontWeight: 700,
            letterSpacing: '0.14em',
            padding: '4px 0',
          }}
        >
          &Sigma;
        </div>
      )}
    </div>
  );
}

// ─── Announcements View ────────────────────────────────────

function AnnouncementsView({ viewYear, viewMonth, todayStr, prevMonth, nextMonth, feeds }) {
  const [hoveredDate, setHoveredDate] = useState(null);

  const dateEvents = useMemo(() => {
    const map = {};
    const addEvent = (date, ev) => {
      if (!map[date]) map[date] = [];
      map[date].push(ev);
    };
    (feeds?.earnings || []).forEach((e) => {
      if (!e.date || !e.symbol) return;
      const hr = earningsHourBadge(e.hour);
      addEvent(e.date, {
        type: 'earn',
        label: `${e.symbol} — Résultats Q${e.quarter || '?'}${hr ? ' · ' + hr : ''}`,
        epsEst: e.epsEstimate,
        revEst: e.revenueEstimate,
      });
    });
    (feeds?.macro || []).forEach((ev) => {
      if (!ev.time) return;
      const date = String(ev.time).slice(0, 10);
      const flag = COUNTRY_FLAGS[ev.country] || ev.country || '';
      addEvent(date, {
        type: 'macro',
        label: `${flag ? flag + ' · ' : ''}${ev.event}`,
        impact: ev.impact,
      });
    });
    (feeds?.expirations || []).forEach((ev) => {
      if (!ev.date) return;
      addEvent(ev.date, {
        type: 'exp',
        label: ev.label,
        ticker: ev.ticker,
      });
    });
    return map;
  }, [feeds]);

  const cells = getMonthDays(viewYear, viewMonth);

  const upcomingEvents = useMemo(() => {
    const all = [];
    for (const [date, evts] of Object.entries(dateEvents)) {
      evts.forEach((ev) => all.push({ date, ...ev }));
    }
    all.sort((a, b) => a.date.localeCompare(b.date));
    return all.filter((e) => e.date >= todayStr).slice(0, 20);
  }, [dateEvents, todayStr]);

  return (
    <>
      <GlassCard style={{ padding: '10px 12px' }}>
        <MonthNav
          viewYear={viewYear}
          viewMonth={viewMonth}
          prevMonth={prevMonth}
          nextMonth={nextMonth}
        />
        <DayHeaderRow withWeekTotal={false} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {cells.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;
            const dateStr = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;
            const evts = dateEvents[dateStr] || [];
            const hasMacro = evts.some((e) => e.type === 'macro');
            const hasEarn = evts.some((e) => e.type === 'earn');
            const isToday = dateStr === todayStr;
            const isHovered = hoveredDate === dateStr;

            return (
              <div
                key={dateStr}
                onMouseEnter={() => evts.length > 0 && setHoveredDate(dateStr)}
                onMouseLeave={() => setHoveredDate(null)}
                style={{
                  position: 'relative',
                  textAlign: 'center',
                  padding: '8px 0',
                  borderRadius: 6,
                  minHeight: 52,
                  cursor: evts.length > 0 ? 'pointer' : 'default',
                  background: isToday
                    ? `${T.accent.main}18`
                    : isHovered
                      ? T.surface.overlay
                      : 'transparent',
                  outline: isToday ? `1.5px solid var(--accent, ${T.accent.main})` : 'none',
                  transition: 'background 0.15s, border-color 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    ...mono,
                    fontSize: 12,
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? T.accent.main : T.text.secondary,
                  }}
                >
                  {day}
                </div>
                {(hasMacro || hasEarn || evts.some((e) => e.type === 'exp')) && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginTop: 4 }}>
                    {hasEarn && (
                      <span
                        style={{ width: 6, height: 6, borderRadius: '50%', background: T.profit }}
                      />
                    )}
                    {hasMacro && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: T.greeks.delta,
                        }}
                      />
                    )}
                    {evts.some((e) => e.type === 'exp') && (
                      <span
                        style={{ width: 6, height: 6, borderRadius: '50%', background: T.warning }}
                      />
                    )}
                  </div>
                )}
                {isHovered && evts.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: T.surface.elevated,
                      border: `1px solid ${T.glass.border}`,
                      borderRadius: 8,
                      padding: '6px 10px',
                      whiteSpace: 'nowrap',
                      zIndex: 10,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    }}
                  >
                    {evts.map((ev, j) => {
                      const color =
                        ev.type === 'earn'
                          ? T.profit
                          : ev.type === 'exp'
                            ? T.warning
                            : T.greeks.delta;
                      return (
                        <div
                          key={j}
                          style={{
                            ...mono,
                            fontSize: 10,
                            color,
                            marginBottom: j < evts.length - 1 ? 3 : 0,
                          }}
                        >
                          {ev.label}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>

      {upcomingEvents.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: T.text.muted,
              ...sans,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              padding: '0 4px',
            }}
          >
            Prochains événements
          </div>
          {upcomingEvents.map((ev, i) => {
            const accent =
              ev.type === 'earn' ? T.profit : ev.type === 'exp' ? T.warning : T.greeks.delta;
            const label = ev.type === 'earn' ? 'EARN' : ev.type === 'exp' ? 'EXP' : 'MACRO';
            return (
              <GlassCard key={`${ev.date}-${i}`} style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                  <div
                    style={{
                      width: 4,
                      borderRadius: '2px 0 0 2px',
                      flexShrink: 0,
                      background: accent,
                    }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 12px',
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        ...mono,
                        fontSize: 12,
                        fontWeight: 700,
                        color: T.text.secondary,
                        minWidth: 50,
                      }}
                    >
                      {ev.date.slice(5)}
                    </span>
                    <span
                      style={{
                        ...mono,
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: `${accent}15`,
                        color: accent,
                      }}
                    >
                      {label}
                    </span>
                    {ev.type === 'macro' && ev.impact && (
                      <span
                        style={{
                          ...mono,
                          fontSize: 9,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: ev.impact === 'high' ? `${T.loss}20` : `${T.warning}20`,
                          color: ev.impact === 'high' ? T.loss : T.warning,
                        }}
                      >
                        {ev.impact}
                      </span>
                    )}
                    <span style={{ ...sans, fontSize: 13, color: T.text.primary }}>{ev.label}</span>
                    <span
                      style={{ ...mono, fontSize: 11, marginLeft: 'auto', color: T.text.muted }}
                    >
                      dans{' '}
                      {Math.max(
                        0,
                        Math.ceil((new Date(ev.date + 'T12:00:00') - new Date()) / 86400000)
                      )}
                      j
                    </span>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── P&L Day Heatmap View ──────────────────────────────────

function PnlHeatmapView({ state, viewYear, viewMonth, todayStr, prevMonth, nextMonth }) {
  const navigate = useNavigate();
  const lr = toFloat(state.settings?.liveRate) || 1;
  const [selectedDay, setSelectedDay] = useState(null);

  const { dayPnl, dayCount, dayTrades, maxAbsPnl, monthTotal, bestDay, worstDay } = useMemo(() => {
    const pnlMap = {},
      countMap = {},
      tradesMap = {};
    const monthKey = `${viewYear}-${pad2(viewMonth + 1)}`;
    state.closedTrades.forEach((t) => {
      const d = t.do;
      if (!d || d.slice(0, 7) !== monthKey) return;
      const pnl = tradePnlUsd(t, lr);
      pnlMap[d] = (pnlMap[d] || 0) + pnl;
      countMap[d] = (countMap[d] || 0) + 1;
      if (!tradesMap[d]) tradesMap[d] = [];
      tradesMap[d].push(t);
    });

    let maxAbs = 0,
      total = 0,
      best = null,
      worst = null;
    for (const [date, pnl] of Object.entries(pnlMap)) {
      total += pnl;
      if (Math.abs(pnl) > maxAbs) maxAbs = Math.abs(pnl);
      if (!best || pnl > best.pnl) best = { date, pnl };
      if (!worst || pnl < worst.pnl) worst = { date, pnl };
    }

    return {
      dayPnl: pnlMap,
      dayCount: countMap,
      dayTrades: tradesMap,
      maxAbsPnl: maxAbs,
      monthTotal: total,
      bestDay: best,
      worstDay: worst,
    };
  }, [state.closedTrades, viewYear, viewMonth, lr]);

  const cells = getMonthDays(viewYear, viewMonth);

  // Divergent heatmap: red for loss -> gray for zero -> green for profit
  function pnlBg(pnl) {
    if (pnl === 0 || maxAbsPnl === 0) return 'transparent';
    const intensity = Math.min(1, Math.abs(pnl) / maxAbsPnl);
    const opacity = intensity * 0.6 + 0.15;
    const alpha = Math.round(opacity * 255)
      .toString(16)
      .padStart(2, '0');
    return pnl > 0 ? `${T.profit}${alpha}` : `${T.loss}${alpha}`;
  }

  // Weekly rows with totals
  const weeks = useMemo(() => {
    const rows = [];
    let row = [],
      weekPnl = 0;
    cells.forEach((day) => {
      if (day !== null) {
        const dateStr = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;
        weekPnl += dayPnl[dateStr] || 0;
      }
      row.push(day);
      if (row.length === 7) {
        rows.push({ cells: row, total: weekPnl });
        row = [];
        weekPnl = 0;
      }
    });
    if (row.length > 0) {
      while (row.length < 7) row.push(null);
      rows.push({ cells: row, total: weekPnl });
    }
    return rows;
  }, [cells, dayPnl, viewYear, viewMonth]);

  const selectedTrades = selectedDay ? dayTrades[selectedDay] || [] : [];

  return (
    <>
      <GlassCard style={{ padding: '10px 12px' }}>
        <MonthNav
          viewYear={viewYear}
          viewMonth={viewMonth}
          prevMonth={prevMonth}
          nextMonth={nextMonth}
        />
        <DayHeaderRow withWeekTotal={true} />
        {weeks.map((week, wi) => (
          <div
            key={wi}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr) 54px',
              gap: 3,
              marginBottom: 3,
            }}
          >
            {week.cells.map((day, di) => {
              if (day === null) return <div key={`empty-${wi}-${di}`} />;
              const dateStr = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;
              const pnl = dayPnl[dateStr] || 0;
              const count = dayCount[dateStr] || 0;
              const isToday = dateStr === todayStr;
              const hasTrade = pnl !== 0;
              const color = pnl > 0 ? T.profit : pnl < 0 ? T.loss : T.text.muted;
              const isSelected = selectedDay === dateStr;

              return (
                <div
                  key={dateStr}
                  onClick={() => count > 0 && setSelectedDay(isSelected ? null : dateStr)}
                  style={{
                    position: 'relative',
                    borderRadius: 6,
                    minHeight: 52,
                    background: hasTrade ? pnlBg(pnl) : 'transparent',
                    outline: isToday
                      ? `1.5px solid var(--accent, ${T.accent.main})`
                      : isSelected
                        ? `1.5px solid ${T.accent.main}80`
                        : '1px solid transparent',
                    transition: 'all 0.15s',
                    cursor: count > 0 ? 'pointer' : 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px 2px',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !isToday)
                      e.currentTarget.style.outline = `1px solid ${T.glass.border}`;
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !isToday)
                      e.currentTarget.style.outline = '1px solid transparent';
                  }}
                >
                  {/* Day number top-right */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 3,
                      right: 5,
                      ...mono,
                      fontSize: 9,
                      fontWeight: isToday ? 700 : 400,
                      color: isToday ? T.accent.main : T.text.muted,
                    }}
                  >
                    {day}
                  </div>

                  {/* P&L value center */}
                  {hasTrade ? (
                    <div style={{ ...mono, fontSize: 11, fontWeight: 600, color, marginTop: 4 }}>
                      {pnl > 0 ? '+' : ''}
                      {pnl.toFixed(0)}
                    </div>
                  ) : (
                    <div style={{ height: 14 }} />
                  )}

                  {/* Trade count badge bottom */}
                  {count > 0 && (
                    <div
                      style={{
                        ...mono,
                        fontSize: 8,
                        fontWeight: 600,
                        color: T.text.disabled,
                        marginTop: 2,
                        background: `${T.surface.base}80`,
                        borderRadius: 3,
                        padding: '0px 4px',
                      }}
                    >
                      {count}t
                    </div>
                  )}
                </div>
              );
            })}
            {/* Weekly total */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...mono,
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 6,
                color: week.total > 0 ? T.profit : week.total < 0 ? T.loss : T.text.disabled,
                background:
                  week.total !== 0
                    ? week.total > 0
                      ? `${T.profit}10`
                      : `${T.loss}10`
                    : 'transparent',
              }}
            >
              {week.total !== 0 ? `${week.total > 0 ? '+' : ''}${week.total.toFixed(0)}` : ''}
            </div>
          </div>
        ))}
      </GlassCard>

      {/* Selected day detail panel */}
      {selectedDay && selectedTrades.length > 0 && (
        <GlassCard style={{ padding: '10px 12px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <span style={{ ...sans, fontSize: 13, fontWeight: 700, color: T.text.primary }}>
              Trades du {selectedDay.slice(5)}
            </span>
            <button
              onClick={() => navigate(`/trading/history?search=${selectedDay}`)}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: T.surface.elevated,
                color: T.accent.main,
                ...sans,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Voir dans Historique &rarr;
            </button>
          </div>
          {selectedTrades.map((t, i) => {
            const pnl = tradePnlUsd(t, lr);
            const color = pnl >= 0 ? T.profit : T.loss;
            return (
              <div
                key={t.id || i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '6px 0',
                  borderTop: i > 0 ? `1px solid ${T.glass.border}` : 'none',
                }}
              >
                <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: T.text.primary }}>
                  {t.tk}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 3,
                    background:
                      t.as === 'Option'
                        ? t.ty === 'CALL'
                          ? `${T.profit}25`
                          : `${T.loss}25`
                        : '#42A5F525',
                    color: t.as === 'Option' ? (t.ty === 'CALL' ? T.profit : T.loss) : '#42A5F5',
                  }}
                >
                  {t.as === 'Option' ? t.ty : 'STK'}
                </span>
                <span style={{ ...mono, fontSize: 13, fontWeight: 700, color, marginLeft: 'auto' }}>
                  {formatPnlUsd(pnl)}
                </span>
              </div>
            );
          })}
        </GlassCard>
      )}

      {/* Monthly summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <GlassCard style={{ padding: '10px 12px', textAlign: 'center' }}>
          <div
            style={{
              ...sans,
              fontSize: 9,
              fontWeight: 700,
              color: T.text.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: 4,
            }}
          >
            Total du mois
          </div>
          <div
            style={{
              ...mono,
              fontSize: 18,
              fontWeight: 700,
              color: monthTotal >= 0 ? T.profit : T.loss,
            }}
          >
            {monthTotal !== 0 ? formatPnlUsd(monthTotal) : '--'}
          </div>
        </GlassCard>
        <GlassCard style={{ padding: '10px 12px', textAlign: 'center' }}>
          <div
            style={{
              ...sans,
              fontSize: 9,
              fontWeight: 700,
              color: T.text.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: 4,
            }}
          >
            Meilleur jour
          </div>
          {bestDay ? (
            <>
              <div style={{ ...mono, fontSize: 14, fontWeight: 700, color: T.profit }}>
                {formatPnlUsd(bestDay.pnl)}
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.text.muted, marginTop: 2 }}>
                {bestDay.date.slice(5)}
              </div>
            </>
          ) : (
            <div style={{ ...mono, fontSize: 14, color: T.text.disabled }}>--</div>
          )}
        </GlassCard>
        <GlassCard style={{ padding: '10px 12px', textAlign: 'center' }}>
          <div
            style={{
              ...sans,
              fontSize: 9,
              fontWeight: 700,
              color: T.text.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: 4,
            }}
          >
            Pire jour
          </div>
          {worstDay && worstDay.pnl < 0 ? (
            <>
              <div style={{ ...mono, fontSize: 14, fontWeight: 700, color: T.loss }}>
                {formatPnlUsd(worstDay.pnl)}
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.text.muted, marginTop: 2 }}>
                {worstDay.date.slice(5)}
              </div>
            </>
          ) : (
            <div style={{ ...mono, fontSize: 14, color: T.text.disabled }}>--</div>
          )}
        </GlassCard>
      </div>
    </>
  );
}

// ─── Year View ────────────────────────────────────────────

function YearView({ state, viewYear: _viewYear, setViewYear: _setViewYear }) {
  const lr = toFloat(state.settings?.liveRate) || 1;

  const dayMap = useMemo(() => {
    const map = {};
    state.closedTrades.forEach((t) => {
      if (!t.do) return;
      const pnl = tradePnlUsd(t, lr);
      map[t.do] = (map[t.do] || 0) + pnl;
    });
    return map;
  }, [state.closedTrades, lr]);

  return (
    <GlassCard hover={false} style={{ padding: '16px 16px' }}>
      <PnLCalendarHeatmap dayPnlMap={dayMap} mode="year" currency="USD" />
    </GlassCard>
  );
}

// ─── Main Calendar Page ────────────────────────────────────

const IMPACT_OPTIONS = [
  { key: 'low', label: 'Tout' },
  { key: 'medium', label: 'Moyen+' },
  { key: 'high', label: 'Fort' },
];

export default function Calendar() {
  const openPositions = useOpenPositions();
  const closedTrades = useClosedTrades();
  const settings = useSettings();
  const state = { openPositions, closedTrades, settings };
  const apiStatus = useApiStatus();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [activeTab, setActiveTab] = useState('announcements');
  const [minImpact, setMinImpact] = useState('medium');

  const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  };

  const { earnings, macro, loading, error, refresh } = useCalendarFeeds({
    viewYear,
    viewMonth,
    myTickers: MAJOR_US_TICKERS,
    minImpact,
    enabled: activeTab === 'announcements',
  });

  // ─── Viewed range (month ±1) for fallback filtering ──────────
  const rangeIso = useMemo(() => {
    const from = new Date(Date.UTC(viewYear, viewMonth - 1, 1));
    const to = new Date(Date.UTC(viewYear, viewMonth + 2, 0));
    const iso = (d) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    return { from: iso(from), to: iso(to) };
  }, [viewYear, viewMonth]);

  // ─── Fallback: when Finnhub is down OR the macro feed came back
  //     empty, surface the hardcoded FOMC/CPI/NFP 2026 schedule so
  //     the Announcements grid is never visually dead.
  const finnhubDown = apiStatus.finnhub.status === 'inactive';
  const fallbackMacro = useMemo(() => {
    if (!finnhubDown && macro.length > 0) return [];
    return macroEventsInRange(rangeIso.from, rangeIso.to);
  }, [finnhubDown, macro.length, rangeIso]);

  // ─── Open-position expirations (always surfaced) ─────────────
  const expirations = useMemo(() => {
    return (openPositions || [])
      .filter((p) => p.as === 'Option' && p.ex)
      .map((p) => ({
        date: String(p.ex).slice(0, 10),
        ticker: p.tk,
        label: `${p.tk} — Expiration ${p.ty || ''} ${p.st ? '$' + p.st : ''}`.trim(),
      }));
  }, [openPositions]);

  const effectiveMacro = fallbackMacro.length > 0 ? fallbackMacro : macro;
  const feeds = { earnings, macro: effectiveMacro, expirations };
  const fallbackActive = fallbackMacro.length > 0;
  const sharedProps = { state, viewYear, viewMonth, todayStr, prevMonth, nextMonth };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendrier</h1>
          <p className="page-subtitle">Annonces earnings, événements macro, et P&amp;L par jour.</p>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <StyledTabs tabs={viewTabs} active={activeTab} onChange={setActiveTab} />
        {activeTab === 'announcements' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                display: 'inline-flex',
                background: T.surface.base,
                border: `1px solid ${T.border?.subtle || 'rgba(255,255,255,0.06)'}`,
                borderRadius: 8,
                padding: 3,
                gap: 2,
              }}
            >
              {IMPACT_OPTIONS.map((opt) => {
                const active = opt.key === minImpact;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setMinImpact(opt.key)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: active ? 700 : 500,
                      fontFamily: T.fonts.sans,
                      color: active ? T.text.primary : T.text.muted,
                      background: active ? T.surface.elevated : 'transparent',
                      transition: 'all 150ms ease',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={refresh}
              disabled={loading}
              title="Rafraîchir les calendriers"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: 6,
                border: `1px solid ${T.border?.subtle || 'rgba(255,255,255,0.06)'}`,
                background: T.surface.base,
                color: T.text.muted,
                fontSize: 11,
                fontFamily: T.fonts.sans,
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              <RefreshCw
                size={12}
                style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}
              />
              {loading ? 'Sync...' : 'Rafraîchir'}
            </button>
          </div>
        )}
      </div>

      {/* ── Bannière contextuelle §13.5 fix ─────────────────────
           Reformule les états API Finnhub + fallback en messages clairs :
            - connected + events        → LIVE (vert)
            - connected + empty         → neutral
            - API down + fallback active → warning (FOMC/CPI/NFP offline)
            - not configured            → neutral + lien Réglages
      ─────────────────────────────────────────────────────── */}
      {activeTab === 'announcements' &&
        (() => {
          const finnhubErr = apiStatus.finnhub.error || '';
          const notConfigured = finnhubDown && /key|configure|missing|401|403/i.test(finnhubErr);
          const apiDown = finnhubDown && !notConfigured;
          const connected = apiStatus.finnhub.status === 'active';
          const hasEvents = earnings.length > 0 || effectiveMacro.length > 0;

          let bg,
            border,
            color,
            icon = null,
            content = null;

          if (notConfigured) {
            bg = 'var(--neutral-bg)';
            border = 'var(--border-default)';
            color = 'var(--text-secondary)';
            icon = <AlertTriangle size={13} style={{ flexShrink: 0 }} />;
            content = (
              <span>
                Clé Finnhub non configurée ·{' '}
                <a
                  href="#/settings/api"
                  style={{ color: 'var(--accent-text)', textDecoration: 'underline' }}
                >
                  Réglages → API
                </a>
              </span>
            );
          } else if (apiDown && fallbackActive) {
            bg = `${T.warning}12`;
            border = `${T.warning}30`;
            color = T.warning;
            icon = <AlertTriangle size={13} style={{ flexShrink: 0 }} />;
            content = (
              <span>
                API Finnhub indisponible · Affichage des événements offline (FOMC / CPI / NFP 2026 +
                expirations positions)
                {apiStatus.finnhub.error ? ` · ${apiStatus.finnhub.error}` : ''}
              </span>
            );
          } else if (connected && hasEvents) {
            bg = 'var(--profit-bg)';
            border = 'var(--profit-border)';
            color = 'var(--profit-text)';
            icon = (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--profit)',
                  animation: 'pulse-dot 2s ease-in-out infinite',
                  flexShrink: 0,
                }}
              />
            );
            content = (
              <span>
                Connecté · {earnings.length} résultat{earnings.length > 1 ? 's' : ''} +{' '}
                {effectiveMacro.length} événement{effectiveMacro.length > 1 ? 's' : ''} macro à
                venir
              </span>
            );
          } else if (connected) {
            bg = 'var(--neutral-bg)';
            border = 'var(--border-default)';
            color = 'var(--text-secondary)';
            content = <span>Connecté · Aucun événement à venir sur la période</span>;
          } else {
            return null;
          }

          return (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                background: bg,
                color,
                border: `1px solid ${border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                ...sans,
                fontSize: 11,
              }}
              role="status"
              aria-live="polite"
            >
              {icon}
              {content}
            </div>
          );
        })()}
      {activeTab === 'announcements' &&
        !fallbackActive &&
        error &&
        apiStatus.finnhub.status === 'active' && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              background: `${T.loss}12`,
              color: T.loss,
              ...sans,
              fontSize: 11,
            }}
          >
            Flux partiel : {error}
          </div>
        )}

      {activeTab === 'announcements' && <AnnouncementsView {...sharedProps} feeds={feeds} />}
      {activeTab === 'pnl' && <PnlHeatmapView {...sharedProps} />}
      {activeTab === 'year' && (
        <YearView state={state} viewYear={viewYear} setViewYear={setViewYear} />
      )}

      {activeTab === 'announcements' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: '4px 8px',
            flexWrap: 'wrap',
          }}
        >
          <LegendDot color={T.profit} label="Résultats (earnings)" />
          <LegendDot color={T.greeks.delta} label="Macro (FOMC / CPI / NFP)" />
          <LegendDot color={T.warning} label="Expiration position" />
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      <span style={{ ...sans, fontSize: 10, color: T.text.muted }}>{label}</span>
    </div>
  );
}
