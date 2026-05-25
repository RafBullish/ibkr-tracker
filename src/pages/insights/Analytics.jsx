// ═══════════════════════════════════════════════════════════════
//  ANALYTICS v3.0 « Midnight Terminal »
//  /insights/analytics
//
//  Post-trade deep analytics per brief §12.6. Retires @uiw/react-
//  heat-map by swapping the year heatmap to the v3 PnLCalendar
//  Heatmap mode='year'.
// ═══════════════════════════════════════════════════════════════

import { lazy, Suspense, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BarChart3,
  Target,
  Shield,
  TrendingUp,
  Zap,
  Percent,
  Clock,
  CalendarDays,
} from 'lucide-react';
import { useClosedTrades, useSettings } from '../../store/useStore';
import { tradePnlUsd } from '../../utils/calculations';
import { useTradingMetrics } from '../../hooks/useTradingMetrics';
// A1 — Calmar is no longer emitted by useTradingMetrics (the hook does
// not receive the initialCapital / yearsActive inputs needed to compute
// CAGR). Pull it from the canonical single-source pipeline instead.
import { usePortfolioMetrics } from '../../hooks/usePortfolioMetrics';
import { holdingDays } from '../../utils/dates';
import { toFloat } from '../../utils/math';

import GlassCard from '../../components/ui/GlassCard';
import MetricCard from '../../components/ui/MetricCard';
import StatusBadge from '../../components/ui/StatusBadge';
import InfoTooltip from '../../components/ui/InfoTooltip';
import EmptyState from '../../components/ui/EmptyState';
import WinRateDonut from '../../components/ui/WinRateDonut';
import PnLCalendarHeatmap from '../../components/charts/PnLCalendarHeatmap';
import RiskMetricsRow from '../../components/charts/RiskMetricsRow';
import { CONTAINER_VARIANTS, TILE_VARIANTS } from '../../theme/animationVariants';

const LazyStrategyBreakdown = lazy(() => import('../../components/charts/StrategyBreakdown'));
const LazyRecharts = lazy(() =>
  import('recharts').then((mod) => ({ default: ({ children }) => children(mod) }))
);

// ── Hour-of-day aggregation
function aggregateHourOfDay(closedTrades, lr) {
  const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, pnl: 0 }));
  for (const t of closedTrades) {
    if (!t.do) continue;
    try {
      const d = new Date(t.do + 'T12:00:00');
      const hour = d.getHours();
      buckets[hour].count++;
      buckets[hour].pnl += tradePnlUsd(t, lr);
    } catch {
      /* ignore malformed date */
    }
  }
  return buckets;
}

function aggregateDayOfWeek(closedTrades, lr) {
  const days = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
  const buckets = Array.from({ length: 7 }, (_, d) => ({ day: days[d], count: 0, pnl: 0 }));
  for (const t of closedTrades) {
    if (!t.do) continue;
    try {
      const d = new Date(t.do + 'T12:00:00');
      const dayIdx = d.getDay();
      buckets[dayIdx].count++;
      buckets[dayIdx].pnl += tradePnlUsd(t, lr);
    } catch {
      /* ignore malformed date */
    }
  }
  return buckets;
}

function buildDayPnlMap(closedTrades, lr) {
  const map = {};
  for (const t of closedTrades) {
    if (!t.do) continue;
    const pnl = tradePnlUsd(t, lr);
    if (!Number.isFinite(pnl)) continue;
    map[t.do] = (map[t.do] || 0) + pnl;
  }
  return map;
}

function HourChart({ data }) {
  return (
    <Suspense fallback={<div style={{ height: 240 }} />}>
      <LazyRecharts>
        {(mod) => (
          <div style={{ height: 240 }}>
            <mod.ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <mod.BarChart data={data} margin={{ top: 10, right: 16, left: 4, bottom: 4 }}>
                <mod.CartesianGrid
                  vertical={false}
                  stroke="var(--border-subtle)"
                  strokeDasharray="3 3"
                />
                <mod.XAxis
                  dataKey="hour"
                  tickFormatter={(h) => `${h}h`}
                  tick={{
                    fill: 'var(--text-tertiary)',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                  }}
                  axisLine={false}
                  tickLine={false}
                  interval={3}
                />
                <mod.YAxis
                  tick={{
                    fill: 'var(--text-tertiary)',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                />
                <mod.Tooltip
                  contentStyle={{
                    background: 'var(--chart-tooltip-bg)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                  }}
                  formatter={(v, k) => (k === 'pnl' ? [`$${v.toFixed(0)}`, 'P&L'] : [v, 'Trades'])}
                  labelFormatter={(v) => `${v}h00`}
                />
                <mod.Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {data.map((d, i) => (
                    <mod.Cell key={i} fill={d.pnl >= 0 ? 'var(--profit)' : 'var(--loss)'} />
                  ))}
                </mod.Bar>
              </mod.BarChart>
            </mod.ResponsiveContainer>
          </div>
        )}
      </LazyRecharts>
    </Suspense>
  );
}

function DayChart({ data }) {
  return (
    <Suspense fallback={<div style={{ height: 240 }} />}>
      <LazyRecharts>
        {(mod) => (
          <div style={{ height: 240 }}>
            <mod.ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <mod.BarChart data={data} margin={{ top: 10, right: 16, left: 4, bottom: 4 }}>
                <mod.CartesianGrid
                  vertical={false}
                  stroke="var(--border-subtle)"
                  strokeDasharray="3 3"
                />
                <mod.XAxis
                  dataKey="day"
                  tick={{
                    fill: 'var(--text-tertiary)',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <mod.YAxis
                  tick={{
                    fill: 'var(--text-tertiary)',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                />
                <mod.Tooltip
                  contentStyle={{
                    background: 'var(--chart-tooltip-bg)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                  }}
                  formatter={(v, k) => (k === 'pnl' ? [`$${v.toFixed(0)}`, 'P&L'] : [v, 'Trades'])}
                />
                <mod.Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {data.map((d, i) => (
                    <mod.Cell key={i} fill={d.pnl >= 0 ? 'var(--profit)' : 'var(--loss)'} />
                  ))}
                </mod.Bar>
              </mod.BarChart>
            </mod.ResponsiveContainer>
          </div>
        )}
      </LazyRecharts>
    </Suspense>
  );
}

export default function Analytics() {
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();

  const rawClosedTrades = useClosedTrades();
  const settings = useSettings();
  const lr = toFloat(settings?.liveRate) || 1;
  // Memoize the array reference so downstream useMemos get a stable identity
  // (zustand selector returns a stable ref, but the `|| []` fallback breaks
  // that guarantee on every render).
  const closedTrades = useMemo(() => rawClosedTrades || [], [rawClosedTrades]);

  const metrics = useTradingMetrics(closedTrades, lr);
  // A1 — Calmar source : portfolio-level metrics (needs initialCapital).
  const portfolioMetrics = usePortfolioMetrics();
  const hourData = useMemo(() => aggregateHourOfDay(closedTrades, lr), [closedTrades, lr]);
  const dayData = useMemo(() => aggregateDayOfWeek(closedTrades, lr), [closedTrades, lr]);
  const dayMap = useMemo(() => buildDayPnlMap(closedTrades, lr), [closedTrades, lr]);
  const avgHold = useMemo(() => {
    const withDur = closedTrades.filter((t) => t.di && t.do);
    if (!withDur.length) return null;
    const sum = withDur.reduce((s, t) => s + holdingDays(t.di, t.do), 0);
    return Math.round(sum / withDur.length);
  }, [closedTrades]);

  if (closedTrades.length === 0) {
    return (
      <div className="page-container">
        <GlassCard variant="subtle" style={{ maxWidth: 640, margin: '60px auto' }}>
          <EmptyState
            icon={BarChart3}
            title="Aucune analyse disponible"
            description="Les métriques de performance et la heatmap calendaire apparaissent dès qu'il y a des trades fermés."
            actions={[
              {
                label: 'Importer un CSV Flex',
                onClick: () => navigate('/settings/import'),
                variant: 'primary',
              },
              {
                label: 'Ajouter un trade manuel',
                onClick: () => navigate('/trading/history'),
                variant: 'secondary',
              },
            ]}
          />
        </GlassCard>
      </div>
    );
  }

  return (
    <motion.div
      className="page-container analytics-v3"
      variants={reducedMotion ? undefined : CONTAINER_VARIANTS}
      initial={reducedMotion ? undefined : 'hidden'}
      animate={reducedMotion ? undefined : 'visible'}
    >
      <motion.div variants={TILE_VARIANTS} className="page-header">
        <div>
          <h1 className="page-title">
            <BarChart3 size={18} aria-hidden="true" />
            Analytics
            <StatusBadge variant="accent" label={`${closedTrades.length} trades`} size="xs" />
          </h1>
          <p className="page-subtitle">
            Analyse post-trade : ratios risque-ajustés, distribution temporelle, heatmap annuelle.
          </p>
        </div>
      </motion.div>

      {/* ── Row 1 : Risk-Adjusted Performance (6 compact KPIs) ── */}
      <motion.div variants={TILE_VARIANTS}>
        <GlassCard hover={false} style={{ padding: 'var(--space-5)' }}>
          <div className="dashboard-v3__panel-head">
            <Shield size={14} aria-hidden="true" style={{ color: 'var(--text-tertiary)' }} />
            <span className="uppercase-label">Performance risque-ajustée</span>
            <InfoTooltip
              content={{
                title: 'Performance risque-ajustée',
                body: 'Ratios normalisant le rendement par unité de risque. Sharpe et Sortino sont cappés à [-5, +10] affichage.',
              }}
              size={12}
            />
          </div>
          <RiskMetricsRow
            metrics={{
              expectancy: metrics ? metrics.expectancy / Math.max(Math.abs(metrics.avgLoss), 1) : 0,
              // A2a — Sharpe / Sortino / Calmar all sourced from the
              // canonical pipeline (returns-based, gated). useTradingMetrics
              // doesn't have the capital / years inputs needed to compute
              // them, so they're null at that layer.
              sortino: portfolioMetrics?.sortinoRatio ?? null,
              calmar: portfolioMetrics?.calmarRatio ?? null,
              sharpe: portfolioMetrics?.sharpeRatio ?? null,
              profitFactor: metrics?.profitFactor ?? 0,
              winRate: metrics?.winRate ?? 0,
            }}
          />
        </GlassCard>
      </motion.div>

      {/* ── Row 2 : Secondary KPIs (Omega, Kelly, Avg Hold, Max DD) ── */}
      <motion.div variants={TILE_VARIANTS} className="analytics-v3__kpi-row">
        <MetricCard
          label="Omega"
          value={metrics?.omega === Infinity ? 999 : metrics?.omega}
          format="number"
          size="compact"
          icon={TrendingUp}
          tooltip={{
            title: 'Omega Ratio',
            body: 'Σ gains / Σ |pertes|. >1 = rentable brut. 2 = chaque dollar perdu rapporte 2 dollars en gain.',
            formula: 'Σ gains / Σ |pertes|',
          }}
          semantic={metrics?.omega > 1.5 ? 'profit' : metrics?.omega < 1 ? 'loss' : 'neutral'}
        />
        <MetricCard
          label="Kelly %"
          value={metrics?.kellyPct}
          format="percent"
          size="compact"
          icon={Zap}
          tooltip={{
            title: 'Kelly Criterion',
            body: 'Part optimale du capital à risquer par trade pour maximiser le taux de croissance log. >20% = agressif, >50% = imprudent.',
            formula: 'winRate − (1-winRate) × (avgLoss/avgWin)',
          }}
          semantic={metrics?.kellyPct > 25 ? 'profit' : metrics?.kellyPct < 0 ? 'loss' : 'neutral'}
        />
        <MetricCard
          label="Avg Hold"
          value={avgHold}
          format="number"
          size="compact"
          icon={Clock}
          tooltip={{
            title: 'Durée moyenne de détention',
            body: 'Nombre de jours moyen entre open et close. Indicateur de style (swing, position, day-trading).',
          }}
        />
        <MetricCard
          label="Max Drawdown"
          value={metrics?.maxDrawdown}
          format="currency"
          currency="USD"
          size="compact"
          icon={Target}
          semantic="loss"
          tooltip={{
            title: 'Max Drawdown',
            body: "Pire perte cumulative historique depuis un pic d'équité.",
          }}
        />
      </motion.div>

      {/* ── Row 3 : Hour-of-Day + Day-of-Week ── */}
      <motion.div variants={TILE_VARIANTS} className="analytics-v3__dual-row">
        <GlassCard hover={false} style={{ padding: 'var(--space-5)' }}>
          <div className="dashboard-v3__panel-head">
            <span className="uppercase-label">P&amp;L par heure</span>
            <InfoTooltip
              content={{
                title: 'Hour-of-Day P&L',
                body: 'P&L agrégé par heure de clôture. Révèle tes meilleures et pires fenêtres horaires.',
              }}
              size={12}
            />
          </div>
          <HourChart data={hourData} />
        </GlassCard>
        <GlassCard hover={false} style={{ padding: 'var(--space-5)' }}>
          <div className="dashboard-v3__panel-head">
            <span className="uppercase-label">P&amp;L par jour de la semaine</span>
            <InfoTooltip
              content={{
                title: 'Day-of-Week P&L',
                body: 'P&L agrégé par jour de la semaine. Utile pour détecter des biais (Friday slump, Monday open gap).',
              }}
              size={12}
            />
          </div>
          <DayChart data={dayData} />
        </GlassCard>
      </motion.div>

      {/* ── Row 4 : Win/Loss breakdown + Strategy ── */}
      <motion.div variants={TILE_VARIANTS} className="analytics-v3__dual-row">
        <GlassCard hover={false} style={{ padding: 'var(--space-5)' }}>
          <div className="dashboard-v3__panel-head">
            <Percent size={14} aria-hidden="true" style={{ color: 'var(--text-tertiary)' }} />
            <span className="uppercase-label">Répartition gagnants / perdants</span>
          </div>
          <WinRateDonut winRate={metrics?.winRate ?? null} />
        </GlassCard>
        <GlassCard hover={false} style={{ padding: 'var(--space-5)' }}>
          <div className="dashboard-v3__panel-head">
            <span className="uppercase-label">Breakdown par stratégie</span>
            <InfoTooltip
              content={{
                title: 'Breakdown par stratégie',
                body: 'Performance par tag de stratégie (Sniper OTM, Swing, Event, etc.) si renseigné dans les trades.',
              }}
              size={12}
            />
          </div>
          <Suspense fallback={<div style={{ height: 240 }} />}>
            <LazyStrategyBreakdown closedTrades={closedTrades} liveRate={lr} />
          </Suspense>
        </GlassCard>
      </motion.div>

      {/* ── Row 5 : Year P&L heatmap via PnLCalendarHeatmap (retire @uiw) ── */}
      <motion.div variants={TILE_VARIANTS}>
        <GlassCard hover={false} style={{ padding: 'var(--space-5)' }}>
          <div className="dashboard-v3__panel-head">
            <CalendarDays size={14} aria-hidden="true" style={{ color: 'var(--text-tertiary)' }} />
            <span className="uppercase-label">Heatmap P&amp;L annuelle</span>
            <InfoTooltip
              content={{
                title: 'Heatmap annuelle',
                body: "P&L cumulé par jour sur l'année courante. Permet d'identifier les streaks, les gaps d'activité, et la saisonnalité.",
              }}
              size={12}
            />
          </div>
          <PnLCalendarHeatmap dayPnlMap={dayMap} mode="year" currency="USD" />
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
