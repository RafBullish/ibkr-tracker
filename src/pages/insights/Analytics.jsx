// ═══════════════════════════════════════════════════════════════
//  ANALYTICS — page-vitrine au langage cockpit v1.0 (brique 2.B)
//  /insights/analytics
//
//  « La forme longue de mon système, l'année en un regard. »
//
//  Architecture (§4.5), de haut en bas :
//    1. BANDEAU DE COMMANDEMENT — 10 KPI en cellules-MONDE (2 rangées) :
//       Expectancy · Sortino · Calmar · Sharpe · Profit Factor //
//       Win Rate · Omega · Kelly % · Avg Hold · Max DD. Un RATIO n'est
//       PAS de l'argent → ratios NEUTRES (loi 2.B §4.6). Seul Max DD $
//       (perte réelle depuis un pic) reste toné. Caveat d'honnêteté
//       « préliminaire · échantillon < 1 an » repris tel quel.
//    2. HÉROÏNE — heatmap P&L annuelle pleine largeur (échelle divergente
//       enfin lisible, cf. PnLCalendarHeatmap 2.B).
//    3. ÉTAGE RYTHME & RÉPARTITION — un panneau cockpit, 3 zones aux
//       rails : P&L par jour de semaine (OBS) · Répartition G/P (donut)
//       · Breakdown par stratégie.
// ═══════════════════════════════════════════════════════════════

import { lazy, Suspense, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { useClosedTrades, useSettings } from '../../store/useStore';
import { tradePnlUsd } from '../../utils/calculations';
import { useTradingMetrics } from '../../hooks/useTradingMetrics';
import { usePortfolioMetrics } from '../../hooks/usePortfolioMetrics';
import { holdingDays } from '../../utils/dates';
import { toFloat } from '../../utils/math';

import StatusBadge from '../../components/ui/StatusBadge';
import InfoTooltip from '../../components/ui/InfoTooltip';
import EmptyState from '../../components/ui/EmptyState';
import WinRateDonut from '../../components/ui/WinRateDonut';
import PnLCalendarHeatmap from '../../components/charts/PnLCalendarHeatmap';
import { OBS, useMountOnlyAnimation } from '../../components/charts/obsidienne';
import ObsidienneTooltip from '../../components/charts/ObsidienneTooltip';
import { TickValue } from '../../components/dashboard/decision/parts';
import { RISE_CONTAINER_VARIANTS, RISE_TILE_VARIANTS } from '../../theme/animationVariants';

const LazyStrategyBreakdown = lazy(() => import('../../components/charts/StrategyBreakdown'));

const WEEKDAYS = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
const WEEKDAY_FULL = {
  Di: 'Dimanche',
  Lu: 'Lundi',
  Ma: 'Mardi',
  Me: 'Mercredi',
  Je: 'Jeudi',
  Ve: 'Vendredi',
  Sa: 'Samedi',
};

// ── Formatters (de-CH, anti-NBSP) ────────────────────────────────
const nf = (min, max) =>
  new Intl.NumberFormat('de-CH', { minimumFractionDigits: min, maximumFractionDigits: max });
function fmtNum(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return nf(0, 2).format(v);
}
function fmtR(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return nf(1, 2).format(v) + 'R';
}
function fmtPct(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return nf(2, 2).format(v) + '%';
}
function fmtUsd(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return (v < 0 ? '-' : '') + '$' + nf(0, 0).format(Math.abs(v));
}
function fmtSignedUsd(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}$${nf(0, 0).format(Math.abs(v))}`;
}

function aggregateDayOfWeek(closedTrades, lr) {
  const buckets = Array.from({ length: 7 }, (_, d) => ({ day: WEEKDAYS[d], count: 0, pnl: 0 }));
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

// ── Cellule-MONDE du bandeau (anatomie .pf-c, valeur 34px). Ratios
// NEUTRES ; seul un montant d'argent réel (Max DD) porte un tone. ──
function CommandCell({ label, title, value, meta, tone }) {
  return (
    <div className="pf-c analytics-command__cell">
      <span className="pf-c__label analytics-command__label" title={title || undefined}>
        {label}
      </span>
      <TickValue
        text={value}
        className={`pf-c__val analytics-command__val${tone ? ` pf-c__val--${tone}` : ''}`}
      />
      <span className="pf-c__meta analytics-command__meta">{meta || ' '}</span>
    </div>
  );
}

// ── P&L par jour de semaine — kit OBS + ObsidienneTooltip (les axes
// 10px et le tooltip inline 11px MEURENT). Barres vert/rouge = P&L
// réalisé (exception chartée), aplats désaturés. ──────────────────
function DayChart({ data }) {
  const anim = useMountOnlyAnimation();
  return (
    <div className="obsidienne-chart analytics-rhythm__chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <BarChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke={OBS.color.grid} />
          <XAxis dataKey="day" tick={OBS.tick} axisLine={false} tickLine={false} />
          <YAxis
            tick={OBS.tick}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            content={
              <ObsidienneTooltip
                formatLabel={(l) => WEEKDAY_FULL[l] || l}
                rows={(payload) => {
                  const d = payload?.[0]?.payload;
                  if (!d) return [];
                  return [
                    {
                      label: 'P&L',
                      value: fmtSignedUsd(d.pnl),
                      tone: d.pnl > 0 ? 'up' : d.pnl < 0 ? 'down' : undefined,
                    },
                    { label: 'TRADES', value: String(d.count) },
                  ];
                }}
              />
            }
          />
          <Bar dataKey="pnl" radius={[2, 2, 0, 0]} maxBarSize={44} {...anim}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.pnl >= 0 ? OBS.color.up : OBS.color.down} fillOpacity={0.62} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Analytics() {
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();

  const rawClosedTrades = useClosedTrades();
  const settings = useSettings();
  const lr = toFloat(settings?.liveRate) || 1;
  const closedTrades = useMemo(() => rawClosedTrades || [], [rawClosedTrades]);

  const metrics = useTradingMetrics(closedTrades, lr);
  const portfolioMetrics = usePortfolioMetrics();
  const dayData = useMemo(() => aggregateDayOfWeek(closedTrades, lr), [closedTrades, lr]);
  const dayMap = useMemo(() => buildDayPnlMap(closedTrades, lr), [closedTrades, lr]);

  const avgHold = useMemo(() => {
    const withDur = closedTrades.filter((t) => t.di && t.do);
    if (!withDur.length) return null;
    const sum = withDur.reduce((s, t) => s + holdingDays(t.di, t.do), 0);
    return Math.round(sum / withDur.length);
  }, [closedTrades]);

  // Répartition G/P (densité de la zone donut).
  const wl = useMemo(() => {
    let w = 0,
      l = 0;
    for (const t of closedTrades) {
      const p = tradePnlUsd(t, lr);
      if (p > 0) w++;
      else if (p < 0) l++;
    }
    return { wins: w, losses: l, total: w + l };
  }, [closedTrades, lr]);

  const pf = metrics?.profitFactor;
  const omega = metrics?.omega;
  const expectancyR =
    metrics && Number.isFinite(metrics.expectancy)
      ? metrics.expectancy / Math.max(Math.abs(metrics.avgLoss), 1)
      : null;

  // Caveat d'honnêteté — repris TEL QUEL de RiskMatrix (échantillon < 1 an).
  const preliminary = portfolioMetrics?.preliminaryRatios;
  const caveatTitle = `Échantillon court : ${
    portfolioMetrics?.yearsActive != null
      ? `${(portfolioMetrics.yearsActive * 365.25).toFixed(0)} j`
      : '< 1 an'
  }. Sharpe / Sortino / Calmar extrapolés (Calmar utilise CAGR annualisé = ${
    portfolioMetrics?.cagrAnnPct != null ? portfolioMetrics.cagrAnnPct.toFixed(1) + '%' : '—'
  } / |MaxDD ${
    portfolioMetrics?.maxDrawdownPct != null ? portfolioMetrics.maxDrawdownPct.toFixed(2) + '%' : '—'
  }|).`;

  if (closedTrades.length === 0) {
    return (
      <div className="page-container analytics-v3">
        <div className="analytics-v3__panel analytics-v3__panel--subtle analytics-v3__empty-panel">
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
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="page-container analytics-v3"
      variants={reducedMotion ? undefined : RISE_CONTAINER_VARIANTS}
      initial={reducedMotion ? undefined : 'hidden'}
      animate={reducedMotion ? undefined : 'visible'}
    >
      <motion.div variants={RISE_TILE_VARIANTS} className="page-header">
        <div>
          <h1 className="page-title">
            <BarChart3 size={18} aria-hidden="true" />
            Analytics
            <StatusBadge variant="accent" label={`${closedTrades.length} trades`} size="xs" />
          </h1>
          <p className="page-subtitle">
            La forme longue de ton système — ratios risque-ajustés, rythme, saisonnalité.
          </p>
        </div>
      </motion.div>

      {/* 1 — BANDEAU DE COMMANDEMENT : 10 KPI, ratios NEUTRES. */}
      <motion.section
        variants={RISE_TILE_VARIANTS}
        className="lh-final analytics-command"
        aria-label="Commandement — performance risque-ajustée"
      >
        <div className="analytics-command__grid">
          <CommandCell
            label="EXPECTANCY"
            title="Gain moyen attendu par trade en R-multiples. Positif = espérance mathématique gagnante."
            value={fmtR(expectancyR)}
            meta="par trade · R"
          />
          <CommandCell
            label="SORTINO"
            title="Rendement ajusté à la seule volatilité négative (downside). > 2 excellent, < 0.5 risque excessif."
            value={fmtNum(portfolioMetrics?.sortinoRatio ?? null)}
            meta="downside-adj."
          />
          <CommandCell
            label="CALMAR"
            title="Rendement annualisé / drawdown maximum. Combien tu gagnes par unité de souffrance historique."
            value={fmtNum(portfolioMetrics?.calmarRatio ?? null)}
            meta="CAGR / MaxDD"
          />
          <CommandCell
            label="SHARPE"
            title="Rendement excédentaire par unité de volatilité totale. > 1 acceptable, > 2 excellent."
            value={fmtNum(portfolioMetrics?.sharpeRatio ?? null)}
            meta="vol-adj."
          />
          <CommandCell
            label="PROFIT FACTOR"
            title="Σ gains / |Σ pertes|. > 1 rentable brut, > 2 solide."
            value={pf === Infinity ? '∞' : fmtNum(pf)}
            meta="gains / pertes"
          />
          <CommandCell
            label="WIN RATE"
            title="Pourcentage de trades fermés gagnants. À lire en relatif avec l'Expectancy."
            value={fmtPct(metrics?.winRate ?? null)}
            meta="trades gagnants"
          />
          <CommandCell
            label="OMEGA"
            title="Σ gains / Σ |pertes| au seuil 0. > 1 rentable ; 2 = chaque $ perdu rapporte 2 $."
            value={omega === Infinity ? '∞' : fmtNum(omega)}
            meta="Ω ratio"
          />
          <CommandCell
            label="KELLY %"
            title="Fraction optimale du capital à risquer par trade. > 25 % agressif, > 50 % imprudent."
            value={fmtPct(metrics?.kellyPct ?? null)}
            meta="fraction opt."
          />
          <CommandCell
            label="AVG HOLD"
            title="Durée moyenne de détention (jours) entre open et close. Indicateur de style."
            value={avgHold != null ? `${avgHold} j` : '—'}
            meta="jours moyens"
          />
          {/* Max DD = argent RÉEL rendu depuis un pic → toné (loi de couleur). */}
          <CommandCell
            label="MAX DD"
            title="Pire perte cumulative historique depuis un pic d'équité. Montant réel."
            value={fmtUsd(metrics?.maxDrawdown ?? null)}
            meta="pire perte cumulée"
            tone="loss"
          />
        </div>
        {preliminary && (
          <div className="analytics-command__caveat" title={caveatTitle}>
            ~ préliminaire · échantillon &lt; 1 an
          </div>
        )}
      </motion.section>

      {/* 2 — HÉROÏNE : heatmap P&L annuelle pleine largeur. */}
      <motion.div variants={RISE_TILE_VARIANTS}>
        <div className="analytics-v3__panel">
          <div className="analytics-v3__panel-head">
            <span className="uppercase-label">Heatmap P&amp;L annuelle</span>
            <InfoTooltip
              content={{
                title: 'Heatmap annuelle',
                body: "P&L cumulé par jour sur l'année. Repère les streaks, les gaps d'activité et la saisonnalité. Vert = gain, rouge = perte, intensité = ampleur.",
              }}
              size={12}
            />
          </div>
          <PnLCalendarHeatmap dayPnlMap={dayMap} mode="year" currency="USD" />
        </div>
      </motion.div>

      {/* 3 — ÉTAGE RYTHME & RÉPARTITION : un panneau cockpit, 3 zones. */}
      <motion.section
        variants={RISE_TILE_VARIANTS}
        className="lh-final analytics-rhythm"
        aria-label="Rythme et répartition"
      >
        <div className="analytics-rhythm__grid">
          <div className="analytics-rhythm__zone">
            <div className="mk-title">P&amp;L PAR JOUR DE SEMAINE</div>
            <div className="analytics-rhythm__scope">
              {closedTrades.length} trade{closedTrades.length > 1 ? 's' : ''} · tout l'historique
            </div>
            <DayChart data={dayData} />
          </div>

          <div className="analytics-rhythm__zone">
            <div className="mk-title">RÉPARTITION G/P</div>
            <div className="analytics-rhythm__scope">
              {wl.total} clôture{wl.total > 1 ? 's' : ''}
            </div>
            <div className="analytics-rhythm__donut-wrap">
              <WinRateDonut winRate={metrics?.winRate ?? null} size={108} strokeWidth={9} />
              <div className="analytics-rhythm__wl">
                <span className="analytics-rhythm__wl-row">
                  <span className="analytics-rhythm__wl-dot analytics-rhythm__wl-dot--up" />
                  <span className="analytics-rhythm__wl-label">Gagnants</span>
                  <span className="mono analytics-rhythm__wl-val">{wl.wins}</span>
                </span>
                <span className="analytics-rhythm__wl-row">
                  <span className="analytics-rhythm__wl-dot analytics-rhythm__wl-dot--down" />
                  <span className="analytics-rhythm__wl-label">Perdants</span>
                  <span className="mono analytics-rhythm__wl-val">{wl.losses}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="analytics-rhythm__zone analytics-rhythm__zone--strat">
            <div className="mk-title analytics-rhythm__strat-title">
              BREAKDOWN PAR STRATÉGIE
              <InfoTooltip
                content={{
                  title: 'Breakdown par stratégie',
                  body: 'Performance par tag de stratégie (Sniper OTM, Swing, Event…) renseigné dans les trades. Les non-tagués tombent dans « Sans tag ».',
                }}
                size={12}
              />
            </div>
            <div className="analytics-rhythm__scope">par tag · impact P&amp;L décroissant</div>
            <Suspense fallback={<div className="analytics-rhythm__chart" />}>
              <LazyStrategyBreakdown closedTrades={closedTrades} liveRate={lr} />
            </Suspense>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
