// ═══════════════════════════════════════════════════════════════
//  RISK METRICS ROW v3.0 « Midnight Terminal »
//
//  Six compact flat KPI tiles in a row (desktop) / 2×3 grid (mobile),
//  each with a mandatory InfoTooltip per brief §13.6. Palette canonique
//  plate (cf. History/Positions/Greeks) — plus de <MetricCard>.
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
import InfoTooltip from '../ui/InfoTooltip';

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

// profit/loss/neutral (sémantique de seuil métier) → classe de tonalité
// canonique up/down/neutral.
const TONE_CLASS = { profit: 'up', loss: 'down', neutral: 'neutral' };

// Formatage Intl identique à celui de l'ancien <MetricCard> (mêmes
// locales/décimales → valeurs affichées inchangées).
function fmtMetric(value, format = 'number') {
  if (value == null || Number.isNaN(value)) return '—';
  switch (format) {
    case 'percent':
      return (
        new Intl.NumberFormat('de-CH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(value) + '%'
      );
    case 'r-multiple':
      return (
        new Intl.NumberFormat('de-CH', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 2,
        }).format(value) + 'R'
      );
    case 'number':
    default:
      return new Intl.NumberFormat('de-CH', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
  }
}

const METRIC_ROWS = [
  { key: 'expectancy', label: 'Expectancy', format: 'r-multiple' },
  { key: 'sortino', label: 'Sortino', format: 'number' },
  { key: 'calmar', label: 'Calmar', format: 'number' },
  { key: 'sharpe', label: 'Sharpe', format: 'number' },
  { key: 'profitFactor', label: 'Profit Factor', format: 'number' },
  { key: 'winRate', label: 'Win Rate', format: 'percent' },
];

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
  // A2b — `profitFactor` peut être null au stockage (grossLoss=0 ou
  // lossCount<3). Le cast legacy 999.99 est retiré. displayValue gère
  // null → "—".
  return (
    <div ref={ref} className={['risk-metrics-row', className].filter(Boolean).join(' ')}>
      {METRIC_ROWS.map(({ key, label, format }) => {
        const raw = metrics[key];
        const tone = TONE_CLASS[toneFor(key, raw)];
        return (
          <div key={key} className="risk-metrics-row__tile">
            <span className="risk-metrics-row__tile-label">
              {label}
              <InfoTooltip content={TOOLTIPS[key]} size={12} />
            </span>
            <span
              className={`risk-metrics-row__tile-value risk-metrics-row__tile-value--${tone}`}
            >
              {fmtMetric(displayValue(key, raw), format)}
            </span>
          </div>
        );
      })}
    </div>
  );
});

export default RiskMetricsRow;
