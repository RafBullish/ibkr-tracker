// ═══════════════════════════════════════════════════════════════
//  CUMULATIVE P&L CHART v2 — 4K refonte Phase C.1.8
//  (anciennement DailyPnLChart bar chart en Phase C.1.7)
//
//  Module bento row 1 col 4-6 (480 px). Area chart cumulative :
//    - Cumul = somme running des dailyPnl filtrés par range
//    - Color du gradient + line dynamique selon signe du cumul final
//    - Reference line dashed amber au peak cumul (PEAK +$X)
//    - Reference line à y=0 (zéro)
//    - Badges conditionnels header : 🎯 ATH (si at peak > 0),
//      DRAWDOWN (si > -20% du peak)
//    - Sub-header CUMUL CURRENT / PEAK CUMUL / SLOPE / DAY
//    - Footer BEST TRADE / WORST TRADE / MAX DD CUMUL
//
//  L'export default reste `DailyPnLChart` pour minimiser le diff
//  Dashboard.jsx (cohérence brief Phase C.1.8 §1.1).
//
//  Props :
//    data         : Array<{date, equity}> — equityHistory base
//    dailyPnL     : Array<{date, dailyPnl}> — pré-calculé
//    closedTrades : Array of closed trades (BEST/WORST trade)
//    liveRate     : number (default 1)
//    area         : grid-area string
// ═══════════════════════════════════════════════════════════════

import { Suspense, lazy, useMemo, useState } from 'react';
import useLiveTheme from '../../hooks/useLiveTheme';
import {
  TIMEFRAMES,
  computeDailyPnl,
  filterByTimeframe,
  aggregateDailyPnlByDate,
} from '../../utils/equity';
import { tradePnlUsd } from '../../utils/calculations';
import { useClosedTrades, useSettings } from '../../store/useStore';

const LazyRecharts = lazy(() =>
  import('recharts').then((mod) => ({ default: ({ children }) => children(mod) }))
);

const fmtUsd = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    signDisplay: 'auto',
  }).format(v);
};

const fmtAxisDate = (iso) => {
  if (!iso || typeof iso !== 'string') return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
};

const fmtAxisCumul = (v) => {
  if (!Number.isFinite(v)) return '';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  const abs = Math.abs(v);
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
};

function CumulTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  const cumul = row.cumul;
  const daily = row.dailyPnl;
  return (
    <div className="trading-chart__tooltip">
      <div className="trading-chart__tooltip-date">{row.date}</div>
      <div className="trading-chart__tooltip-row">
        <span>CUMUL</span>
        <span
          className={`trading-chart__tooltip-val${cumul > 0 ? ' is-profit' : cumul < 0 ? ' is-loss' : ''}`}
        >
          {cumul >= 0 ? '+' : '−'}
          {fmtUsd(Math.abs(cumul))}
        </span>
      </div>
      <div className="trading-chart__tooltip-row">
        <span>DAILY Δ</span>
        <span
          className={`trading-chart__tooltip-val${daily > 0 ? ' is-profit' : daily < 0 ? ' is-loss' : ''}`}
        >
          {daily >= 0 ? '+' : '−'}
          {fmtUsd(Math.abs(daily))}
        </span>
      </div>
    </div>
  );
}

function ChartFallback({ message }) {
  return <div className="trading-chart__empty">{message}</div>;
}

export default function DailyPnLChart({
  data,
  dailyPnL,
  closedTrades: closedTradesProp,
  liveRate: liveRateProp,
  range: controlledRange,
  onRangeChange,
  area = 'dailypnl',
}) {
  // B3 — pattern hybride : range/onRangeChange en props = controlled,
  // sinon useState local = uncontrolled (back-compat).
  const [localRange, setLocalRange] = useState('ALL');
  const range = controlledRange !== undefined ? controlledRange : localRange;
  const setRange = onRangeChange || setLocalRange;
  const T = useLiveTheme();

  const storeClosedTrades = useClosedTrades();
  const storeSettings = useSettings();
  const closedTrades = closedTradesProp ?? storeClosedTrades;
  const liveRate = liveRateProp ?? storeSettings?.liveRate ?? 1;

  // B5-1 — agréger par DATE (1 point par jour) AVANT de cumuler.
  // Bug pré-B5 : `data` (=equityHistory) contient UN POINT PAR TRADE ;
  // si N trades clôturent le même jour, `dpMap.get(p.date)` collait le
  // dailyPnl agrégé du jour à chacun des N points → cumul gonflé d'un
  // facteur N (mesuré : ratio 2.029 sur fixture 100 trades / ~2 par jour).
  //
  // Source canonique = `dailyPnL` (useDailyPnL.js — déjà agrégé par date).
  // Le fallback équityHistory passe par aggregateDailyPnlByDate pour
  // sommer les delta intra-jour et rester correct quand `dailyPnL` absent.
  const mergedData = useMemo(() => {
    if (Array.isArray(dailyPnL) && dailyPnL.length) {
      return dailyPnL.map((d) => ({ date: d.date, dailyPnl: d.dailyPnl }));
    }
    const base = Array.isArray(data) ? data : [];
    if (base.length === 0) return [];
    return aggregateDailyPnlByDate(computeDailyPnl(base));
  }, [data, dailyPnL]);

  const filtered = useMemo(() => filterByTimeframe(mergedData, range), [mergedData, range]);

  // Cumulative série (running sum sur les dailyPnL du range).
  const cumulSeries = useMemo(() => {
    if (!filtered.length) return [];
    let cumul = 0;
    return filtered.map((p) => {
      cumul += p.dailyPnl || 0;
      return {
        date: p.date,
        cumul: Math.round(cumul * 100) / 100,
        dailyPnl: p.dailyPnl || 0,
      };
    });
  }, [filtered]);

  const isEmpty = cumulSeries.length === 0;

  // ─── Dérivations ────────────────────────────────────────────
  const cumulCurrent = useMemo(() => {
    if (cumulSeries.length === 0) return 0;
    return cumulSeries[cumulSeries.length - 1].cumul;
  }, [cumulSeries]);

  const peakCumul = useMemo(() => {
    if (cumulSeries.length === 0) return 0;
    return Math.max(0, ...cumulSeries.map((p) => p.cumul));
  }, [cumulSeries]);

  const troughCumul = useMemo(() => {
    if (cumulSeries.length === 0) return 0;
    return Math.min(0, ...cumulSeries.map((p) => p.cumul));
  }, [cumulSeries]);

  // Max DD cumul = drop max entre running peak et trough après ce peak.
  const maxDDCumul = useMemo(() => {
    if (cumulSeries.length === 0) return 0;
    let runningPeak = cumulSeries[0].cumul;
    let maxDD = 0;
    for (const p of cumulSeries) {
      if (p.cumul > runningPeak) runningPeak = p.cumul;
      const dd = runningPeak - p.cumul;
      if (dd > maxDD) maxDD = dd;
    }
    return maxDD;
  }, [cumulSeries]);

  const daysCount = filtered.length;
  const daysActive = useMemo(
    () => filtered.filter((p) => (p.dailyPnl || 0) !== 0).length,
    [filtered]
  );

  const slopePerDay = useMemo(() => {
    if (cumulSeries.length === 0) return 0;
    return cumulCurrent / cumulSeries.length;
  }, [cumulSeries, cumulCurrent]);

  // ─── Badges conditionnels header ────────────────────────────
  const isAtPeak = useMemo(() => {
    if (peakCumul <= 0) return false;
    return Math.abs(cumulCurrent - peakCumul) < 0.01;
  }, [cumulCurrent, peakCumul]);

  const ddFromPeakPct = useMemo(() => {
    if (peakCumul <= 0) return 0;
    return ((cumulCurrent - peakCumul) / peakCumul) * 100;
  }, [cumulCurrent, peakCumul]);

  const isInDrawdown = ddFromPeakPct < -20;

  // ─── BEST / WORST TRADE all-time ────────────────────────────
  const tradeExtremes = useMemo(() => {
    if (!closedTrades || closedTrades.length === 0) {
      return { best: null, worst: null };
    }
    let best = null;
    let worst = null;
    for (const t of closedTrades) {
      const pnl = tradePnlUsd(t, liveRate);
      if (!Number.isFinite(pnl)) continue;
      const entry = { ticker: t.tk || '—', pnl, date: t.do || t.di };
      if (!best || pnl > best.pnl) best = entry;
      if (!worst || pnl < worst.pnl) worst = entry;
    }
    return { best, worst };
  }, [closedTrades, liveRate]);

  // ─── Tones dynamiques ───────────────────────────────────────
  const cumulTone = cumulCurrent > 0 ? 'profit' : cumulCurrent < 0 ? 'loss' : 'mute';
  const slopeTone = slopePerDay > 0 ? 'profit' : slopePerDay < 0 ? 'loss' : 'mute';
  const cumulColor = cumulCurrent >= 0 ? T.profit : T.loss;
  const cumulSign = cumulCurrent > 0 ? '+' : cumulCurrent < 0 ? '−' : '';
  const slopeSign = slopePerDay > 0 ? '+' : slopePerDay < 0 ? '−' : '';

  return (
    <section
      className="trading-chart trading-chart--cumul"
      style={{ gridArea: area }}
      data-tone={cumulTone}
    >
      <header className="trading-chart__header">
        <div className="trading-chart__title-wrap">
          <span className="trading-chart__title">Cumulative P&amp;L</span>
          <span className="trading-chart__sub">
            {daysCount > 0
              ? `${daysCount} j · ${daysActive} actif${daysActive > 1 ? 's' : ''}`
              : '—'}
          </span>
          {isInDrawdown ? (
            <span className="trading-chart__warn-badge" title={`Drawdown ${ddFromPeakPct.toFixed(1)}% vs peak`}>
              <span className="trading-chart__warn-dot" aria-hidden="true" />
              DRAWDOWN
            </span>
          ) : null}
          {isAtPeak ? (
            <span className="trading-chart__ath-badge" title="All-time high atteint sur cette fenêtre">
              <span aria-hidden="true">🎯</span> ATH
            </span>
          ) : null}
        </div>
        <div
          className="trading-chart__range-selector"
          role="tablist"
          aria-label="Fenêtre temporelle cumulative P&L"
        >
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              role="tab"
              className="trading-chart__range-btn"
              data-active={range === tf || undefined}
              onClick={() => setRange(tf)}
              aria-pressed={range === tf}
            >
              {tf}
            </button>
          ))}
        </div>
      </header>

      <div className="trading-chart__subheader">
        <div className="trading-chart__kpi">
          <span className="trading-chart__kpi-label">CUMUL CURRENT</span>
          <span className={`trading-chart__kpi-value trading-chart__kpi-value--${cumulTone}`}>
            {cumulSign}
            {fmtUsd(Math.abs(cumulCurrent))}
          </span>
        </div>
        <div className="trading-chart__kpi-divider" aria-hidden="true" />
        <div className="trading-chart__kpi">
          <span className="trading-chart__kpi-label">PEAK CUMUL</span>
          <span className="trading-chart__kpi-value trading-chart__kpi-value--mute">
            +{fmtUsd(peakCumul)}
          </span>
        </div>
        <div className="trading-chart__kpi-divider" aria-hidden="true" />
        <div className="trading-chart__kpi trading-chart__kpi--right">
          <span className="trading-chart__kpi-label">SLOPE / JOUR</span>
          <span className={`trading-chart__kpi-value trading-chart__kpi-value--${slopeTone}`}>
            {slopeSign}
            {fmtUsd(Math.abs(slopePerDay))}
          </span>
        </div>
      </div>

      <div className="trading-chart__body">
        {isEmpty ? (
          <ChartFallback message="Aucune activité" />
        ) : (
          <Suspense fallback={<ChartFallback message="Chargement…" />}>
            <LazyRecharts>
              {(R) => (
                // B3-PATCH — minWidth/minHeight évitent le warning recharts
                // "width(-1)" pendant la transition Suspense (LazyRecharts)
                // → parent grid pas encore dimensionné au premier paint.
                <R.ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <R.ComposedChart
                    data={cumulSeries}
                    margin={{ top: 8, right: 12, bottom: 8, left: 12 }}
                  >
                    <defs>
                      <linearGradient id="cumulGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={cumulColor} stopOpacity={0.32} />
                        <stop offset="100%" stopColor={cumulColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <R.CartesianGrid stroke={T.chart.grid} strokeDasharray="0" vertical={false} />
                    <R.XAxis
                      dataKey="date"
                      stroke={T.text.tertiary}
                      tick={{ fontFamily: T.fonts.mono, fontSize: 10, fill: T.text.tertiary }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={fmtAxisDate}
                      minTickGap={50}
                      height={20}
                    />
                    <R.YAxis
                      stroke={T.text.tertiary}
                      tick={{ fontFamily: T.fonts.mono, fontSize: 10, fill: T.text.tertiary }}
                      axisLine={false}
                      tickLine={false}
                      width={54}
                      tickFormatter={fmtAxisCumul}
                      domain={['auto', 'auto']}
                    />
                    <R.ReferenceLine
                      y={0}
                      stroke={T.text.tertiary}
                      strokeOpacity={0.4}
                      strokeDasharray="2 3"
                    />
                    {peakCumul > 0 ? (
                      <R.ReferenceLine
                        y={peakCumul}
                        stroke={T.warning}
                        strokeOpacity={0.45}
                        strokeDasharray="3 4"
                        label={{
                          value: `PEAK +$${Math.round(peakCumul)}`,
                          position: 'insideTopRight',
                          fill: T.text.tertiary,
                          fontSize: 10,
                          fontFamily: T.fonts.mono,
                        }}
                      />
                    ) : null}
                    <R.Area
                      dataKey="cumul"
                      type="monotone"
                      fill="url(#cumulGrad)"
                      stroke={cumulColor}
                      strokeWidth={2.2}
                      isAnimationActive={false}
                      activeDot={{ r: 4, fill: cumulColor, stroke: 'none' }}
                    />
                    <R.Tooltip
                      content={<CumulTooltip />}
                      cursor={{ stroke: T.text.tertiary, strokeDasharray: '2 3' }}
                      isAnimationActive={false}
                      allowEscapeViewBox={{ x: false, y: false }}
                      offset={20}
                      wrapperStyle={{ pointerEvents: 'none', maxWidth: 220, zIndex: 5 }}
                    />
                  </R.ComposedChart>
                </R.ResponsiveContainer>
              )}
            </LazyRecharts>
          </Suspense>
        )}
      </div>

      <footer className="trading-chart__footer">
        <div className="trading-chart__footer-cell">
          <span className="trading-chart__footer-label">BEST TRADE</span>
          <span className="trading-chart__footer-value trading-chart__footer-value--profit">
            {tradeExtremes.best
              ? `${tradeExtremes.best.ticker} +${fmtUsd(tradeExtremes.best.pnl)}`
              : '—'}
          </span>
        </div>
        <div className="trading-chart__footer-cell">
          <span className="trading-chart__footer-label">WORST TRADE</span>
          <span className="trading-chart__footer-value trading-chart__footer-value--loss">
            {tradeExtremes.worst
              ? `${tradeExtremes.worst.ticker} −${fmtUsd(Math.abs(tradeExtremes.worst.pnl))}`
              : '—'}
          </span>
        </div>
        <div className="trading-chart__footer-cell">
          <span className="trading-chart__footer-label">MAX DD CUMUL</span>
          <span
            className={`trading-chart__footer-value trading-chart__footer-value--${maxDDCumul > 0 ? 'loss' : 'mute'}`}
          >
            {maxDDCumul > 0 ? `−${fmtUsd(maxDDCumul)}` : '—'}
          </span>
        </div>
      </footer>
    </section>
  );
}
