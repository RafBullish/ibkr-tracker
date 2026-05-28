// ═══════════════════════════════════════════════════════════════
//  CALENDAR — page-vitrine canonique (CANONICAL-9)
//
//  Huitième et dernière consommation des tokens canoniques.
//
//  Désintoxication de la palette JS divergente : l'import
//  `T from '../../theme/tokens'` a été retiré. Les 99 références T.*
//  ont été converties en var(--*) canoniques ou classes scopées
//  .calendar-page__* (cf. src/styles/pages-calendar.css).
//
//  Sémantique appliquée :
//   - Rouge   = perte d'argent réelle uniquement
//   - Vert    = gain d'argent réel uniquement
//   - Amber   = signal décisionnel (today, action, expirations)
//   - Ink-*   = catégories neutres (CALL/PUT badges, macro labels)
//   - #42A5F5 = badge STK conservé (cyan-kill séparée)
//
//  Aucune modification de logique (feeds Finnhub, fallback macro 2026,
//  agrégation PnL, AnnouncementsView/PnlHeatmap/YearView intacts).
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOpenPositions, useClosedTrades, useSettings } from '../../store/useStore';
import { tradePnlUsd } from '../../utils/calculations';
import { formatPnlUsd } from '../../utils/format';
import { toFloat } from '../../utils/math';
import { MAJOR_US_TICKERS } from '../../utils/majorTickers';
// YearHeatmap legacy (@uiw/react-heat-map) replaced by PnLCalendarHeatmap year mode
import PnLCalendarHeatmap from '../../components/charts/PnLCalendarHeatmap';
import useCalendarFeeds from '../../hooks/useCalendarFeeds';
import useApiStatus from '../../hooks/useApiStatus';
import { macroEventsInRange } from '../../data/macroEvents2026';
import { RefreshCw, AlertTriangle } from 'lucide-react';

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
    <div className="calendar-page__tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className="calendar-page__tab"
          data-active={tab.key === active || undefined}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Month nav header ──────────────────────────────────────

function MonthNav({ viewYear, viewMonth, prevMonth, nextMonth }) {
  const label = `${MONTH_NAMES_FR[viewMonth]} ${viewYear}`;
  return (
    <div className="calendar-page__month-nav">
      <button onClick={prevMonth} className="calendar-page__month-nav-btn" aria-label="Mois précédent">
        &#8249;
      </button>
      <span className="calendar-page__month-label">{label}</span>
      <button onClick={nextMonth} className="calendar-page__month-nav-btn" aria-label="Mois suivant">
        &#8250;
      </button>
    </div>
  );
}

// ─── Day headers (single letter) ──────────────────────────

function DayHeaderRow({ withWeekTotal }) {
  const cls = withWeekTotal
    ? 'calendar-page__day-headers calendar-page__day-headers--with-total'
    : 'calendar-page__day-headers calendar-page__day-headers--no-total';
  return (
    <div className={cls}>
      {DAY_HEADERS.map((d, i) => (
        <div key={`${d}-${i}`}>{d}</div>
      ))}
      {withWeekTotal && <div>&Sigma;</div>}
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
      <section className="calendar-page__panel">
        <MonthNav
          viewYear={viewYear}
          viewMonth={viewMonth}
          prevMonth={prevMonth}
          nextMonth={nextMonth}
        />
        <DayHeaderRow withWeekTotal={false} />
        <div className="calendar-page__ann-grid">
          {cells.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;
            const dateStr = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;
            const evts = dateEvents[dateStr] || [];
            const hasMacro = evts.some((e) => e.type === 'macro');
            const hasEarn = evts.some((e) => e.type === 'earn');
            const hasExp = evts.some((e) => e.type === 'exp');
            const isToday = dateStr === todayStr;
            const isHovered = hoveredDate === dateStr;

            const cellCls = [
              'calendar-page__ann-cell',
              evts.length > 0 && 'calendar-page__ann-cell--clickable',
              isHovered && 'calendar-page__ann-cell--hovered',
              isToday && 'calendar-page__ann-cell--today',
            ]
              .filter(Boolean)
              .join(' ');

            const dayCls = isToday
              ? 'calendar-page__ann-cell-day calendar-page__ann-cell-day--today'
              : 'calendar-page__ann-cell-day';

            return (
              <div
                key={dateStr}
                onMouseEnter={() => evts.length > 0 && setHoveredDate(dateStr)}
                onMouseLeave={() => setHoveredDate(null)}
                className={cellCls}
              >
                <div className={dayCls}>{day}</div>
                {(hasMacro || hasEarn || hasExp) && (
                  <div className="calendar-page__ann-cell-dots">
                    {hasEarn && <span className="calendar-page__ann-dot calendar-page__ann-dot--earnings" />}
                    {hasMacro && <span className="calendar-page__ann-dot calendar-page__ann-dot--macro" />}
                    {hasExp && <span className="calendar-page__ann-dot calendar-page__ann-dot--expiration" />}
                  </div>
                )}
                {isHovered && evts.length > 0 && (
                  <div className="calendar-page__ann-popup">
                    {evts.map((ev, j) => {
                      const rowCls =
                        ev.type === 'earn'
                          ? 'calendar-page__ann-popup-row calendar-page__ann-popup-row--earnings'
                          : ev.type === 'exp'
                            ? 'calendar-page__ann-popup-row calendar-page__ann-popup-row--expiration'
                            : 'calendar-page__ann-popup-row calendar-page__ann-popup-row--macro';
                      return (
                        <div key={j} className={rowCls}>
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
      </section>

      {upcomingEvents.length > 0 && (
        <div className="calendar-page__upcoming">
          <div className="calendar-page__upcoming-head">Prochains événements</div>
          {upcomingEvents.map((ev, i) => {
            const variant = ev.type === 'earn' ? 'earnings' : ev.type === 'exp' ? 'expiration' : 'macro';
            const label = ev.type === 'earn' ? 'EARN' : ev.type === 'exp' ? 'EXP' : 'MACRO';
            return (
              <section
                key={`${ev.date}-${i}`}
                className="calendar-page__panel calendar-page__panel--flush"
              >
                <div className="calendar-page__upcoming-row">
                  <div className={`calendar-page__upcoming-accent calendar-page__upcoming-accent--${variant}`} />
                  <div className="calendar-page__upcoming-body">
                    <span className="calendar-page__upcoming-date">{ev.date.slice(5)}</span>
                    <span className={`calendar-page__upcoming-pill calendar-page__upcoming-pill--${variant}`}>
                      {label}
                    </span>
                    {ev.type === 'macro' && ev.impact && (
                      <span
                        className={`calendar-page__impact-pill calendar-page__impact-pill--${
                          ev.impact === 'high' ? 'high' : 'medium'
                        }`}
                      >
                        {ev.impact}
                      </span>
                    )}
                    <span className="calendar-page__upcoming-label">{ev.label}</span>
                    <span className="calendar-page__upcoming-eta">
                      dans{' '}
                      {Math.max(
                        0,
                        Math.ceil((new Date(ev.date + 'T12:00:00') - new Date()) / 86400000)
                      )}
                      j
                    </span>
                  </div>
                </div>
              </section>
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

  // Divergent heatmap : color-mix on canonical --pnl-up / --pnl-down,
  // intensity proportional to |pnl|/maxAbsPnl. Le calcul reste identique
  // à la version T-based, seules les couleurs source ont changé.
  function pnlBg(pnl) {
    if (pnl === 0 || maxAbsPnl === 0) return 'transparent';
    const intensity = Math.min(1, Math.abs(pnl) / maxAbsPnl);
    const pct = Math.round((intensity * 0.6 + 0.15) * 100);
    const tone = pnl > 0 ? 'var(--pnl-up)' : 'var(--pnl-down)';
    return `color-mix(in srgb, ${tone} ${pct}%, transparent)`;
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
      <section className="calendar-page__panel">
        <MonthNav
          viewYear={viewYear}
          viewMonth={viewMonth}
          prevMonth={prevMonth}
          nextMonth={nextMonth}
        />
        <DayHeaderRow withWeekTotal={true} />
        {weeks.map((week, wi) => (
          <div key={wi} className="calendar-page__pnl-week">
            {week.cells.map((day, di) => {
              if (day === null) return <div key={`empty-${wi}-${di}`} />;
              const dateStr = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;
              const pnl = dayPnl[dateStr] || 0;
              const count = dayCount[dateStr] || 0;
              const isToday = dateStr === todayStr;
              const hasTrade = pnl !== 0;
              const isSelected = selectedDay === dateStr;

              const cellCls = [
                'calendar-page__pnl-cell',
                count > 0 && 'calendar-page__pnl-cell--clickable',
                isToday && 'calendar-page__pnl-cell--today',
                isSelected && !isToday && 'calendar-page__pnl-cell--selected',
              ]
                .filter(Boolean)
                .join(' ');

              const dayNumCls = isToday
                ? 'calendar-page__pnl-day-number calendar-page__pnl-day-number--today'
                : 'calendar-page__pnl-day-number';

              const valueCls = pnl > 0
                ? 'calendar-page__pnl-value calendar-page__pnl-value--up'
                : pnl < 0
                  ? 'calendar-page__pnl-value calendar-page__pnl-value--down'
                  : 'calendar-page__pnl-value';

              return (
                <div
                  key={dateStr}
                  onClick={() => count > 0 && setSelectedDay(isSelected ? null : dateStr)}
                  className={cellCls}
                  style={{ background: hasTrade ? pnlBg(pnl) : 'transparent' }}
                >
                  <div className={dayNumCls}>{day}</div>

                  {hasTrade ? (
                    <div className={valueCls}>
                      {pnl > 0 ? '+' : ''}
                      {pnl.toFixed(0)}
                    </div>
                  ) : (
                    <div style={{ height: 14 }} />
                  )}

                  {count > 0 && <div className="calendar-page__pnl-count-badge">{count}t</div>}
                </div>
              );
            })}
            {/* Weekly total */}
            <div
              className={[
                'calendar-page__pnl-week-total',
                week.total > 0
                  ? 'calendar-page__pnl-week-total--up'
                  : week.total < 0
                    ? 'calendar-page__pnl-week-total--down'
                    : 'calendar-page__pnl-week-total--neutral',
              ].join(' ')}
            >
              {week.total !== 0 ? `${week.total > 0 ? '+' : ''}${week.total.toFixed(0)}` : ''}
            </div>
          </div>
        ))}
      </section>

      {/* Selected day detail panel */}
      {selectedDay && selectedTrades.length > 0 && (
        <section className="calendar-page__panel">
          <div className="calendar-page__day-detail-head">
            <span className="calendar-page__day-detail-title">
              Trades du {selectedDay.slice(5)}
            </span>
            <button
              onClick={() => navigate(`/trading/history?search=${selectedDay}`)}
              className="calendar-page__day-detail-cta"
            >
              Voir dans Historique &rarr;
            </button>
          </div>
          {selectedTrades.map((t, i) => {
            const pnl = tradePnlUsd(t, lr);
            const pnlCls = pnl >= 0
              ? 'calendar-page__trade-pnl calendar-page__trade-pnl--up'
              : 'calendar-page__trade-pnl calendar-page__trade-pnl--down';
            // Badge type — CALL/PUT/STK sont des TYPES d'instruments, pas
            // des directions P&L. Tonalité ink-soft neutre pour CALL et PUT.
            // STK garde son bleu #42A5F5 résiduel (vague cyan-kill séparée).
            const badgeVariant =
              t.as === 'Option'
                ? t.ty === 'CALL'
                  ? 'call'
                  : 'put'
                : 'stk';
            return (
              <div key={t.id || i} className="calendar-page__trade-row">
                <span className="calendar-page__trade-ticker">{t.tk}</span>
                <span
                  className={`calendar-page__trade-type-badge calendar-page__trade-type-badge--${badgeVariant}`}
                >
                  {t.as === 'Option' ? t.ty : 'STK'}
                </span>
                <span className={pnlCls}>{formatPnlUsd(pnl)}</span>
              </div>
            );
          })}
        </section>
      )}

      {/* Monthly summary */}
      <div className="calendar-page__summary-grid">
        <section className="calendar-page__panel calendar-page__panel--center">
          <div className="calendar-page__summary-label">Total du mois</div>
          <div
            className={[
              'calendar-page__summary-value',
              monthTotal > 0
                ? 'calendar-page__summary-value--up'
                : monthTotal < 0
                  ? 'calendar-page__summary-value--down'
                  : '',
            ].filter(Boolean).join(' ')}
          >
            {monthTotal !== 0 ? formatPnlUsd(monthTotal) : '--'}
          </div>
        </section>
        <section className="calendar-page__panel calendar-page__panel--center">
          <div className="calendar-page__summary-label">Meilleur jour</div>
          {bestDay ? (
            <>
              <div className="calendar-page__summary-value calendar-page__summary-value--up">
                {formatPnlUsd(bestDay.pnl)}
              </div>
              <div className="calendar-page__summary-day">{bestDay.date.slice(5)}</div>
            </>
          ) : (
            <div className="calendar-page__summary-value calendar-page__summary-value--mute">--</div>
          )}
        </section>
        <section className="calendar-page__panel calendar-page__panel--center">
          <div className="calendar-page__summary-label">Pire jour</div>
          {worstDay && worstDay.pnl < 0 ? (
            <>
              <div className="calendar-page__summary-value calendar-page__summary-value--down">
                {formatPnlUsd(worstDay.pnl)}
              </div>
              <div className="calendar-page__summary-day">{worstDay.date.slice(5)}</div>
            </>
          ) : (
            <div className="calendar-page__summary-value calendar-page__summary-value--mute">--</div>
          )}
        </section>
      </div>
    </>
  );
}

// ─── Year View ────────────────────────────────────────────

function YearView({ state }) {
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
    <section className="calendar-page__panel">
      <PnLCalendarHeatmap dayPnlMap={dayMap} mode="year" currency="USD" />
    </section>
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
    <div className="page-container calendar-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendrier</h1>
          <p className="page-subtitle">Annonces earnings, événements macro, et P&amp;L par jour.</p>
        </div>
      </div>
      <div className="calendar-page__controls">
        <StyledTabs tabs={viewTabs} active={activeTab} onChange={setActiveTab} />
        {activeTab === 'announcements' && (
          <div className="calendar-page__controls-right">
            <div className="calendar-page__tabs">
              {IMPACT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setMinImpact(opt.key)}
                  className="calendar-page__impact-tab"
                  data-active={opt.key === minImpact || undefined}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={refresh}
              disabled={loading}
              title="Rafraîchir les calendriers"
              className="calendar-page__refresh-btn"
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

          let variant = '';
          let icon = null;
          let content = null;

          if (notConfigured) {
            icon = <AlertTriangle size={13} style={{ flexShrink: 0 }} />;
            content = (
              <span>
                Clé Finnhub non configurée ·{' '}
                <a href="#/settings/api" className="calendar-page__api-banner-link">
                  Réglages → API
                </a>
              </span>
            );
          } else if (apiDown && fallbackActive) {
            variant = 'down';
            icon = <AlertTriangle size={13} style={{ flexShrink: 0 }} />;
            content = (
              <span>
                API Finnhub indisponible · Affichage des événements offline (FOMC / CPI / NFP 2026 +
                expirations positions)
                {apiStatus.finnhub.error ? ` · ${apiStatus.finnhub.error}` : ''}
              </span>
            );
          } else if (connected && hasEvents) {
            variant = 'ok';
            icon = <span className="calendar-page__api-banner-dot" />;
            content = (
              <span>
                Connecté · {earnings.length} résultat{earnings.length > 1 ? 's' : ''} +{' '}
                {effectiveMacro.length} événement{effectiveMacro.length > 1 ? 's' : ''} macro à
                venir
              </span>
            );
          } else if (connected) {
            content = <span>Connecté · Aucun événement à venir sur la période</span>;
          } else {
            return null;
          }

          const cls = variant
            ? `calendar-page__api-banner calendar-page__api-banner--${variant}`
            : 'calendar-page__api-banner';

          return (
            <div className={cls} role="status" aria-live="polite">
              {icon}
              {content}
            </div>
          );
        })()}
      {activeTab === 'announcements' &&
        !fallbackActive &&
        error &&
        apiStatus.finnhub.status === 'active' && (
          <div className="calendar-page__api-banner calendar-page__api-banner--error">
            Flux partiel : {error}
          </div>
        )}

      {activeTab === 'announcements' && <AnnouncementsView {...sharedProps} feeds={feeds} />}
      {activeTab === 'pnl' && <PnlHeatmapView {...sharedProps} />}
      {activeTab === 'year' && <YearView state={state} />}

      {activeTab === 'announcements' && (
        <div className="calendar-page__legend">
          <LegendDot variant="earnings" label="Résultats (earnings)" />
          <LegendDot variant="macro" label="Macro (FOMC / CPI / NFP)" />
          <LegendDot variant="expiration" label="Expiration position" />
        </div>
      )}
    </div>
  );
}

function LegendDot({ variant, label }) {
  return (
    <div className="calendar-page__legend-item">
      <span className={`calendar-page__legend-dot calendar-page__legend-dot--${variant}`} />
      <span className="calendar-page__legend-label">{label}</span>
    </div>
  );
}
