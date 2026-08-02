// ═══════════════════════════════════════════════════════════════
//  THETA DECAY PROJECTION — héros de page (brique 2.B)
//
//  Recomposé au système Obsidienne : héros pleine largeur de la page
//  Greeks. Projette l'érosion Theta du portefeuille sur N jours à
//  partir du theta quotidien RÉEL déjà agrégé (dailyTheta, sign-aware).
//
//  Loi de couleur : le theta est un coût HYPOTHÉTIQUE, jamais une
//  perte réalisée → barres quotidiennes NEUTRES (acier). La SEULE
//  série ambre de l'écran = le CUMUL (série héros, DA §3 usage 3).
//  Tooltip unique ObsidienneTooltip · ticks 14 tabulaires · animation
//  au premier montage (reduced-motion respecté via useMountOnlyAnimation).
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import InfoTooltip from '../ui/InfoTooltip';
import EmptyState from '../ui/EmptyState';
import { Clock } from 'lucide-react';
import { OBS, obsAreaGradientStops, useMountOnlyAnimation } from './obsidienne';
import ObsidienneTooltip from './ObsidienneTooltip';

const TOOLTIP = {
  title: 'Projection Theta',
  body: 'Impact cumulé de la décroissance temporelle quotidienne sur le portefeuille, à theta constant. Suppose toutes choses égales par ailleurs.',
  formula: 'Σ (Theta_contrat × qty × mul) par jour',
};

function fmtSignedUsd(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}$${Math.round(Math.abs(v)).toLocaleString('de-CH')}`;
}

// Ticks d'axe $ compacts (cumul en centaines/milliers).
function fmtAxisUsd(v) {
  if (!Number.isFinite(v)) return '';
  const sign = v < 0 ? '−' : '';
  const abs = Math.abs(v);
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

export default function ThetaDecayProjection({
  dailyTheta,
  days = 30,
  height = 300,
  className,
}) {
  const series = useMemo(() => {
    if (typeof dailyTheta !== 'number' || !isFinite(dailyTheta) || dailyTheta === 0) return [];
    const out = [];
    let cum = 0;
    for (let i = 1; i <= days; i++) {
      cum += dailyTheta;
      out.push({ day: i, daily: dailyTheta, cumulative: cum });
    }
    return out;
  }, [dailyTheta, days]);

  const anim = useMountOnlyAnimation();

  const stats = useMemo(() => {
    if (!series.length) return null;
    const last = series[series.length - 1].cumulative;
    const cum7 = series[Math.min(6, series.length - 1)].cumulative;
    return { perDay: dailyTheta, cum7, cum30: last };
  }, [series, dailyTheta]);

  // Intervalle d'affichage des labels d'axe X (≈ 6 repères max).
  const xInterval = Math.max(0, Math.ceil(series.length / 6) - 1);

  return (
    <div className={['theta-decay', className].filter(Boolean).join(' ')}>
      <div className="theta-decay__head">
        <span className="uppercase-label">Projection Theta · J+1 → J+{days}</span>
        <InfoTooltip content={TOOLTIP} size={12} />
      </div>

      {!series.length ? (
        <div className="theta-decay__empty">
          <EmptyState
            size="compact"
            icon={Clock}
            title="Pas de Theta actif"
            description="Aucune position optionnelle avec Theta non nul à projeter."
          />
        </div>
      ) : (
        <>
          <div className="obsidienne-chart theta-decay__canvas" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <ComposedChart
                data={series}
                margin={{ top: 12, right: 12, left: 4, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="thetaCumGrad" x1="0" y1="0" x2="0" y2="1">
                    {obsAreaGradientStops(OBS.color.hero).map((s) => (
                      <stop key={s.offset} {...s} />
                    ))}
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={OBS.color.grid} />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d) => `J+${d}`}
                  tick={OBS.tick}
                  axisLine={false}
                  tickLine={false}
                  interval={xInterval}
                />
                <YAxis
                  tick={OBS.tick}
                  tickFormatter={fmtAxisUsd}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  content={
                    <ObsidienneTooltip
                      formatLabel={(l) => `J+${l}`}
                      rows={(payload) => {
                        const d = payload?.[0]?.payload;
                        if (!d) return [];
                        return [
                          { label: 'PAR JOUR', value: fmtSignedUsd(d.daily) },
                          { label: 'CUMUL', value: fmtSignedUsd(d.cumulative) },
                        ];
                      }}
                    />
                  }
                />
                {/* CUMUL = série héros ambre (la seule de l'écran) — aire
                    ≤12 % + trait 2 px. */}
                <Area
                  dataKey="cumulative"
                  stroke={OBS.color.hero}
                  strokeWidth={2}
                  fill="url(#thetaCumGrad)"
                  {...OBS.stroke}
                  {...anim}
                  dot={false}
                  activeDot={{ r: 3, fill: OBS.color.hero, stroke: 'none' }}
                />
                {/* Barres quotidiennes NEUTRES (acier) — coût hypothétique,
                    jamais de vert/rouge. */}
                <Bar
                  dataKey="daily"
                  fill={OBS.color.context}
                  fillOpacity={0.5}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={18}
                  {...anim}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="theta-decay__summary">
            <div className="theta-decay__stat">
              <span className="theta-decay__summary-label">Par jour</span>
              <span className="theta-decay__summary-value mono" data-tone="neutral">
                {fmtSignedUsd(stats.perDay)}
              </span>
            </div>
            <div className="theta-decay__stat">
              <span className="theta-decay__summary-label">Cumul 7 j</span>
              <span className="theta-decay__summary-value mono" data-tone="neutral">
                {fmtSignedUsd(stats.cum7)}
              </span>
            </div>
            <div className="theta-decay__stat">
              <span className="theta-decay__summary-label">Cumul {days} j</span>
              <span className="theta-decay__summary-value mono" data-tone="neutral">
                {fmtSignedUsd(stats.cum30)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
