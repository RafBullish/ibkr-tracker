// ═══════════════════════════════════════════════════════════════
//  RISK METRICS ROW v3.0 « Midnight Terminal »
//
//  Six compact MetricCards in a row (desktop) / 2×3 grid (mobile),
//  each with a mandatory InfoTooltip per brief §13.6.
//
//  Metrics (left-to-right):
//    Expectancy · Sortino · Calmar · Sharpe · Profit Factor · Win Rate
//
//  Tones:
//    - Expectancy / Sortino / Calmar / Sharpe : profit when > thresh,
//      loss when < bad-thresh, neutral otherwise
//    - Profit Factor : profit when > 1.3, loss when < 1.0, neutral in between
//    - Win Rate : profit when >= 50, loss when < 40, neutral otherwise
// ═══════════════════════════════════════════════════════════════

import { forwardRef } from 'react';
import { Zap, Shield, BarChart3, TrendingUp, Target, Percent } from 'lucide-react';
import MetricCard from '../ui/MetricCard';

const TOOLTIPS = {
  expectancy: {
    title: 'Expectancy',
    body: 'Gain moyen attendu par trade en R-multiples. Positif = espérance mathématique gagnante sur le long terme.',
    formula: '(Win% × AvgWin) − (Loss% × AvgLoss)',
    example: '60% win × 1.5R − 40% loss × 1R = +0.50R. Sur 100 trades : +50R.',
  },
  sortino: {
    title: 'Sortino Ratio',
    body: 'Sharpe ratio utilisant uniquement la volatilité des rendements négatifs. Mesure plus juste pour les stratégies asymétriques (options Sniper OTM).',
    formula: '(R − Rf) / σ_downside',
    example: '> 2 considéré excellent. > 1 acceptable. < 0.5 risque excessif.',
  },
  calmar: {
    title: 'Calmar Ratio',
    body: 'Rendement annualisé divisé par le drawdown maximum. Indique combien tu gagnes par unité de souffrance historique.',
    formula: 'CAGR / |MaxDrawdown|',
    example: '0.85 = 85% du MaxDD annuellement capturé en rendement.',
  },
  sharpe: {
    title: 'Sharpe Ratio',
    body: 'Rendement excédentaire par unité de volatilité totale. Utile mais pénalise aussi la volatilité à la hausse.',
    formula: '(R − Rf) / σ_total',
    example: '> 1 acceptable, > 2 excellent, > 3 exceptionnel sur un long historique.',
  },
  profitFactor: {
    title: 'Profit Factor',
    body: 'Rapport entre gains totaux et pertes totales absolues. > 1 = rentable brut. Indicateur de robustesse de la stratégie.',
    formula: 'Σ gains / |Σ pertes|',
    example: '2.14 = chaque $1 perdu est couvert par $2.14 de gain. > 2 solide.',
  },
  winRate: {
    title: 'Win Rate',
    body: "Pourcentage de trades fermés gagnants. À lire en relatif avec l'Expectancy : un 40% win peut être très rentable si les gains sont grands.",
    formula: 'Trades gagnants / Trades totaux × 100',
    example: 'Sniper OTM peut tolérer 40-50% si R-multiple ≥ 1.5.',
  },
};

function toneFor(metric, v) {
  if (v == null || !isFinite(v)) return 'neutral';
  switch (metric) {
    case 'expectancy':
      return v > 0.1 ? 'profit' : v < -0.1 ? 'loss' : 'neutral';
    case 'sortino':
      return v > 1.5 ? 'profit' : v < 0.5 ? 'loss' : 'neutral';
    case 'calmar':
      return v > 0.5 ? 'profit' : v < 0.2 ? 'loss' : 'neutral';
    case 'sharpe':
      return v > 1 ? 'profit' : v < 0.5 ? 'loss' : 'neutral';
    case 'profitFactor':
      if (v === Infinity) return 'profit';
      return v > 1.3 ? 'profit' : v < 1 ? 'loss' : 'neutral';
    case 'winRate':
      return v >= 50 ? 'profit' : v < 40 ? 'loss' : 'neutral';
    default:
      return 'neutral';
  }
}

function displayValue(metric, v) {
  if (v == null || !isFinite(v)) {
    if (v === Infinity) return Infinity;
    return null;
  }
  return v;
}

/**
 * @param {object} props
 * @param {object} props.metrics
 * @param {number} [props.metrics.expectancy]  R-multiple
 * @param {number} [props.metrics.sortino]
 * @param {number} [props.metrics.calmar]
 * @param {number} [props.metrics.sharpe]
 * @param {number} [props.metrics.profitFactor]
 * @param {number} [props.metrics.winRate]     0-100
 * @param {string} [props.className]
 */
const RiskMetricsRow = forwardRef(function RiskMetricsRow({ metrics = {}, className }, ref) {
  const { expectancy, sortino, calmar, sharpe, profitFactor, winRate } = metrics;

  return (
    <div ref={ref} className={['risk-metrics-row', className].filter(Boolean).join(' ')}>
      <MetricCard
        label="Expectancy"
        value={displayValue('expectancy', expectancy)}
        format="r-multiple"
        size="compact"
        semantic={toneFor('expectancy', expectancy)}
        icon={Zap}
        tooltip={TOOLTIPS.expectancy}
      />
      <MetricCard
        label="Sortino"
        value={displayValue('sortino', sortino)}
        format="number"
        size="compact"
        semantic={toneFor('sortino', sortino)}
        icon={Shield}
        tooltip={TOOLTIPS.sortino}
      />
      <MetricCard
        label="Calmar"
        value={displayValue('calmar', calmar)}
        format="number"
        size="compact"
        semantic={toneFor('calmar', calmar)}
        icon={BarChart3}
        tooltip={TOOLTIPS.calmar}
      />
      <MetricCard
        label="Sharpe"
        value={displayValue('sharpe', sharpe)}
        format="number"
        size="compact"
        semantic={toneFor('sharpe', sharpe)}
        icon={TrendingUp}
        tooltip={TOOLTIPS.sharpe}
      />
      {/* A2b — `profitFactor` is now null at storage when grossLoss=0 or
          lossCount<3. The legacy 999.99 cast is retired. displayValue
          handles null → "—". */}
      <MetricCard
        label="Profit Factor"
        value={displayValue('profitFactor', profitFactor)}
        format="number"
        size="compact"
        semantic={toneFor('profitFactor', profitFactor)}
        icon={Target}
        tooltip={TOOLTIPS.profitFactor}
      />
      <MetricCard
        label="Win Rate"
        value={displayValue('winRate', winRate)}
        format="percent"
        size="compact"
        semantic={toneFor('winRate', winRate)}
        icon={Percent}
        tooltip={TOOLTIPS.winRate}
      />
    </div>
  );
});

export default RiskMetricsRow;
