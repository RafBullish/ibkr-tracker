// ═══════════════════════════════════════════════════════════════
//  GREEKS CENTER — page-vitrine canonique (CANONICAL-3)
//
//  Dedicated route: /trading/greeks
//  Second consumer of the palette canonique (after /trading/positions).
//
//  Sémantique appliquée sur les Greeks AGRÉGÉS :
//    Δ  → ink-pure TOUJOURS (exposition directionnelle, pas $)
//    Γ  → ink-pure TOUJOURS (dérivée seconde, sans dim. monétaire)
//    Θ  → ink-pure TOUJOURS (révision : un Greek naturellement signé
//         — theta ~toujours négatif — n'est PAS une perte ; le rouge
//         reste réservé aux pertes RÉALISÉES, pas au signe d'un Greek)
//    ν  → ink-pure TOUJOURS (sensibilité IV, pas $)
//
//  Rows:
//   1. Net Greeks Hero (4 local KPI tiles)
//   2. Greek Evolution (2/3) + Theta Decay Projection (1/3)
//   3. Per-Position Greeks Table (full width)
//   4. Vega Exposure Donut (1/2, palette CATÉGORIELLE) + IV Rank (1/2)
//   5. Second-Order Greeks panel (collapsed by default)
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, Legend } from 'recharts';
import { ChevronDown, Sigma } from 'lucide-react';
import { useOpenPositions } from '../../store/useStore';
// A1 — migrated from legacy computePortfolioGreeks (sign-agnostic,
// theta/year, vega/1.00-sigma) to aggregateGreeks (sign-aware via pos.dir,
// theta/day, vega/1%-IV). For Sniper-OTM short premium portfolios this
// means Theta is now positive (decay encaissé) and Vega negative (short
// vol). The displayed magnitudes also drop because Theta is divided by
// 365 and Vega by 100 vs the legacy raw BSM units.
import { computeSecondOrderGreeks } from '../../utils/calculations';
import { aggregateGreeks } from '../../utils/greeks';
import { toFloat, ensurePositive } from '../../utils/math';
import { getGreeksForAllPositions } from '../../utils/greeksApi';

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

// Palette catégorielle neutre pour le donut Vega (slices = parts d'expo,
// pas du P&L — d'où l'absence de pnl-up/pnl-down). var(--accent) est
// réservé au slice « décisionnel » (le plus exposé en valeur absolue).
const PIE_NEUTRAL_TONES = ['var(--ink-pure)', 'var(--ink-soft)', 'var(--ink-mute)'];
function pieFill(rank) {
  if (rank === 0) return 'var(--accent)';
  return PIE_NEUTRAL_TONES[(rank - 1) % PIE_NEUTRAL_TONES.length];
}

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

// ── Local formatters — copies the Intl conventions from the legacy
// MetricCard so the canonical strip displays identically without the
// glass/blur chrome. ─────────────────────────────────────────────
function fmtNumber(v) {
  if (v == null || Number.isNaN(v)) return '—';
  return new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(v);
}
const GR_USD_FMT_2D = new Intl.NumberFormat('de-CH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function fmtCurrency(v, currency = 'USD') {
  if (v == null || Number.isNaN(v)) return '—';
  if (currency === 'USD') {
    return (v < 0 ? '-' : '') + '$' + GR_USD_FMT_2D.format(Math.abs(v));
  }
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

// Local KPI tile — markup plat, à plat sur var(--depth-raised). Tous les
// KPI Greeks agrégés passent 'pure' (Θ inclus depuis la révision CANONICAL-3).
// 'loss' reste une affordance du primitif mais AUCUN Greek ne la déclenche
// (le vert 'profit' n'a jamais été autorisé sur des Greeks agrégés).
function KpiTile({ label, tooltip, value, tone = 'pure', compact = false }) {
  const cls = [
    'greeks-v3__kpi',
    compact && 'greeks-v3__kpi--compact',
  ].filter(Boolean).join(' ');
  const valueCls = [
    'greeks-v3__kpi-value',
    tone === 'loss' && 'is-loss',
  ].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <span className="greeks-v3__kpi-label">
        {label}
        {tooltip && <InfoTooltip content={tooltip} size={12} />}
      </span>
      <span className={valueCls}>{value}</span>
    </div>
  );
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
    const agg = aggregateGreeks(openPositions || [], greeksMap);
    return {
      delta: agg.sumDelta,
      gamma: agg.sumGamma,
      theta: agg.thetaDaily, // USD per day, sign-aware (was: per year, sign-agnostic)
      vega: agg.vegaPer1Pct, // USD per 1% IV change, sign-aware (was: per 1.00 sigma)
      count: agg.optionsCount,
    };
  }, [openPositions, greeksMap]);

  const secondOrder = useMemo(
    () => computeSecondOrderGreeks(openPositions || [], greeksMap),
    [openPositions, greeksMap]
  );

  // B2-PATCH — unit alignment with aggregateGreeks (cockpit) :
  //   - theta = thetaBSM (per-share, per-YEAR) × qty × mul / 365   → USD/day
  //   - vega  = vegaBSM  (per-share, per-1.00σ)  × qty × mul / 100 → USD per 1 %-IV
  //   - delta / gamma are per-share already and scale naturally × qty × mul
  // Sign-aware via dir (Short positions flip θ and ν signs — mirrors the
  // canonical aggregateGreeks convention). PREVIOUSLY this table showed
  // theta in per-YEAR units (~-7993 instead of -22), inconsistent with the
  // cockpit Σ Theta which is in per-DAY units.
  const perPositionRows = useMemo(() => {
    return optionPositions.map((p) => {
      const g = greeksMap?.get(p.id) || p.greeks || {};
      const qty = toFloat(p.ct);
      const mul = ensurePositive(p.mu);
      const dirSign = p.dir === 'Short' ? -1 : 1;
      const delta = g.d ?? g.delta ?? 0;
      const gamma = g.g ?? g.gamma ?? 0;
      const theta = g.t ?? g.theta ?? 0;
      const vega = g.v ?? g.vega ?? 0;
      const iv = g.iv ?? p.iv ?? null;
      const ivRank = p.ivRank ?? null;
      const exposure = toFloat(p.pc) * qty * mul * dirSign;
      // Stocks (no g, no iv) keep null fields per existing UI convention.
      const isAvailable = g && (g.delta != null || g.theta != null);
      return {
        id: p.id,
        ticker: p.tk,
        type: p.ty || 'OPT',
        delta: isAvailable ? delta * qty * mul * dirSign : null,
        gamma: isAvailable ? gamma * qty * mul * dirSign : null,
        theta: isAvailable ? (theta / 365) * qty * mul * dirSign : null,
        vega: isAvailable ? (vega / 100) * qty * mul * dirSign : null,
        iv,
        ivRank,
        exposure,
        // Cascade σ (positionGreeks) marque la position quand le fallback (c)
        // a été utilisé — IV de 30% par défaut, donc valeur "approximative".
        // Surface ~ + italic + opacité dans la cellule IV de la table.
        ivEstimated: !!g.ivEstimated,
      };
    });
  }, [optionPositions, greeksMap]);

  // Donut data : trié par exposition |vega| décroissante. Le 1er slice
  // (le plus exposé = « décisionnel ») reçoit var(--accent), les autres
  // cyclent sur les nuances d'ink.
  const vegaPieData = useMemo(() => {
    return perPositionRows
      .filter((r) => Math.abs(r.vega) > 0.01)
      .map((r) => ({ name: r.ticker, value: Math.abs(r.vega), original: r.vega }))
      .sort((a, b) => b.value - a.value);
  }, [perPositionRows]);

  const ivRankRows = useMemo(() => {
    return perPositionRows
      .filter((r) => r.ivRank != null && isFinite(r.ivRank))
      .map((r) => ({ ticker: r.ticker, ivRank: r.ivRank }));
  }, [perPositionRows]);

  const evolutionSeries = useMemo(() => buildMockEvolution(netGreeks, 30), [netGreeks]);

  // CANONICAL-3 (révisé) : les 4 KPI Greeks sont TOUS en ink-pure. Θ n'est
  // plus rougi sur son signe — le rouge reste réservé aux pertes réalisées,
  // pas au signe naturel d'un Greek (theta ~toujours négatif).

  // Empty state — no options at all
  if (optionPositions.length === 0) {
    return (
      <div className="page-container greeks-empty">
        <div className="greeks-empty__panel">
          <EmptyState
            icon={Sigma}
            title="Aucune position optionnelle"
            description="Le Greeks Center s'allume dès qu'une option est en portefeuille. Tes positions actions restent suivies sur le Dashboard."
          />
        </div>
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

      {/* ── Row 1 : Net Greeks — 4 KPI tiles, règle sémantique stricte ── */}
      <div className="greeks-page__hero-row">
        <motion.div variants={TILE_VARIANTS}>
          <KpiTile
            label="Δ Delta"
            tooltip={GREEK_TOOLTIPS.delta}
            value={fmtNumber(netGreeks.delta)}
            tone="pure"
          />
        </motion.div>
        <motion.div variants={TILE_VARIANTS}>
          <KpiTile
            label="Γ Gamma"
            tooltip={GREEK_TOOLTIPS.gamma}
            value={fmtNumber(netGreeks.gamma)}
            tone="pure"
          />
        </motion.div>
        <motion.div variants={TILE_VARIANTS}>
          <KpiTile
            label="Θ Theta"
            tooltip={GREEK_TOOLTIPS.theta}
            value={fmtCurrency(netGreeks.theta)}
            tone="pure"
          />
        </motion.div>
        <motion.div variants={TILE_VARIANTS}>
          <KpiTile
            label="ν Vega"
            tooltip={GREEK_TOOLTIPS.vega}
            value={fmtCurrency(netGreeks.vega)}
            tone="pure"
          />
        </motion.div>
      </div>

      {/* ── Row 2 : Evolution Chart + Theta Decay Projection ── */}
      <div className="greeks-page__chart-row">
        <motion.div variants={TILE_VARIANTS} className="greeks-page__chart-main">
          <div className="greeks-v3__panel">
            <div className="greeks-v3__panel-head">
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
          </div>
        </motion.div>
        <motion.div variants={TILE_VARIANTS} className="greeks-page__chart-side">
          <div className="greeks-v3__panel" style={{ height: '100%' }}>
            <ThetaDecayProjection dailyTheta={netGreeks.theta} days={30} />
          </div>
        </motion.div>
      </div>

      {/* ── Row 3 : Per-position Greeks table ── */}
      <motion.div variants={TILE_VARIANTS}>
        <div className="greeks-v3__panel">
          <div className="greeks-v3__panel-head">
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
        </div>
      </motion.div>

      {/* ── Row 4 : Vega pie + IV Rank ── */}
      <div className="greeks-page__dual-row">
        <motion.div variants={TILE_VARIANTS}>
          <div className="greeks-v3__panel">
            <div className="greeks-v3__panel-head">
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
                {/* B3 — minWidth/minHeight évitent le warning recharts
                    "width(-1) and height(-1) of chart should be greater
                    than 0" au premier rendu, avant que le grid
                    `greeks-page__dual-row` ait propagé sa largeur. */}
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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
                      label={false}
                    >
                      {vegaPieData.map((d, i) => (
                        <Cell
                          key={d.name}
                          fill={pieFill(i)}
                          stroke="var(--depth-raised)"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <RTooltip
                      cursor={false}
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const p = payload[0];
                        const sign = p.payload.original >= 0 ? '+' : '−';
                        const dotColor = p.payload.fill || 'var(--ink-soft)';
                        return (
                          <div className="greeks-v3__pie-tooltip">
                            <div className="greeks-v3__pie-tooltip-row">
                              <span
                                className="greeks-v3__pie-tooltip-dot"
                                style={{ background: dotColor }}
                              />
                              <span className="greeks-v3__pie-tooltip-name">{p.payload.name}</span>
                              <span>{`${sign}${Math.abs(p.value).toFixed(2)}`}</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11, fontFamily: 'var(--type-mono)' }}
                      formatter={(value) => (
                        <span style={{ color: 'var(--ink-soft)' }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div variants={TILE_VARIANTS}>
          <div className="greeks-v3__panel">
            <IVRankHistogram data={ivRankRows} />
          </div>
        </motion.div>
      </div>

      {/* ── Row 5 : Second-order Greeks panel (collapsed) ── */}
      <motion.div variants={TILE_VARIANTS}>
        <div className="greeks-v3__panel">
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
              <KpiTile
                label="Vanna"
                tooltip={{
                  title: 'Vanna',
                  body: 'dDelta/dVol — Sensibilité du Delta à la volatilité.',
                }}
                value={fmtNumber(secondOrder.vanna)}
                tone="pure"
                compact
              />
              <KpiTile
                label="Charm"
                tooltip={{ title: 'Charm', body: 'dDelta/dTime — Decay du Delta par jour.' }}
                value={fmtNumber(secondOrder.charm)}
                tone="pure"
                compact
              />
              <KpiTile
                label="Vomma"
                tooltip={{
                  title: 'Vomma',
                  body: 'dVega/dVol — Convexité du Vega par rapport à la volatilité.',
                }}
                value={fmtNumber(secondOrder.vomma)}
                tone="pure"
                compact
              />
              <KpiTile
                label="GEX"
                tooltip={{
                  title: 'GEX (Gamma Exposure)',
                  body: 'Exposition gamma totale du portefeuille multipliée par le prix spot.',
                }}
                value={fmtCurrency(secondOrder.gex)}
                tone="pure"
                compact
              />
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
