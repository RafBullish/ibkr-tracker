// ═══════════════════════════════════════════════════════════════
//  VOLATILITY SKEW v4 brick 8 — module col 4-6 row 4 (200 px)
//
//  3 lignes term structure SPX :
//    1. Skew 25Δ : (put 25Δ IV − call 25Δ IV) par DTE — warning
//    2. ATM IV   : at-the-money IV par DTE             — accent
//    3. VVIX     : vol of vol (line plate)             — info
//
//  LazyRecharts pattern (réutilise l'inline wrapper de MasterChart
//  brick 3). Pas de dot, pas d'area, pas de grid au-delà de l'X-axis
//  ticks.
// ═══════════════════════════════════════════════════════════════

import { Suspense, lazy } from 'react';
import useLiveTheme from '../../hooks/useLiveTheme';

const LazyRecharts = lazy(() =>
  import('recharts').then((mod) => ({ default: ({ children }) => children(mod) }))
);

// Brick 11 : SERIES est désormais build à chaque render avec le
// theme live (useLiveTheme), pour permettre le re-paint sur theme
// switch sans reload.
const buildSeries = (T) => [
  { key: 'skew25d', label: 'Skew 25Δ', stroke: T.warning || '#F0B90B' },
  { key: 'atmIv', label: 'ATM IV', stroke: T.accent.main },
  { key: 'vvix', label: 'VVIX', stroke: T.info },
];

function makeTooltip(series) {
  return function VolSkewTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload || {};
    return (
      <div className="master-chart__tooltip">
        <div className="master-chart__tooltip-date">{label} DTE</div>
        <div className="master-chart__tooltip-row">
          <span>Skew 25Δ</span>
          <span className="master-chart__tooltip-val" style={{ color: series[0].stroke }}>
            {row.skew25d != null ? row.skew25d.toFixed(2) : '—'}
          </span>
        </div>
        <div className="master-chart__tooltip-row">
          <span>ATM IV</span>
          <span className="master-chart__tooltip-val" style={{ color: series[1].stroke }}>
            {row.atmIv != null ? `${row.atmIv.toFixed(1)} %` : '—'}
          </span>
        </div>
        <div className="master-chart__tooltip-row">
          <span>VVIX</span>
          <span className="master-chart__tooltip-val" style={{ color: series[2].stroke }}>
            {row.vvix != null ? row.vvix.toFixed(0) : '—'}
          </span>
        </div>
      </div>
    );
  };
}

function ChartFallback({ message }) {
  return <div className="vol-skew__empty">{message}</div>;
}

function Legend({ series }) {
  return (
    <div className="vol-skew__legend">
      {series.map((s) => (
        <span key={s.key} className="vol-skew__legend-item">
          <span className="vol-skew__legend-dot" style={{ background: s.stroke }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export default function VolatilitySkew({ data, area = 'skew' }) {
  const T = useLiveTheme();
  const series = buildSeries(T);
  const Tooltip = makeTooltip(series);
  const points = Array.isArray(data) ? data : [];
  const isEmpty = points.length === 0;

  return (
    <section className="module vol-skew" style={{ gridArea: area }}>
      <header className="module-header">
        <span className="module-header__title">SPX Vol Term Structure</span>
        <span className="module-header__hint">30D</span>
      </header>
      <div className="module-body vol-skew__body">
        {isEmpty ? (
          <ChartFallback message="Pas de données SPX vol skew" />
        ) : (
          <>
            <Legend series={series} />
            <div className="vol-skew__chart">
              <Suspense fallback={<ChartFallback message="Chargement…" />}>
                <LazyRecharts>
                  {(R) => (
                    <R.ResponsiveContainer width="100%" height="100%">
                      <R.LineChart data={points} margin={{ top: 4, right: 8, bottom: 16, left: 8 }}>
                        <R.CartesianGrid
                          stroke={T.chart.grid}
                          strokeDasharray="0"
                          vertical={false}
                        />
                        <R.XAxis
                          dataKey="dte"
                          stroke={T.text.tertiary}
                          tick={{ fontFamily: T.fonts.mono, fontSize: 9, fill: T.text.tertiary }}
                          axisLine={false}
                          tickLine={false}
                          height={14}
                          tickFormatter={(v) => `${v}d`}
                        />
                        <R.YAxis
                          stroke={T.text.tertiary}
                          tick={{ fontFamily: T.fonts.mono, fontSize: 9, fill: T.text.tertiary }}
                          axisLine={false}
                          tickLine={false}
                          width={32}
                        />
                        {series.map((s) => (
                          <R.Line
                            key={s.key}
                            type="monotone"
                            dataKey={s.key}
                            stroke={s.stroke}
                            strokeWidth={1}
                            dot={false}
                            isAnimationActive={false}
                          />
                        ))}
                        <R.Tooltip
                          content={<Tooltip />}
                          cursor={{ stroke: T.text.tertiary, strokeDasharray: '2 3' }}
                          isAnimationActive={false}
                        />
                      </R.LineChart>
                    </R.ResponsiveContainer>
                  )}
                </LazyRecharts>
              </Suspense>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
