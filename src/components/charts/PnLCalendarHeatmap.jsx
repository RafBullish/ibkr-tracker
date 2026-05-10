// ═══════════════════════════════════════════════════════════════
//  PNL CALENDAR HEATMAP v3.0 « Midnight Terminal »
//
//  Two modes:
//    mode='month' (default) — 7-column monthly calendar (5-6 rows),
//      navigation arrows step ±1 month. Each cell shows the day
//      number + compact P&L. Click opens a trade-detail modal.
//    mode='year'  — 52-column × 7-row GitHub-style heatmap for an
//      entire calendar year. Monday-first; weekend rows greyed.
//      Month boundaries drawn as subtle vertical dividers.
//
//  Both modes share the divergent colour scale via --hm-pos-{0..4}
//  and --hm-neg-{0..4} tokens, scaled relative to the *visible*
//  maxAbs P&L for the selected window.
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale/fr';
import Tooltip from '../ui/Tooltip';
import EmptyState from '../ui/EmptyState';

function pad2(n) {
  return String(n).padStart(2, '0');
}
function isoDate(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

// Returns the calendar grid for a given month: array of weeks, each week is
// an array of 7 entries (Mon..Sun). Entries outside the month are nulls.
function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysInMonth = last.getDate();

  // Monday-first: JS 0=Sun..6=Sat ⇒ we want 0=Mon..6=Sun
  const firstWeekday = (first.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// Maps a P&L value to one of the 5-band CSS custom properties
function tokenForPnl(pnl, maxAbs) {
  if (pnl == null || maxAbs === 0) return 'var(--surface-3)';
  const ratio = Math.abs(pnl) / maxAbs;
  const band = ratio <= 0.2 ? 0 : ratio <= 0.4 ? 1 : ratio <= 0.6 ? 2 : ratio <= 0.8 ? 3 : 4;
  return pnl >= 0 ? `var(--hm-pos-${band})` : `var(--hm-neg-${band})`;
}

function formatShortPnl(pnl, currency = 'USD') {
  if (pnl == null) return '';
  const abs = Math.abs(pnl);
  const sign = pnl > 0 ? '+' : pnl < 0 ? '−' : '';
  const fmt = new Intl.NumberFormat('en-US', {
    notation: abs >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: abs >= 1000 ? 1 : 0,
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  });
  return `${sign}${fmt.format(abs)}`.replace(/^(\+|−)\$?/, (m, s) => s + (abs >= 1000 ? '$' : '$'));
}

function formatFullPnl(pnl, currency = 'USD') {
  if (pnl == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'always',
  }).format(pnl);
}

// Year grid: 7 rows (Mon..Sun) × 53 columns (ISO weeks), Monday-first.
// Returns { cells: Array<{iso, day, month, weekIndex, weekdayIndex}>, monthBoundaries: number[] }
function buildYearGrid(year) {
  const cells = [];
  const monthBoundaries = []; // week index where month starts
  let currentMonth = -1;

  // Start at the Monday on or before Jan 1
  const jan1 = new Date(year, 0, 1);
  const jan1Weekday = (jan1.getDay() + 6) % 7; // 0=Mon..6=Sun
  const start = new Date(year, 0, 1 - jan1Weekday);

  // End at the Sunday on or after Dec 31
  const dec31 = new Date(year, 11, 31);
  const dec31Weekday = (dec31.getDay() + 6) % 7;
  const end = new Date(year, 11, 31 + (6 - dec31Weekday));

  let cursor = new Date(start);
  let weekIndex = 0;
  let prevWeekday = -1;

  while (cursor <= end) {
    const weekdayIndex = (cursor.getDay() + 6) % 7;
    if (prevWeekday >= 0 && weekdayIndex <= prevWeekday) weekIndex++;

    const inYear = cursor.getFullYear() === year;
    cells.push({
      iso: inYear ? isoDate(year, cursor.getMonth(), cursor.getDate()) : null,
      day: cursor.getDate(),
      month: cursor.getMonth(),
      weekIndex,
      weekdayIndex,
      inYear,
    });

    if (inYear && cursor.getMonth() !== currentMonth) {
      monthBoundaries.push({ weekIndex, month: cursor.getMonth() });
      currentMonth = cursor.getMonth();
    }

    prevWeekday = weekdayIndex;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }

  return { cells, monthBoundaries, totalWeeks: weekIndex + 1 };
}

function YearMode({ dayPnlMap, year, onCellClick, currency, onYearChange, onSwitchMode }) {
  const { cells, monthBoundaries, totalWeeks } = useMemo(() => buildYearGrid(year), [year]);

  const { total, wins, losses, maxAbs } = useMemo(() => {
    let t = 0,
      w = 0,
      l = 0,
      mx = 0;
    for (const c of cells) {
      if (!c.inYear || !c.iso) continue;
      const v = dayPnlMap?.[c.iso];
      if (typeof v === 'number' && isFinite(v)) {
        t += v;
        if (v > 0) w++;
        else if (v < 0) l++;
        if (Math.abs(v) > mx) mx = Math.abs(v);
      }
    }
    return { total: t, wins: w, losses: l, maxAbs: mx };
  }, [cells, dayPnlMap]);

  const monthLabels = Array.from({ length: 12 }, (_, i) =>
    format(new Date(2026, i, 1), 'MMM', { locale: fr })
  );

  return (
    <div className="pnl-calendar">
      <div className="pnl-calendar__head">
        <div className="pnl-calendar__nav">
          <button
            type="button"
            className="pnl-calendar__nav-btn"
            onClick={() => onYearChange(year - 1)}
            aria-label="Année précédente"
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
          <span className="pnl-calendar__month">{year}</span>
          <button
            type="button"
            className="pnl-calendar__nav-btn"
            onClick={() => onYearChange(year + 1)}
            aria-label="Année suivante"
          >
            <ChevronRight size={14} aria-hidden="true" />
          </button>
          {onSwitchMode && (
            <button
              type="button"
              className="pnl-calendar__mode-btn"
              onClick={onSwitchMode}
              aria-label="Basculer en vue mensuelle"
            >
              Mois
            </button>
          )}
        </div>

        <div className="pnl-calendar__summary">
          <span
            className="pnl-calendar__total mono"
            data-tone={total > 0 ? 'profit' : total < 0 ? 'loss' : 'neutral'}
          >
            {formatFullPnl(total, currency)}
          </span>
          <span className="pnl-calendar__meta">
            {wins} gain{wins > 1 ? 's' : ''} · {losses} perte{losses > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {maxAbs === 0 ? (
        <EmptyState
          icon={CalendarDays}
          size="compact"
          title="Aucune activité cette année"
          description="Sélectionne une autre année ou importe plus de trades."
        />
      ) : (
        <div className="pnl-calendar__year-wrap">
          {/* Month labels */}
          <div
            className="pnl-calendar__year-months"
            style={{ gridTemplateColumns: `auto repeat(${totalWeeks}, 1fr)` }}
          >
            <span /> {/* spacer for weekday column */}
            {Array.from({ length: totalWeeks }).map((_, wi) => {
              const boundary = monthBoundaries.find((b) => b.weekIndex === wi);
              return (
                <span key={wi} className="pnl-calendar__year-month-label">
                  {boundary ? monthLabels[boundary.month] : ''}
                </span>
              );
            })}
          </div>
          <div
            className="pnl-calendar__year-grid"
            style={{ gridTemplateColumns: `auto repeat(${totalWeeks}, 1fr)` }}
          >
            {/* Weekday labels column */}
            <div className="pnl-calendar__year-weekdays">
              {['Lu', '', 'Me', '', 'Ve', '', 'Di'].map((w, i) => (
                <span key={i}>{w}</span>
              ))}
            </div>
            {/* Weeks */}
            {Array.from({ length: totalWeeks }).map((_, wi) => (
              <div key={wi} className="pnl-calendar__year-week">
                {Array.from({ length: 7 }).map((_, dayOfWeek) => {
                  const cell = cells.find(
                    (c) => c.weekIndex === wi && c.weekdayIndex === dayOfWeek
                  );
                  if (!cell || !cell.inYear) {
                    return (
                      <span
                        key={dayOfWeek}
                        className="pnl-calendar__year-cell pnl-calendar__year-cell--empty"
                      />
                    );
                  }
                  const v = dayPnlMap?.[cell.iso];
                  const bg = tokenForPnl(v, maxAbs);
                  const label =
                    v != null
                      ? `${format(new Date(year, cell.month, cell.day), 'EEEE dd MMMM', { locale: fr })} · ${formatFullPnl(v, currency)}`
                      : format(new Date(year, cell.month, cell.day), 'EEEE dd MMMM', {
                          locale: fr,
                        });
                  const tone =
                    v == null ? 'neutral' : v > 0 ? 'profit' : v < 0 ? 'loss' : 'neutral';
                  return (
                    <Tooltip key={dayOfWeek} content={label} side="top">
                      <button
                        type="button"
                        className="pnl-calendar__year-cell"
                        style={{ background: bg }}
                        data-weekend={dayOfWeek === 5 || dayOfWeek === 6 || undefined}
                        data-has-data={v != null || undefined}
                        data-tone={tone}
                        onClick={() => v != null && onCellClick?.(cell.iso, v)}
                        aria-label={label}
                      />
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PnLCalendarHeatmap({
  dayPnlMap,
  currentMonth,
  mode: modeProp,
  onMonthChange,
  onCellClick,
  currency = 'USD',
  className,
}) {
  const today = new Date();
  const [mode, setMode] = useState(modeProp || 'month');
  const [cursor, setCursor] = useState(() =>
    currentMonth instanceof Date
      ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      : new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [yearCursor, setYearCursor] = useState(() => today.getFullYear());

  // Hooks must be called unconditionally — always compute month-mode data,
  // even when mode==='year' (the values are cheap and discarded in year mode)
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const weeks = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const monthTotal = useMemo(() => {
    let t = 0,
      win = 0,
      loss = 0;
    weeks.forEach((w) =>
      w.forEach((d) => {
        if (!d) return;
        const v = dayPnlMap?.[isoDate(year, month, d)];
        if (typeof v === 'number' && isFinite(v)) {
          t += v;
          if (v > 0) win++;
          else if (v < 0) loss++;
        }
      })
    );
    return { total: t, wins: win, losses: loss };
  }, [weeks, dayPnlMap, year, month]);

  const maxAbs = useMemo(() => {
    let m = 0;
    weeks.forEach((w) =>
      w.forEach((d) => {
        if (!d) return;
        const v = dayPnlMap?.[isoDate(year, month, d)];
        if (typeof v === 'number' && isFinite(v) && Math.abs(v) > m) m = Math.abs(v);
      })
    );
    return m;
  }, [weeks, dayPnlMap, year, month]);

  if (mode === 'year') {
    return (
      <div className={['pnl-calendar', className].filter(Boolean).join(' ')}>
        <YearMode
          dayPnlMap={dayPnlMap}
          year={yearCursor}
          onYearChange={setYearCursor}
          onCellClick={onCellClick}
          currency={currency}
          onSwitchMode={() => setMode('month')}
        />
      </div>
    );
  }

  const goPrev = () => {
    const next = new Date(year, month - 1, 1);
    setCursor(next);
    onMonthChange?.(next);
  };
  const goNext = () => {
    const next = new Date(year, month + 1, 1);
    setCursor(next);
    onMonthChange?.(next);
  };

  const hasAnyData = maxAbs > 0;

  return (
    <div className={['pnl-calendar', className].filter(Boolean).join(' ')}>
      <div className="pnl-calendar__head">
        <div className="pnl-calendar__nav">
          <button
            type="button"
            className="pnl-calendar__nav-btn"
            onClick={goPrev}
            aria-label="Mois précédent"
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
          <span className="pnl-calendar__month">{format(cursor, 'MMMM yyyy', { locale: fr })}</span>
          <button
            type="button"
            className="pnl-calendar__nav-btn"
            onClick={goNext}
            aria-label="Mois suivant"
          >
            <ChevronRight size={14} aria-hidden="true" />
          </button>
          {modeProp == null && (
            <button
              type="button"
              className="pnl-calendar__mode-btn"
              onClick={() => setMode('year')}
              aria-label="Basculer en vue annuelle"
            >
              Année
            </button>
          )}
        </div>

        <div className="pnl-calendar__summary">
          <span
            className="pnl-calendar__total mono"
            data-tone={monthTotal.total > 0 ? 'profit' : monthTotal.total < 0 ? 'loss' : 'neutral'}
          >
            {formatFullPnl(monthTotal.total, currency)}
          </span>
          <span className="pnl-calendar__meta">
            {monthTotal.wins} gain{monthTotal.wins > 1 ? 's' : ''} · {monthTotal.losses} perte
            {monthTotal.losses > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {!hasAnyData ? (
        <EmptyState
          icon={CalendarDays}
          size="compact"
          title="Aucune activité ce mois"
          description="Passe à un mois antérieur ou importe plus de trades."
        />
      ) : (
        <div
          className="pnl-calendar__grid"
          role="grid"
          aria-label={`Calendrier ${format(cursor, 'MMMM yyyy', { locale: fr })}`}
        >
          <div className="pnl-calendar__weekdays" aria-hidden="true">
            {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          {weeks.map((w, wi) => (
            <div key={wi} className="pnl-calendar__week" role="row">
              {w.map((d, di) => {
                if (!d) {
                  return (
                    <span
                      key={di}
                      className="pnl-calendar__cell pnl-calendar__cell--empty"
                      role="gridcell"
                      aria-hidden="true"
                    />
                  );
                }
                const iso = isoDate(year, month, d);
                const v = dayPnlMap?.[iso];
                const bg = tokenForPnl(v, maxAbs);
                const isToday = iso === format(today, 'yyyy-MM-dd');
                const tooltipText =
                  v != null
                    ? `${format(new Date(year, month, d), 'EEEE dd MMMM', { locale: fr })} · ${formatFullPnl(v, currency)}`
                    : format(new Date(year, month, d), 'EEEE dd MMMM', { locale: fr });
                const shortLabel = v != null ? formatShortPnl(v, currency) : '';
                const tone = v == null ? 'neutral' : v > 0 ? 'profit' : v < 0 ? 'loss' : 'neutral';
                return (
                  <Tooltip key={di} content={tooltipText} side="top">
                    <button
                      type="button"
                      className="pnl-calendar__cell"
                      style={{ background: bg }}
                      data-today={isToday || undefined}
                      data-has-data={v != null || undefined}
                      data-tone={tone}
                      onClick={() => v != null && onCellClick?.(iso, v)}
                      aria-label={tooltipText}
                      role="gridcell"
                    >
                      <span className="pnl-calendar__day-num">{d}</span>
                      {shortLabel && (
                        <span className="pnl-calendar__day-pnl mono">{shortLabel}</span>
                      )}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
