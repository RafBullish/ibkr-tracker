// ═══════════════════════════════════════════════════════════════
//  EQUITY CHART v1 — 4K refonte Phase C.1.7 (split MasterChart)
//
//  Module bento row 1 col 1-3 (480 px). Equity curve pure :
//    - Area gradient profit-tinted
//    - Range selector 6 segments (5D / 1M / 3M / YTD / 1Y / ALL)
//    - Sub-header CURRENT / PEAK {range} / Δ {range}
//    - Footer HIGH ALL / LOW ALL / PEAK Δ (toujours all-time)
//    - Reference line à y=0 si la série couvre +/-
//    - Reference line à firstEquity (watermark entrée range)
//
//  Pattern unifié `.trading-chart` partagé avec DailyPnLChart.
//  LazyRecharts pour le code-split (~150 kB gzip recharts).
//
//  Props :
//    data : Array<{date, equity}> — equityHistory (peut être vide)
//    area : grid-area string
// ═══════════════════════════════════════════════════════════════

import { Suspense, lazy, useMemo, useState } from 'react';
import useLiveTheme from '../../hooks/useLiveTheme';
import { TIMEFRAMES, filterByTimeframe } from '../../utils/equity';

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

const fmtUsdSigned = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    signDisplay: 'exceptZero',
  }).format(v);
};

const fmtAxisDate = (iso) => {
  if (!iso || typeof iso !== 'string') return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
};

const fmtAxisUsd = (v) => {
  if (!Number.isFinite(v)) return '';
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${Math.round(v)}`;
};

function EquityTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="trading-chart__tooltip">
      <div className="trading-chart__tooltip-date">{row.date}</div>
      <div className="trading-chart__tooltip-row">
        <span>EQUITY</span>
        <span className="trading-chart__tooltip-val">{fmtUsd(row.equity)}</span>
      </div>
    </div>
  );
}

function ChartFallback({ message }) {
  return <div className="trading-chart__empty">{message}</div>;
}

export default function EquityChart({
  data,
  range: controlledRange,
  onRangeChange,
  area = 'equity',
}) {
  // B3 — pattern hybride : range/onRangeChange en props = controlled,
  // sinon useState local = uncontrolled (back-compat).
  const [localRange, setLocalRange] = useState('ALL');
  const range = controlledRange !== undefined ? controlledRange : localRange;
  const setRange = onRangeChange || setLocalRange;
  const T = useLiveTheme();

  const safeData = Array.isArray(data) ? data : [];

  // Pipeline simple — filtre la série equity par timeframe.
  const filtered = useMemo(() => filterByTimeframe(safeData, range), [safeData, range]);

  const isEmpty = filtered.length === 0;

  // ─── Dérivations ────────────────────────────────────────────
  const currentEquity = useMemo(() => {
    if (filtered.length === 0) return 0;
    return filtered[filtered.length - 1].equity;
  }, [filtered]);

  const firstEquity = useMemo(() => {
    if (filtered.length === 0) return 0;
    return filtered[0].equity;
  }, [filtered]);

  const peakInRange = useMemo(() => {
    if (filtered.length === 0) return 0;
    return Math.max(...filtered.map((p) => p.equity));
  }, [filtered]);

  const rangeDelta = currentEquity - firstEquity;
  // Phase C.1.8 polish — clamp le pct quand firstEquity proche de 0
  // (premier point d'une courbe cumulative). Au-delà de 1000 %, le
  // ratio devient mathématiquement correct mais visuellement noise.
  const rawPct = firstEquity !== 0 ? (rangeDelta / Math.abs(firstEquity)) * 100 : null;
  const showPct = rawPct !== null && Number.isFinite(rawPct) && Math.abs(rawPct) < 1000;
  const rangePct = showPct ? rawPct : null;
  const deltaTone = rangeDelta > 0 ? 'profit' : rangeDelta < 0 ? 'loss' : 'mute';
  const deltaSign = rangeDelta > 0 ? '+' : rangeDelta < 0 ? '−' : '';
  const deltaPctSign = rangePct != null && rangePct > 0 ? '+' : rangePct != null && rangePct < 0 ? '−' : '';

  const hasZeroCross = useMemo(() => {
    if (filtered.length === 0) return false;
    const vals = filtered.map((p) => p.equity);
    return Math.min(...vals) < 0 && Math.max(...vals) > 0;
  }, [filtered]);

  // ─── All-time stats (indépendants du range) ─────────────────
  const highAll = useMemo(() => {
    if (safeData.length === 0) return 0;
    return Math.max(...safeData.map((p) => p.equity));
  }, [safeData]);

  const lowAll = useMemo(() => {
    if (safeData.length === 0) return 0;
    return Math.min(...safeData.map((p) => p.equity));
  }, [safeData]);

  // PEAK Δ : gain max all-time vs premier point (capital de départ
  // approximé par equityHistory[0]).
  const peakDelta = useMemo(() => {
    if (safeData.length === 0) return 0;
    return highAll - safeData[0].equity;
  }, [safeData, highAll]);
  const peakDeltaTone = peakDelta > 0 ? 'profit' : peakDelta < 0 ? 'loss' : 'mute';
  const peakDeltaSign = peakDelta > 0 ? '+' : peakDelta < 0 ? '−' : '';

  const firstDate = safeData[0]?.date || '—';
  const lastDate = safeData[safeData.length - 1]?.date || '—';

  return (
    <section className="trading-chart equity-chart" style={{ gridArea: area }}>
      <header className="trading-chart__header">
        <div className="trading-chart__title-wrap">
          <span className="trading-chart__title">Equity Curve</span>
          <span className="trading-chart__sub">
            {firstDate} → {lastDate}
          </span>
        </div>
        <div className="trading-chart__range-selector" role="tablist" aria-label="Fenêtre temporelle equity">
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
          <span className="trading-chart__kpi-label">CURRENT</span>
          <span className="trading-chart__kpi-value">{fmtUsd(currentEquity)}</span>
        </div>
        <div className="trading-chart__kpi-divider" aria-hidden="true" />
        <div className="trading-chart__kpi">
          <span className="trading-chart__kpi-label">PEAK {range}</span>
          <span className="trading-chart__kpi-value trading-chart__kpi-value--mute">
            {fmtUsd(peakInRange)}
          </span>
        </div>
        <div className="trading-chart__kpi-divider" aria-hidden="true" />
        <div className="trading-chart__kpi trading-chart__kpi--right">
          <span className="trading-chart__kpi-label">Δ {range}</span>
          <span className={`trading-chart__kpi-value trading-chart__kpi-value--${deltaTone}`}>
            {deltaSign}
            {fmtUsd(Math.abs(rangeDelta))}
            {rangePct != null ? (
              <>
                {' '}
                ({deltaPctSign}
                {Math.abs(rangePct).toFixed(2)}%)
              </>
            ) : null}
          </span>
        </div>
      </div>

      <div className="trading-chart__body">
        {isEmpty ? (
          <ChartFallback message="Aucun trade fermé" />
        ) : (
          <Suspense fallback={<ChartFallback message="Chargement…" />}>
            <LazyRecharts>
              {(R) => (
                // B3-PATCH — minWidth/minHeight évitent le warning recharts
                // "width(-1)" pendant la transition Suspense (LazyRecharts)
                // → parent grid pas encore dimensionné au premier paint.
                <R.ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <R.ComposedChart
                    data={filtered}
                    margin={{ top: 8, right: 12, bottom: 8, left: 12 }}
                  >
                    <defs>
                      <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={T.profit} stopOpacity={0.32} />
                        <stop offset="100%" stopColor={T.profit} stopOpacity={0} />
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
                      tickFormatter={fmtAxisUsd}
                      domain={['dataMin - 50', 'dataMax + 50']}
                    />
                    {hasZeroCross ? (
                      <R.ReferenceLine
                        y={0}
                        stroke={T.text.tertiary}
                        strokeOpacity={0.3}
                        strokeDasharray="2 3"
                      />
                    ) : null}
                    <R.ReferenceLine
                      y={firstEquity}
                      stroke={T.text.tertiary}
                      strokeOpacity={0.15}
                      strokeDasharray="2 3"
                    />
                    <R.Area
                      dataKey="equity"
                      type="monotone"
                      fill="url(#equityGrad)"
                      stroke={T.profit}
                      strokeWidth={2}
                      isAnimationActive={false}
                      activeDot={{ r: 4, fill: T.profit, stroke: 'none' }}
                    />
                    <R.Tooltip
                      content={<EquityTooltip />}
                      cursor={{ stroke: T.text.tertiary, strokeDasharray: '2 3' }}
                      isAnimationActive={false}
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
          <span className="trading-chart__footer-label">HIGH ALL</span>
          <span className="trading-chart__footer-value">{fmtUsd(highAll)}</span>
        </div>
        <div className="trading-chart__footer-cell">
          <span className="trading-chart__footer-label">LOW ALL</span>
          <span className="trading-chart__footer-value">{fmtUsd(lowAll)}</span>
        </div>
        <div className="trading-chart__footer-cell">
          <span className="trading-chart__footer-label">ATH GAIN</span>
          <span
            className={`trading-chart__footer-value trading-chart__footer-value--${peakDeltaTone}`}
          >
            {peakDeltaSign}
            {fmtUsd(Math.abs(peakDelta))}
          </span>
        </div>
      </footer>
    </section>
  );
}
