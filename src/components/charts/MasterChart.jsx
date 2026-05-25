// ═══════════════════════════════════════════════════════════════
//  MASTER CHART v5 — Phase C.1 (sans drawdown)
//
//  Module bento col 1-7 row 1 (380 px). Deux sub-panes :
//    Top 70 % : Equity Line (profit color, strokeWidth 1.25)
//    Bottom 30 % : Daily P&L Bars (vert/rouge selon signe)
//
//  Suppression Phase C.1 :
//    - underwater drawdown area (axe Y droit + Area underwaterPct)
//    - peak watermark line (Line dashed sur top-pane)
//    - tooltip rows PEAK + DD
//    - import computeUnderwaterCurve
//
//  Le drawdown est désormais exclusivement consommé par RiskMatrix
//  (Bloomberg-dense table). Le master chart redevient un equity
//  + daily P&L pur, sans second axe ni surcouche.
//
//  Recharts via LazyRecharts (code-split). Aucune animation
//  (isAnimationActive=false). Pas d'export, pas de zoom.
// ═══════════════════════════════════════════════════════════════

import { Suspense, lazy, useMemo, useState } from 'react';
import useLiveTheme from '../../hooks/useLiveTheme';
import { TIMEFRAMES, computeDailyPnl, filterByTimeframe } from '../../utils/equity';

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
  const T = useLiveTheme();

  // Pipeline simplifié Phase C.1 : pas de computeUnderwaterCurve, on
  // merge directement le dailyPnL fourni avec equityHistory + on
  // filtre par timeframe.
  const filtered = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    let merged;
    if (Array.isArray(dailyPnL) && dailyPnL.length) {
      const dpMap = new Map(dailyPnL.map((d) => [d.date, d.dailyPnl]));
      merged = data.map((p) => ({ ...p, dailyPnl: dpMap.get(p.date) ?? 0 }));
    } else {
      merged = computeDailyPnl(data);
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
        <span className="module-header__title">Equity · Daily P&amp;L</span>
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
                  {/* TOP — equity line (pure, sans peak ni underwater) */}
                  <div className="master-chart__top">
                    <R.ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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
                    <R.ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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
                          minTickGap={60}
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
