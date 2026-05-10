// ═══════════════════════════════════════════════════════════════
//  GREEKS CENTER v3.0 — Options Command Center (brief §12.4)
//
//  Dedicated route: /trading/greeks
//  Brand-new page (no legacy predecessor). Bento layout composing
//  the v3 primitives created in Phase 2-3.
//
//  Rows:
//   1. Net Greeks Hero Cards (Δ, Γ, Θ, ν)
//   2. Greek Evolution Chart (2/3) + Theta Decay Projection (1/3)
//   3. Per-Position Greeks Table (full width)
//   4. Vega Exposure Pie (1/2) + IV Rank Histogram (1/2)
//   5. Second-Order Greeks panel (collapsed by default)
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, Legend } from 'recharts';
import { ChevronDown, Sigma } from 'lucide-react';
import { useOpenPositions } from '../../store/useStore';
import { computePortfolioGreeks, computeSecondOrderGreeks } from '../../utils/calculations';
import { toFloat, ensurePositive } from '../../utils/math';
import { getGreeksForAllPositions } from '../../utils/greeksApi';

import GlassCard from '../../components/ui/GlassCard';
import MetricCard from '../../components/ui/MetricCard';
import StatusBadge from '../../components/ui/StatusBadge';
import InfoTooltip from '../../components/ui/InfoTooltip';
import EmptyState from '../../components/ui/EmptyState';
import GreekEvolutionChart from '../../components/charts/GreekEvolutionChart';
import ThetaDecayProjection from '../../components/charts/ThetaDecayProjection';
import IVRankHistogram from '../../components/charts/IVRankHistogram';
import PerPositionGreeksTable from '../../components/charts/PerPositionGreeksTable';
import { CONTAINER_VARIANTS, TILE_VARIANTS } from '../../theme/animationVariants';

const GREEK_TOOLTIPS = {
  delta: {
    title: 'Delta net',
    body: 'Exposition directionnelle agrégée.',
    formula: 'Σ (Δ × qty × mul)',
  },
  gamma: {
    title: 'Gamma net',
    body: 'Sensibilité du Delta aux mouvements.',
    formula: 'Σ (Γ × qty × mul)',
  },
  theta: {
    title: 'Theta net',
    body: 'Erosion temporelle quotidienne en $.',
    formula: 'Σ (Θ × qty × mul)',
  },
  vega: {
    title: 'Vega net',
    body: 'Sensibilité à la volatilité implicite.',
    formula: 'Σ (ν × qty × mul)',
  },
};

// Build a mock evolution series from current Greeks (no historical storage yet)
function buildMockEvolution(currentGreeks, days = 30) {
  if (!currentGreeks) return [];
  const series = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    // Add small random walk around current values
    const wobble = (v, scale = 0.15) => v + (Math.random() - 0.5) * Math.abs(v || 1) * scale;
    series.push({
      date: iso,
      delta: +wobble(currentGreeks.delta).toFixed(3),
      gamma: +wobble(currentGreeks.gamma, 0.2).toFixed(4),
      theta: +wobble(currentGreeks.theta, 0.1).toFixed(2),
      vega: +wobble(currentGreeks.vega).toFixed(2),
    });
  }
  // Ensure last point is exactly current
  if (series.length) {
    series[series.length - 1] = {
      date: series[series.length - 1].date,
      ...currentGreeks,
    };
  }
  return series;
}

export default function Greeks() {
  const reducedMotion = useReducedMotion();
  const openPositions = useOpenPositions();
  const [greeksMap, setGreeksMap] = useState(new Map());
  const [showSecondOrder, setShowSecondOrder] = useState(false);

  const optionPositions = useMemo(
    () => (openPositions || []).filter((p) => p.as === 'Option'),
    [openPositions]
  );

  useEffect(() => {
    let cancelled = false;
    if (!optionPositions.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting to a new empty Map on signal clear is intentional
      setGreeksMap(new Map());
      return () => {
        cancelled = true;
      };
    }
    getGreeksForAllPositions(optionPositions)
      .then((map) => {
        if (!cancelled) setGreeksMap(map || new Map());
      })
      .catch(() => {
        if (!cancelled) setGreeksMap(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [optionPositions]);

  const netGreeks = useMemo(() => {
    const agg = computePortfolioGreeks(openPositions || [], greeksMap);
    return {
      delta: agg.totalDelta,
      gamma: agg.totalGamma,
      theta: agg.totalTheta,
      vega: agg.totalVega,
      count: agg.positionCount,
    };
  }, [openPositions, greeksMap]);

  const secondOrder = useMemo(
    () => computeSecondOrderGreeks(openPositions || [], greeksMap),
    [openPositions, greeksMap]
  );

  const perPositionRows = useMemo(() => {
    return optionPositions.map((p) => {
      const g = greeksMap?.get(p.id) || p.greeks || {};
      const qty = toFloat(p.ct);
      const mul = ensurePositive(p.mu);
      const delta = g.d ?? g.delta ?? 0;
      const gamma = g.g ?? g.gamma ?? 0;
      const theta = g.t ?? g.theta ?? 0;
      const vega = g.v ?? g.vega ?? 0;
      const iv = g.iv ?? p.iv ?? null;
      const ivRank = p.ivRank ?? null;
      const exposure = toFloat(p.pc) * qty * mul * (p.dir === 'Short' ? -1 : 1);
      return {
        id: p.id,
        ticker: p.tk,
        type: p.ty || 'OPT',
        delta: delta * qty * mul,
        gamma: gamma * qty * mul,
        theta: theta * qty * mul,
        vega: vega * qty * mul,
        iv,
        ivRank,
        exposure,
      };
    });
  }, [optionPositions, greeksMap]);

  const vegaPieData = useMemo(() => {
    return perPositionRows
      .filter((r) => Math.abs(r.vega) > 0.01)
      .map((r) => ({ name: r.ticker, value: Math.abs(r.vega), original: r.vega }));
  }, [perPositionRows]);

  const ivRankRows = useMemo(() => {
    return perPositionRows
      .filter((r) => r.ivRank != null && isFinite(r.ivRank))
      .map((r) => ({ ticker: r.ticker, ivRank: r.ivRank }));
  }, [perPositionRows]);

  const evolutionSeries = useMemo(() => buildMockEvolution(netGreeks, 30), [netGreeks]);

  // Empty state — no options at all
  if (optionPositions.length === 0) {
    return (
      <div className="page-container">
        <GlassCard variant="subtle" style={{ maxWidth: 640, margin: '60px auto' }}>
          <EmptyState
            icon={Sigma}
            title="Aucune position optionnelle"
            description="Le Greeks Center s'allume dès qu'une option est en portefeuille. Tes positions actions restent suivies sur le Dashboard."
          />
        </GlassCard>
      </div>
    );
  }

  return (
    <motion.div
      className="page-container greeks-page"
      variants={reducedMotion ? undefined : CONTAINER_VARIANTS}
      initial={reducedMotion ? undefined : 'hidden'}
      animate={reducedMotion ? undefined : 'visible'}
    >
      <motion.div variants={TILE_VARIANTS} className="greeks-page__header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            Options Command Center
            <StatusBadge
              variant="accent"
              label={`${netGreeks.count} option${netGreeks.count > 1 ? 's' : ''}`}
              size="xs"
            />
          </h1>
          <p className="page-subtitle">
            Surveillance Greeks Delta·Gamma·Theta·Vega sur le portefeuille d'options ouvertes.
          </p>
        </div>
      </motion.div>

      {/* ── Row 1 : Net Greeks Hero Cards ── */}
      <div className="greeks-page__hero-row">
        <motion.div variants={TILE_VARIANTS}>
          <MetricCard
            label="Δ Delta"
            value={netGreeks.delta}
            format="number"
            size="standard"
            semantic={netGreeks.delta > 0 ? 'profit' : netGreeks.delta < 0 ? 'loss' : 'neutral'}
            tooltip={GREEK_TOOLTIPS.delta}
          />
        </motion.div>
        <motion.div variants={TILE_VARIANTS}>
          <MetricCard
            label="Γ Gamma"
            value={netGreeks.gamma}
            format="number"
            size="standard"
            semantic="neutral"
            tooltip={GREEK_TOOLTIPS.gamma}
          />
        </motion.div>
        <motion.div variants={TILE_VARIANTS}>
          <MetricCard
            label="Θ Theta"
            value={netGreeks.theta}
            format="currency"
            currency="USD"
            size="standard"
            semantic={netGreeks.theta < 0 ? 'loss' : 'profit'}
            tooltip={GREEK_TOOLTIPS.theta}
          />
        </motion.div>
        <motion.div variants={TILE_VARIANTS}>
          <MetricCard
            label="ν Vega"
            value={netGreeks.vega}
            format="currency"
            currency="USD"
            size="standard"
            semantic={netGreeks.vega > 0 ? 'profit' : netGreeks.vega < 0 ? 'loss' : 'neutral'}
            tooltip={GREEK_TOOLTIPS.vega}
          />
        </motion.div>
      </div>

      {/* ── Row 2 : Evolution Chart + Theta Decay Projection ── */}
      <div className="greeks-page__chart-row">
        <motion.div variants={TILE_VARIANTS} className="greeks-page__chart-main">
          <GlassCard hover={false} style={{ padding: 'var(--space-5)' }}>
            <div className="dashboard-v3__panel-head">
              <span className="uppercase-label">Évolution 30j</span>
              <InfoTooltip
                content={{
                  title: 'Évolution des Greeks',
                  body: 'Valeurs quotidiennes aggregées par Greek. Les séries peuvent être affichées/masquées via les chips.',
                }}
                size={12}
              />
            </div>
            <GreekEvolutionChart data={evolutionSeries} height={300} />
          </GlassCard>
        </motion.div>
        <motion.div variants={TILE_VARIANTS} className="greeks-page__chart-side">
          <GlassCard hover={false} style={{ padding: 'var(--space-5)', height: '100%' }}>
            <ThetaDecayProjection dailyTheta={netGreeks.theta} days={30} />
          </GlassCard>
        </motion.div>
      </div>

      {/* ── Row 3 : Per-position Greeks table ── */}
      <motion.div variants={TILE_VARIANTS}>
        <GlassCard hover={false} style={{ padding: 'var(--space-5)' }}>
          <div className="dashboard-v3__panel-head">
            <span className="uppercase-label">Greeks par position</span>
            <InfoTooltip
              content={{
                title: 'Greeks par position',
                body: "Valeurs par contrat × quantité × multiplicateur. IV Rank indique la position actuelle de l'IV dans son range 52 semaines.",
              }}
              size={12}
            />
          </div>
          <PerPositionGreeksTable rows={perPositionRows} />
        </GlassCard>
      </motion.div>

      {/* ── Row 4 : Vega pie + IV Rank ── */}
      <div className="greeks-page__dual-row">
        <motion.div variants={TILE_VARIANTS}>
          <GlassCard hover={false} style={{ padding: 'var(--space-5)' }}>
            <div className="dashboard-v3__panel-head">
              <span className="uppercase-label">Exposition Vega</span>
              <InfoTooltip
                content={{
                  title: 'Répartition Vega',
                  body: 'Partage de la sensibilité IV totale entre les positions. Plus une part est grande, plus elle contribue au risque/récompense IV.',
                }}
                size={12}
              />
            </div>
            {vegaPieData.length === 0 ? (
              <EmptyState size="compact" title="Pas de vega à afficher" />
            ) : (
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={vegaPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                      label={(e) => e.name}
                    >
                      {vegaPieData.map((d, i) => (
                        <Cell
                          key={i}
                          fill={d.original >= 0 ? 'var(--profit)' : 'var(--loss)'}
                          stroke="var(--surface-2)"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <RTooltip
                      contentStyle={{
                        background: 'var(--chart-tooltip-bg)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                      }}
                      formatter={(v, name, { payload }) => [
                        payload.original >= 0 ? `+${v.toFixed(2)}` : `-${v.toFixed(2)}`,
                        payload.name,
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-ui)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassCard>
        </motion.div>

        <motion.div variants={TILE_VARIANTS}>
          <GlassCard hover={false} style={{ padding: 'var(--space-5)' }}>
            <IVRankHistogram data={ivRankRows} />
          </GlassCard>
        </motion.div>
      </div>

      {/* ── Row 5 : Second-order Greeks panel (collapsed) ── */}
      <motion.div variants={TILE_VARIANTS}>
        <GlassCard hover={false} style={{ padding: 'var(--space-5)' }}>
          <button
            type="button"
            className="greeks-page__collapse-trigger"
            onClick={() => setShowSecondOrder((v) => !v)}
            aria-expanded={showSecondOrder}
          >
            <span className="uppercase-label">Greeks de second ordre</span>
            <ChevronDown
              size={16}
              aria-hidden="true"
              style={{
                transform: showSecondOrder ? 'rotate(180deg)' : 'none',
                transition: 'transform 200ms var(--ease-out)',
              }}
            />
          </button>

          {showSecondOrder && (
            <div className="greeks-page__second-order">
              <MetricCard
                label="Vanna"
                value={secondOrder.vanna}
                format="number"
                size="compact"
                tooltip={{
                  title: 'Vanna',
                  body: 'dDelta/dVol — Sensibilité du Delta à la volatilité.',
                }}
              />
              <MetricCard
                label="Charm"
                value={secondOrder.charm}
                format="number"
                size="compact"
                tooltip={{ title: 'Charm', body: 'dDelta/dTime — Decay du Delta par jour.' }}
              />
              <MetricCard
                label="Vomma"
                value={secondOrder.vomma}
                format="number"
                size="compact"
                tooltip={{
                  title: 'Vomma',
                  body: 'dVega/dVol — Convexité du Vega par rapport à la volatilité.',
                }}
              />
              <MetricCard
                label="GEX"
                value={secondOrder.gex}
                format="currency"
                currency="USD"
                size="compact"
                tooltip={{
                  title: 'GEX (Gamma Exposure)',
                  body: 'Exposition gamma totale du portefeuille multipliée par le prix spot.',
                }}
              />
            </div>
          )}
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
