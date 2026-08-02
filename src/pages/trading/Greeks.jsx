// ═══════════════════════════════════════════════════════════════
//  GREEKS CENTER — page-vitrine au langage cockpit v1.0 (brique 2.B)
//  /trading/greeks — citoyen PERMANENT (flag GREEK_CENTER retiré).
//
//  Architecture (§4.2 brique 2.B), de haut en bas :
//    1. BANDEAU DE COMMANDEMENT — panneau cockpit (.lh-final),
//       cellules-MONDE aux hairlines verticales : OPTIONS · Δ NET ·
//       Γ NET · Θ / JOUR · ν NET. TOUS NEUTRES (loi de couleur : il
//       n'y a AUCUN argent réel sur cette page ; un Greek signé
//       n'est pas une perte). Valeurs 34 px (loi ratifiée 2.A).
//    2. HÉROS — Projection Theta pleine largeur (barres neutres +
//       cumul ambre = la seule série ambre de l'écran).
//    3. GREEKS PAR POSITION — table maison au craft v1.0 (RANK morte).
//    4. RANGÉE DE CLÔTURE — Exposition Vega (donut acier) | 2ᵉ ordre.
//    États vides DESIGNÉS partout : à 0 option la page reste habitée
//    (bandeau à zéros, héros/table/donut aux états vides cadrés).
//
//  Morts 2.B : GreekEvolutionChart (mock aléatoire — feature fantôme),
//  IVRankHistogram (usine IV Rank jamais construite), colonne RANK.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';
import { ChevronDown } from 'lucide-react';
import { useOpenPositions } from '../../store/useStore';
import { computeSecondOrderGreeks } from '../../utils/calculations';
import { aggregateGreeks } from '../../utils/greeks';
import { toFloat, ensurePositive } from '../../utils/math';
import { getGreeksForAllPositions } from '../../utils/greeksApi';

import InfoTooltip from '../../components/ui/InfoTooltip';
import EmptyState from '../../components/ui/EmptyState';
import ThetaDecayProjection from '../../components/charts/ThetaDecayProjection';
import PerPositionGreeksTable from '../../components/charts/PerPositionGreeksTable';
import ObsidienneTooltip from '../../components/charts/ObsidienneTooltip';
import { TickValue } from '../../components/dashboard/decision/parts';
import { RISE_CONTAINER_VARIANTS, RISE_TILE_VARIANTS } from '../../theme/animationVariants';

const GREEK_TOOLTIPS = {
  delta: {
    title: 'Delta net',
    body: 'Exposition directionnelle agrégée (sign-aware par direction).',
    formula: 'Σ (Δ × qty × mul)',
  },
  gamma: {
    title: 'Gamma net',
    body: 'Sensibilité du Delta aux mouvements du sous-jacent.',
    formula: 'Σ (Γ × qty × mul)',
  },
  theta: {
    title: 'Theta net',
    body: 'Érosion temporelle quotidienne en $ (coût hypothétique, jamais une perte réalisée).',
    formula: 'Σ (Θ × qty × mul) / jour',
  },
  vega: {
    title: 'Vega net',
    body: 'Sensibilité à la volatilité implicite, par +1 % d’IV.',
    formula: 'Σ (ν × qty × mul) / 1 % IV',
  },
};

// Donut Vega — gradations ACIER neutres (2.B) : une part d'exposition
// n'est pas une décision → aucun ambre. La seule série ambre de la page
// est le cumul theta du héros (§4.3).
const PIE_STEEL = ['#C8C8CF', '#9A9AA2', '#77777F', '#585860', '#42424A'];
function pieFill(rank) {
  return PIE_STEEL[rank % PIE_STEEL.length];
}

// ── Formatters locaux (conventions Intl de-CH, anti-NBSP) ─────────
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

// ── Cellule-MONDE du bandeau de commandement (anatomie .pf-c, valeur
// 34 px via .greeks-command). TOUJOURS neutre : aucun tone P&L sur
// cette page (loi de couleur). TickValue = micro-mouvement 1.F. ─────
function CommandCell({ label, title, value, meta }) {
  return (
    <div className="pf-c greeks-command__cell">
      <span className="pf-c__label greeks-command__label" title={title || undefined}>
        {label}
      </span>
      <TickValue text={value} className="pf-c__val greeks-command__val" />
      <span className="pf-c__meta greeks-command__meta">{meta || ' '}</span>
    </div>
  );
}

// ── Cellule 2ᵉ ordre (anatomie .pf-c, valeur au registre compact 22 px). ──
function SoCell({ label, title, value }) {
  return (
    <div className="pf-c greeks-so__cell">
      <span className="pf-c__label" title={title || undefined}>
        {label}
      </span>
      <span className="pf-c__val">{value}</span>
      <span className="pf-c__meta"> </span>
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
      theta: agg.thetaDaily, // USD/jour, sign-aware
      vega: agg.vegaPer1Pct, // USD par 1 % IV, sign-aware
      count: agg.optionsCount,
    };
  }, [openPositions, greeksMap]);

  const secondOrder = useMemo(
    () => computeSecondOrderGreeks(openPositions || [], greeksMap),
    [openPositions, greeksMap]
  );

  // Rows par position — MÊMES dérivations qu'avant (theta/365 per-day,
  // vega/100 per-1%-IV, sign-aware via dir). Colonne RANK retirée.
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
      const exposure = toFloat(p.pc) * qty * mul * dirSign;
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
        exposure,
        ivEstimated: !!g.ivEstimated,
      };
    });
  }, [optionPositions, greeksMap]);

  const vegaPieData = useMemo(() => {
    return perPositionRows
      .filter((r) => Math.abs(r.vega) > 0.01)
      .map((r) => ({ name: r.ticker, value: Math.abs(r.vega), original: r.vega }))
      .sort((a, b) => b.value - a.value);
  }, [perPositionRows]);

  const vegaTotal = useMemo(
    () => vegaPieData.reduce((s, d) => s + d.value, 0),
    [vegaPieData]
  );

  const optionsLabel = `${netGreeks.count} option${netGreeks.count > 1 ? 's' : ''} suivie${netGreeks.count > 1 ? 's' : ''}`;

  return (
    <motion.div
      className="page-container greeks-page"
      variants={reducedMotion ? undefined : RISE_CONTAINER_VARIANTS}
      initial={reducedMotion ? undefined : 'hidden'}
      animate={reducedMotion ? undefined : 'visible'}
    >
      <motion.div variants={RISE_TILE_VARIANTS} className="page-header">
        <div>
          <h1 className="page-title">Options Command Center</h1>
          <p className="page-subtitle">
            Ton exposition grecque, et ce que le temps va te coûter — Δ·Γ·Θ·ν sur le
            portefeuille d'options ouvertes.
          </p>
        </div>
      </motion.div>

      {/* 1 — BANDEAU DE COMMANDEMENT : cellules-MONDE, TOUTES NEUTRES. */}
      <motion.section
        variants={RISE_TILE_VARIANTS}
        className="lh-final greeks-command"
        aria-label="Commandement — Greeks nets du portefeuille"
      >
        <div className="greeks-command__grid">
          <CommandCell
            label="OPTIONS"
            title="Nombre de positions optionnelles ouvertes suivies sur cette page."
            value={String(netGreeks.count)}
            meta="en portefeuille"
          />
          <CommandCell
            label="Δ NET"
            title={`${GREEK_TOOLTIPS.delta.body} — ${GREEK_TOOLTIPS.delta.formula}`}
            value={fmtNumber(netGreeks.delta)}
            meta="directionnel"
          />
          <CommandCell
            label="Γ NET"
            title={`${GREEK_TOOLTIPS.gamma.body} — ${GREEK_TOOLTIPS.gamma.formula}`}
            value={fmtNumber(netGreeks.gamma)}
            meta="convexité"
          />
          <CommandCell
            label="Θ / JOUR"
            title={`${GREEK_TOOLTIPS.theta.body} — ${GREEK_TOOLTIPS.theta.formula}`}
            value={fmtCurrency(netGreeks.theta)}
            meta="érosion / jour"
          />
          <CommandCell
            label="ν NET"
            title={`${GREEK_TOOLTIPS.vega.body} — ${GREEK_TOOLTIPS.vega.formula}`}
            value={fmtCurrency(netGreeks.vega)}
            meta="par +1 % IV"
          />
        </div>
      </motion.section>

      {/* 2 — HÉROS : projection Theta pleine largeur (cumul ambre). */}
      <motion.div variants={RISE_TILE_VARIANTS}>
        <div className="greeks-v3__panel greeks-page__hero">
          <ThetaDecayProjection dailyTheta={netGreeks.theta} days={30} height={320} />
        </div>
      </motion.div>

      {/* 3 — GREEKS PAR POSITION (table maison, craft v1.0). */}
      <motion.div variants={RISE_TILE_VARIANTS}>
        <div className="greeks-v3__panel">
          <div className="greeks-v3__panel-head">
            <span className="uppercase-label">Greeks par position</span>
            <InfoTooltip
              content={{
                title: 'Greeks par position',
                body: 'Valeurs par contrat × quantité × multiplicateur, sign-aware par direction. Le ~ marque une IV estimée (mark hors plage no-arbitrage, défaut σ=30%).',
              }}
              size={12}
            />
          </div>
          <PerPositionGreeksTable rows={perPositionRows} />
        </div>
      </motion.div>

      {/* 4 — RANGÉE DE CLÔTURE : Exposition Vega (acier) | 2ᵉ ordre. */}
      <div className="greeks-page__dual-row">
        <motion.div variants={RISE_TILE_VARIANTS}>
          <div className="greeks-v3__panel">
            <div className="greeks-v3__panel-head">
              <span className="uppercase-label">Exposition Vega</span>
              <InfoTooltip
                content={{
                  title: 'Répartition Vega',
                  body: 'Partage de la sensibilité IV totale entre les positions. Plus une part est grande, plus elle porte le risque/récompense IV.',
                }}
                size={12}
              />
            </div>
            {vegaPieData.length === 0 ? (
              <div className="greeks-vega__empty">
                <EmptyState size="compact" title="Pas de vega à afficher" />
              </div>
            ) : (
              <div className="greeks-vega">
                <div className="greeks-vega__donut obsidienne-chart">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <PieChart>
                      <Pie
                        data={vegaPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={82}
                        paddingAngle={2}
                        label={false}
                        stroke="var(--depth-raised)"
                        strokeWidth={2}
                      >
                        {vegaPieData.map((d, i) => (
                          <Cell key={d.name} fill={pieFill(i)} />
                        ))}
                      </Pie>
                      <RTooltip
                        cursor={false}
                        content={
                          <ObsidienneTooltip
                            formatLabel={() => 'EXPOSITION VEGA'}
                            rows={(payload) => {
                              const p = payload?.[0];
                              if (!p) return [];
                              const orig = p.payload?.original ?? 0;
                              const sign = orig >= 0 ? '+' : '−';
                              return [
                                { label: p.payload.name, value: `${sign}${Math.abs(p.value).toFixed(2)}` },
                              ];
                            }}
                          />
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="greeks-vega__legend">
                  {vegaPieData.map((d, i) => (
                    <div key={d.name} className="greeks-vega__legend-row">
                      <span
                        className="greeks-vega__legend-dot"
                        style={{ background: pieFill(i) }}
                      />
                      <span className="greeks-vega__legend-name">{d.name}</span>
                      <span className="mono greeks-vega__legend-val">
                        {vegaTotal > 0 ? `${Math.round((d.value / vegaTotal) * 100)}%` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div variants={RISE_TILE_VARIANTS}>
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

            {showSecondOrder ? (
              <div className="greeks-so">
                <SoCell
                  label="Vanna"
                  title="dDelta/dVol — Sensibilité du Delta à la volatilité."
                  value={fmtNumber(secondOrder.vanna)}
                />
                <SoCell
                  label="Charm"
                  title="dDelta/dTime — Décroissance du Delta par jour."
                  value={fmtNumber(secondOrder.charm)}
                />
                <SoCell
                  label="Vomma"
                  title="dVega/dVol — Convexité du Vega par rapport à la volatilité."
                  value={fmtNumber(secondOrder.vomma)}
                />
                <SoCell
                  label="GEX"
                  title="Gamma Exposure — exposition gamma totale × prix spot."
                  value={fmtCurrency(secondOrder.gex)}
                />
              </div>
            ) : (
              <p className="greeks-so__hint">
                Vanna · Charm · Vomma · GEX — déplie pour les dérivées de second ordre.
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
