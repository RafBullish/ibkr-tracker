// ═══════════════════════════════════════════════════════════════
//  THETA DECAY PROJECTION v3.0
//
//  Projects portfolio Theta decay over the next N days as a
//  horizontal SVG bar chart. Each day's bar = daily theta impact
//  in $. Cumulative line on top shows total erosion over time.
//  Honours prefers-reduced-motion via CSS.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import InfoTooltip from '../ui/InfoTooltip';
import EmptyState from '../ui/EmptyState';
import { Clock } from 'lucide-react';

const TOOLTIP = {
  title: 'Projection Theta',
  body: 'Impact cumulé de la décroissance temporelle quotidienne sur le portefeuille. Suppose toutes choses égales par ailleurs.',
  formula: 'Σ (Theta_contrat × qty × mul) par jour',
};

export default function ThetaDecayProjection({
  dailyTheta,
  days = 30,
  currency = 'USD',
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

  const maxCum = series.length ? Math.abs(series[series.length - 1].cumulative) : 0;

  if (!series.length) {
    return (
      <EmptyState
        size="compact"
        icon={Clock}
        title="Pas de Theta actif"
        description="Aucune position optionnelle avec Theta non nul à projeter."
      />
    );
  }

  const formatCurrency = (v) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
      signDisplay: 'always',
    }).format(v);

  return (
    <div className={['theta-decay', className].filter(Boolean).join(' ')}>
      <div className="theta-decay__head">
        <span className="uppercase-label">Projection Theta · {days}j</span>
        <InfoTooltip content={TOOLTIP} size={12} />
      </div>

      <div className="theta-decay__summary">
        <div>
          <span className="theta-decay__summary-label">Par jour</span>
          <span
            className="theta-decay__summary-value mono"
            data-tone={dailyTheta < 0 ? 'loss' : 'profit'}
          >
            {formatCurrency(dailyTheta)}
          </span>
        </div>
        <div>
          <span className="theta-decay__summary-label">Cumul {days}j</span>
          <span
            className="theta-decay__summary-value mono"
            data-tone={series[series.length - 1].cumulative < 0 ? 'loss' : 'profit'}
          >
            {formatCurrency(series[series.length - 1].cumulative)}
          </span>
        </div>
      </div>

      <div
        className="theta-decay__bars"
        role="img"
        aria-label={`Projection Theta sur ${days} jours`}
      >
        {series.map((p, i) => {
          const ratio = maxCum > 0 ? Math.abs(p.cumulative) / maxCum : 0;
          return (
            <div key={i} className="theta-decay__day">
              <div
                className="theta-decay__bar"
                data-tone={p.cumulative < 0 ? 'loss' : 'profit'}
                style={{ height: `${Math.max(6, ratio * 100)}%` }}
                title={`J+${p.day} · cumul ${formatCurrency(p.cumulative)}`}
              />
              {(i === 0 || i === series.length - 1 || (i + 1) % 10 === 0) && (
                <span className="theta-decay__day-label">J+{p.day}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
