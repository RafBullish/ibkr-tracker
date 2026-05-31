// ═══════════════════════════════════════════════════════════════
//  PRE-MARKET BRIEFING v5 Sprint 5 — /premarket workspace
//
//  Cockpit J-1 / pre-market routine that the trader runs at 14:00
//  CET ahead of NY open (15:30 CET). Focus on one actionable
//  workflow : checklist → confirm ready before the bell.
//
//  Layout (4 strips) :
//    1. Header strip 64 px : clock CET / NY + MKT phase + countdown
//       to next session change
//    2. Market regime row : VIX / SPX / live phase + gate count
//       (positions with imminent gates surfaced first)
//    3. Positions review : table of open positions ordered by gate
//       proximity (read from useSniperGates ladder)
//    4. Routine checklist : 6 checkboxes the trader confirms before
//       the bell. Persisted to localStorage qc:premarket:checks.{date}
//       so the state resets daily.
//
//  Sprint 0 alignment : pas de mock global, empty states '——' quand
//  les feeds (overnight futures / macro calendar / earnings BMO/AMC)
//  ne sont pas câblés. Sprint 5 livre le squelette ; les modules
//  data-source landent progressivement.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useMarketQuotes from '../hooks/useMarketQuotes';
import useSniperGates from '../hooks/useSniperGates';
import { useFx } from '../hooks/useFx';

const ROUTINE_ITEMS = [
  { id: 'macro', label: 'Calendrier macro' },
  { id: 'futures', label: 'Futures + DXY overnight' },
  { id: 'news', label: 'News flow positions + watchlist' },
  { id: 'earnings', label: 'Earnings BMO / AMC' },
  { id: 'positions', label: 'Review positions ouvertes' },
  { id: 'watchlist', label: 'Setups watchlist' },
];

const PREMARKET_INDICES = ['VIX', 'SPX', 'QQQ'];

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const STORAGE_KEY_PREFIX = 'qc:premarket:checks:';

function readChecks(dateKey) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + dateKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeChecks(dateKey, checks) {
  try {
    window.localStorage.setItem(STORAGE_KEY_PREFIX + dateKey, JSON.stringify(checks));
  } catch {
    /* quota / private mode */
  }
}

function fmtClock(date, tz) {
  return new Intl.DateTimeFormat('fr-CH', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function tzMinutes(date, tz) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value, 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value, 10);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  return { hour, minute, weekday, total: hour * 60 + minute };
}

function nextPhase(now) {
  const ny = tzMinutes(now, 'America/New_York');
  const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(ny.weekday);
  if (!isWeekday) {
    return { phase: 'closed', label: 'WEEKEND', countdownLabel: '——' };
  }
  // 04:00 → pre, 09:30 → open, 16:00 → after, 20:00 → closed
  let phase = 'closed';
  let next = null;
  if (ny.total >= 4 * 60 && ny.total < 9 * 60 + 30) {
    phase = 'pre';
    next = { name: 'OPEN', minutes: 9 * 60 + 30 };
  } else if (ny.total >= 9 * 60 + 30 && ny.total < 16 * 60) {
    phase = 'open';
    next = { name: 'AFTER', minutes: 16 * 60 };
  } else if (ny.total >= 16 * 60 && ny.total < 20 * 60) {
    phase = 'after';
    next = { name: 'CLOSED', minutes: 20 * 60 };
  } else {
    phase = 'closed';
    next = { name: 'PRE', minutes: 4 * 60 + 24 * 60 }; // tomorrow 04:00 NY
  }
  let mins = next.minutes - ny.total;
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const countdownLabel = `${next.name} dans ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return { phase, label: phase.toUpperCase(), countdownLabel };
}

function fmtIndex(q) {
  if (!q || !Number.isFinite(q.price)) return '——';
  if (q.price >= 1000) return q.price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return q.price.toFixed(2);
}

function fmtIndexChg(q) {
  if (!q || !Number.isFinite(q.changePercent)) return null;
  const sign = q.changePercent > 0 ? '+' : q.changePercent < 0 ? '−' : '';
  return `${sign}${Math.abs(q.changePercent).toFixed(2)}%`;
}

function vixRegime(vix) {
  if (!vix || !Number.isFinite(vix.price)) return { label: '——', tone: 'mute' };
  if (vix.price < 15) return { label: 'LOW VOL', tone: 'profit' };
  if (vix.price < 20) return { label: 'NORMAL', tone: 'neutral' };
  if (vix.price < 30) return { label: 'ELEVATED', tone: 'warn' };
  return { label: 'STRESSED', tone: 'loss' };
}

export default function PreMarketBriefing() {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const [dateKey] = useState(todayKey);
  const [checks, setChecks] = useState(() => readChecks(dateKey));

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { quotes } = useMarketQuotes(PREMARKET_INDICES);
  const sniperGates = useSniperGates();
  const { rate: fxRate, formatRate: formatFxRate } = useFx();

  const phaseInfo = useMemo(() => nextPhase(now), [now]);
  const vixInfo = useMemo(() => vixRegime(quotes?.VIX), [quotes]);

  const armedPositions = useMemo(() => {
    if (!sniperGates?.rows) return [];
    return sniperGates.rows
      .map((row) => {
        const armedGate = row.gates.find((g) => g.status === 'armed');
        const imminentGate = row.gates.find((g) => g.status === 'imminent');
        return {
          ...row,
          flagGate: armedGate || imminentGate || null,
        };
      })
      .filter((r) => r.flagGate)
      .sort((a, b) => {
        // ARMED first then imminent
        const order = { armed: 0, imminent: 1 };
        return order[a.flagGate.status] - order[b.flagGate.status];
      });
  }, [sniperGates]);

  const allOpenOptions = useMemo(() => sniperGates?.rows || [], [sniperGates]);

  const checkedCount = Object.values(checks).filter(Boolean).length;
  const allReady = checkedCount === ROUTINE_ITEMS.length;

  const toggleCheck = (id) => {
    const next = { ...checks, [id]: !checks[id] };
    setChecks(next);
    writeChecks(dateKey, next);
  };

  const resetChecks = () => {
    setChecks({});
    writeChecks(dateKey, {});
  };

  const confirmReady = () => {
    if (!allReady) return;
    const stamp = new Date().toISOString();
    const next = { ...checks, _readyAt: stamp };
    setChecks(next);
    writeChecks(dateKey, next);
  };

  const readyAt = checks?._readyAt;

  return (
    <div className="premarket-page">
      {/* 1. Header — clocks + phase + countdown */}
      <div className="premarket-page__header">
        <div className="premarket-page__clock-cell">
          <span className="premarket-page__clock-label">CET · Genève</span>
          <span className="premarket-page__clock-value">{fmtClock(now, 'Europe/Zurich')}</span>
        </div>
        <div className="premarket-page__clock-cell">
          <span className="premarket-page__clock-label">NY</span>
          <span className="premarket-page__clock-value">{fmtClock(now, 'America/New_York')}</span>
        </div>
        <div
          className="premarket-page__clock-cell premarket-page__clock-cell--phase"
          data-phase={phaseInfo.phase}
        >
          <span className="premarket-page__clock-label">Phase US</span>
          <span className="premarket-page__clock-value premarket-page__clock-value--phase">
            {phaseInfo.label}
          </span>
        </div>
        <div className="premarket-page__clock-cell">
          <span className="premarket-page__clock-label">Prochaine bascule</span>
          <span className="premarket-page__clock-value">{phaseInfo.countdownLabel}</span>
        </div>
        <div className="premarket-page__clock-cell premarket-page__clock-cell--ready">
          {readyAt ? (
            <>
              <span className="premarket-page__clock-label">Routine confirmée</span>
              <span className="premarket-page__clock-value premarket-page__clock-value--ok">
                {new Date(readyAt).toLocaleTimeString('fr-CH', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </>
          ) : (
            <>
              <span className="premarket-page__clock-label">Routine</span>
              <span className="premarket-page__clock-value">
                {checkedCount} / {ROUTINE_ITEMS.length}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 2. Market regime row */}
      <div className="premarket-page__regime">
        <div className="premarket-page__regime-cell" data-tone={vixInfo.tone}>
          <span className="premarket-page__regime-label">VIX</span>
          <span className="premarket-page__regime-value">{fmtIndex(quotes?.VIX)}</span>
          <span className="premarket-page__regime-sub">{vixInfo.label}</span>
        </div>
        <div className="premarket-page__regime-cell">
          <span className="premarket-page__regime-label">SPX</span>
          <span className="premarket-page__regime-value">{fmtIndex(quotes?.SPX)}</span>
          <span className="premarket-page__regime-sub">{fmtIndexChg(quotes?.SPX) || '——'}</span>
        </div>
        <div className="premarket-page__regime-cell">
          <span className="premarket-page__regime-label">QQQ</span>
          <span className="premarket-page__regime-value">{fmtIndex(quotes?.QQQ)}</span>
          <span className="premarket-page__regime-sub">{fmtIndexChg(quotes?.QQQ) || '——'}</span>
        </div>
        <div
          className="premarket-page__regime-cell"
          data-tone={armedPositions.length > 0 ? 'loss' : 'profit'}
        >
          <span className="premarket-page__regime-label">Gates armés</span>
          <span className="premarket-page__regime-value">{armedPositions.length}</span>
          <span className="premarket-page__regime-sub">/ {allOpenOptions.length} positions</span>
        </div>
        <div className="premarket-page__regime-cell">
          <span className="premarket-page__regime-label">USD/CHF</span>
          <span className="premarket-page__regime-value">
            {fxRate > 0 ? formatFxRate(fxRate) : '——'}
          </span>
          <span className="premarket-page__regime-sub">via FX hook</span>
        </div>
        <div className="premarket-page__regime-cell">
          <span className="premarket-page__regime-label">DXY</span>
          <span className="premarket-page__regime-value">——</span>
          <span className="premarket-page__regime-sub">overnight feed</span>
        </div>
      </div>

      {/* 3. Positions review — gates table */}
      <section className="premarket-page__section">
        <header className="premarket-page__section-head">
          <span className="premarket-page__section-title">Positions Review · Gates</span>
          <span className="premarket-page__section-hint">
            {armedPositions.length > 0
              ? `${armedPositions.length} attention requise · ${allOpenOptions.length} options ouvertes`
              : `${allOpenOptions.length} options ouvertes · aucune gate critique`}
          </span>
        </header>
        <div className="premarket-page__section-body">
          {allOpenOptions.length === 0 ? (
            <div className="module-empty">
              <span className="module-empty__title">Aucune option ouverte</span>
              <span className="module-empty__sub">
                Les gates Sniper s&apos;affichent ici quand tu as des positions options actives ce
                matin.
              </span>
            </div>
          ) : (
            <table className="premarket-page__table" aria-label="Positions Review">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Strat</th>
                  <th>Strike</th>
                  <th>DTE</th>
                  <th>Unreal</th>
                  <th>Gate critique</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {allOpenOptions.map((row) => {
                  const armed = row.gates.find((g) => g.status === 'armed');
                  const imminent = row.gates.find((g) => g.status === 'imminent');
                  const flag = armed || imminent;
                  const status = armed ? 'ARMED' : imminent ? 'IMMINENT' : 'safe';
                  return (
                    <tr
                      key={row.id}
                      className="premarket-page__row"
                      data-status={
                        status === 'ARMED'
                          ? 'armed'
                          : status === 'IMMINENT'
                            ? 'imminent'
                            : undefined
                      }
                      onClick={() =>
                        navigate(`/trading/positions?focus=${encodeURIComponent(row.id)}`)
                      }
                    >
                      <td>{row.ticker}</td>
                      <td className="premarket-page__strat">
                        {row.dir === 'Short' ? 'S' : 'L'}
                        {row.type === 'PUT' ? 'P' : row.type === 'CALL' ? 'C' : '—'}
                      </td>
                      <td>{row.strike ? `$${row.strike}` : '—'}</td>
                      <td>{row.dte != null ? `${row.dte}d` : '—'}</td>
                      <td
                        className={
                          row.unrealPct > 0
                            ? 'premarket-page__cell--profit'
                            : row.unrealPct < 0
                              ? 'premarket-page__cell--loss'
                              : ''
                        }
                      >
                        {row.unrealPct == null
                          ? '——'
                          : `${row.unrealPct > 0 ? '+' : ''}${row.unrealPct.toFixed(1)}%`}
                      </td>
                      <td className="premarket-page__gate-cell">
                        {flag ? `${flag.gate} · ${flag.label}` : '—'}
                      </td>
                      <td>
                        <span
                          className="premarket-page__status-pill"
                          data-status={
                            status === 'ARMED'
                              ? 'armed'
                              : status === 'IMMINENT'
                                ? 'imminent'
                                : 'safe'
                          }
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* 4. Routine checklist */}
      <section className="premarket-page__section">
        <header className="premarket-page__section-head">
          <span className="premarket-page__section-title">Routine pré-marché · {dateKey}</span>
          <span className="premarket-page__section-hint">
            {readyAt
              ? `Confirmée à ${new Date(readyAt).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`
              : `${checkedCount} / ${ROUTINE_ITEMS.length} étapes cochées`}
          </span>
        </header>
        <div className="premarket-page__checklist">
          {ROUTINE_ITEMS.map((item) => (
            <label
              key={item.id}
              className="premarket-page__check-row"
              data-checked={!!checks[item.id] || undefined}
            >
              <input
                type="checkbox"
                className="premarket-page__check-input"
                checked={!!checks[item.id]}
                onChange={() => toggleCheck(item.id)}
              />
              <span className="premarket-page__check-box" aria-hidden="true">
                {checks[item.id] ? '✓' : ''}
              </span>
              <span className="premarket-page__check-label">{item.label}</span>
            </label>
          ))}
        </div>
        <div className="premarket-page__actions">
          <button
            type="button"
            className="premarket-page__btn premarket-page__btn--ghost"
            onClick={resetChecks}
            disabled={checkedCount === 0 && !readyAt}
          >
            Reset
          </button>
          <button
            type="button"
            className="premarket-page__btn premarket-page__btn--primary"
            onClick={confirmReady}
            disabled={!allReady || !!readyAt}
          >
            {readyAt ? 'Confirmée ✓' : 'Confirm Ready'}
          </button>
        </div>
      </section>
    </div>
  );
}
