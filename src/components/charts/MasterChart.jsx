// ═══════════════════════════════════════════════════════════════
//  MASTER CHART v4.0 — brick 3
//
//  Module bento col 1-6 row 1 (240 px). Trois layers visuels dans
//  un sub-pane 70 % / 30 % :
//    Top 70 % :
//      1. Underwater drawdown Area (loss-bg, axe Y dédié droit)
//      2. Peak watermark Line (text-tertiary, dashed 2 3, fin)
//      3. Equity Line (profit, strokeWidth 1.25, dot false)
//    Bottom 30 % :
//      4. Daily P&L Bar (fill profit/loss par signe)
//
//  Recharts via LazyRecharts (render-prop pattern) → la chunk
//  recharts (~150 kB gzip) est dynamic-imported uniquement si la
//  page du module monté est rendue.
//
//  Props-driven : data + dailyPnL + mode. Aucun useStore ici, le
//  module fonctionne identique sur /__playground (fixture) et sur
//  /dashboard (real store via les hooks useEquityHistory +
//  useDailyPnL passés par le parent).
//
//  Aucune animation Recharts (isAnimationActive=false). Pas
//  d'export, pas de zoom, pas de brush — scope brick 3 minimum.
// ═══════════════════════════════════════════════════════════════

import { Suspense, lazy, useMemo, useState } from 'react';
import useLiveTheme from '../../hooks/useLiveTheme';
import {
  TIMEFRAMES,
  computeUnderwaterCurve,
  computeDailyPnl,
  filterByTimeframe,
} from '../../utils/equity';

// Render-prop wrapper qui force le code-split sur 'recharts'. Même
// pattern qu'Analytics.jsx — TODO : extraire en src/components/
// charts/LazyRecharts.jsx quand un 3e consumer apparaît.
const LazyRecharts = lazy(() =>
  import('recharts').then((mod) => ({ default: ({ children }) => children(mod) }))
);

const fmtUsd = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    signDisplay: 'exceptZero',
  }).format(v);
};

const fmtPct = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(2)} %`;
};

const fmtAxisDate = (iso) => {
  // YYYY-MM-DD → DD/MM (compact pour axe X)
  if (!iso || typeof iso !== 'string') return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
};

function MasterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="master-chart__tooltip">
      <div className="master-chart__tooltip-date">{row.date}</div>
      <div className="master-chart__tooltip-row">
        <span>EQUITY</span>
        <span className="master-chart__tooltip-val">{fmtUsd(row.equity)}</span>
      </div>
      <div className="master-chart__tooltip-row">
        <span>PEAK</span>
        <span className="master-chart__tooltip-val">{fmtUsd(row.peak)}</span>
      </div>
      <div className="master-chart__tooltip-row">
        <span>DD</span>
        <span className={`master-chart__tooltip-val${row.underwaterPct < 0 ? ' is-loss' : ''}`}>
          {fmtPct(row.underwaterPct)}
        </span>
      </div>
      <div className="master-chart__tooltip-row">
        <span>DAILY</span>
        <span
          className={`master-chart__tooltip-val${
            row.dailyPnl > 0 ? ' is-profit' : row.dailyPnl < 0 ? ' is-loss' : ''
          }`}
        >
          {fmtUsd(row.dailyPnl)}
        </span>
      </div>
    </div>
  );
}

function ChartFallback({ message }) {
  return <div className="master-chart__empty">{message}</div>;
}

export default function MasterChart({ data, dailyPnL, mode = 'real', area = 'master' }) {
  const [range, setRange] = useState('ALL');
  // Brick 11 : useLiveTheme remplace l'import statique T pour
  // re-render le chart au changement de thème (event ibkr:theme-change).
  const T = useLiveTheme();

  // 1. Annoter avec running peak / underwater. 2. Merger dailyPnL si
  //    fourni, sinon dériver du diff. 3. Filtrer au timeframe choisi.
  //    Tout cohérent : la fixture (180 daily points) et le real store
  //    (per-trade-close points) traversent le même pipeline.
  const filtered = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    const withUnder = computeUnderwaterCurve(data);
    let merged;
    if (Array.isArray(dailyPnL) && dailyPnL.length) {
      const dpMap = new Map(dailyPnL.map((d) => [d.date, d.dailyPnl]));
      merged = withUnder.map((p) => ({ ...p, dailyPnl: dpMap.get(p.date) ?? 0 }));
    } else {
      merged = computeDailyPnl(withUnder);
    }
    return filterByTimeframe(merged, range);
  }, [data, dailyPnL, range]);

  const isEmpty = !filtered.length;
  const emptyMessage =
    mode === 'real'
      ? 'Aucun trade fermé · le graphique se peuplera dès le premier closing'
      : 'Fixture vide';

  return (
    <section className="module master-chart" style={{ gridArea: area }}>
      <header className="module-header">
        <span className="module-header__title">Equity · Drawdown · Daily P&amp;L</span>
        <div className="module-header__actions tf-pills">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              className="tf-pill"
              data-active={range === tf || undefined}
              onClick={() => setRange(tf)}
              aria-pressed={range === tf}
            >
              {tf}
            </button>
          ))}
        </div>
      </header>

      <div className="master-chart__body">
        {isEmpty ? (
          <ChartFallback message={emptyMessage} />
        ) : (
          <Suspense fallback={<ChartFallback message="Chargement…" />}>
            <LazyRecharts>
              {(R) => (
                <>
                  {/* TOP — equity + peak watermark + underwater area */}
                  <div className="master-chart__top">
                    <R.ResponsiveContainer width="100%" height="100%">
                      <R.ComposedChart
                        syncId="master"
                        data={filtered}
                        margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
                      >
                        <R.CartesianGrid
                          stroke={T.chart.grid}
                          strokeDasharray="0"
                          vertical={false}
                        />
                        <R.XAxis dataKey="date" hide />
                        <R.YAxis
                          yAxisId="equity"
                          orientation="left"
                          stroke={T.text.tertiary}
                          tick={{ fontFamily: T.fonts.mono, fontSize: 9, fill: T.text.tertiary }}
                          axisLine={false}
                          tickLine={false}
                          width={42}
                          tickFormatter={(v) => `${Math.round(v / 100) / 10}k`}
                        />
                        <R.YAxis
                          yAxisId="dd"
                          orientation="right"
                          stroke={T.text.tertiary}
                          tick={{ fontFamily: T.fonts.mono, fontSize: 9, fill: T.text.tertiary }}
                          axisLine={false}
                          tickLine={false}
                          width={32}
                          domain={['dataMin', 0]}
                          tickFormatter={(v) => `${v.toFixed(0)}%`}
                        />
                        <R.Area
                          yAxisId="dd"
                          dataKey="underwaterPct"
                          type="monotone"
                          fill={T.lossMuted}
                          stroke="none"
                          isAnimationActive={false}
                        />
                        <R.Line
                          yAxisId="equity"
                          dataKey="peak"
                          type="monotone"
                          stroke={T.text.tertiary}
                          strokeWidth={1}
                          strokeDasharray="2 3"
                          dot={false}
                          isAnimationActive={false}
                        />
                        <R.Line
                          yAxisId="equity"
                          dataKey="equity"
                          type="monotone"
                          stroke={T.profit}
                          strokeWidth={1.25}
                          dot={false}
                          activeDot={{ r: 3, fill: T.profit, stroke: 'none' }}
                          isAnimationActive={false}
                        />
                        <R.Tooltip
                          content={<MasterTooltip />}
                          cursor={{ stroke: T.text.tertiary, strokeDasharray: '2 3' }}
                          isAnimationActive={false}
                        />
                      </R.ComposedChart>
                    </R.ResponsiveContainer>
                  </div>

                  {/* BOTTOM — daily P&L bars */}
                  <div className="master-chart__bottom">
                    <R.ResponsiveContainer width="100%" height="100%">
                      <R.ComposedChart
                        syncId="master"
                        data={filtered}
                        margin={{ top: 2, right: 8, bottom: 16, left: 8 }}
                      >
                        <R.CartesianGrid
                          stroke={T.chart.grid}
                          strokeDasharray="0"
                          vertical={false}
                        />
                        <R.XAxis
                          dataKey="date"
                          stroke={T.text.tertiary}
                          tick={{ fontFamily: T.fonts.mono, fontSize: 9, fill: T.text.tertiary }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={fmtAxisDate}
                          minTickGap={40}
                          height={14}
                        />
                        <R.YAxis
                          stroke={T.text.tertiary}
                          tick={{ fontFamily: T.fonts.mono, fontSize: 9, fill: T.text.tertiary }}
                          axisLine={false}
                          tickLine={false}
                          width={42}
                          tickFormatter={(v) =>
                            Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : v
                          }
                        />
                        <R.ReferenceLine y={0} stroke={T.text.tertiary} strokeOpacity={0.3} />
                        <R.Bar dataKey="dailyPnl" isAnimationActive={false} maxBarSize={4}>
                          {filtered.map((entry, i) => (
                            <R.Cell
                              key={`bar-${i}`}
                              fill={entry.dailyPnl >= 0 ? T.profit : T.loss}
                            />
                          ))}
                        </R.Bar>
                        <R.Tooltip
                          content={<MasterTooltip />}
                          cursor={{ fill: 'transparent' }}
                          isAnimationActive={false}
                        />
                      </R.ComposedChart>
                    </R.ResponsiveContainer>
                  </div>
                </>
              )}
            </LazyRecharts>
          </Suspense>
        )}
      </div>
    </section>
  );
}
