// ═══════════════════════════════════════════════════════════════
//  IV RANK HISTOGRAM v3.0
//
//  Vertical bars per ticker showing IV Rank 0-100 with threshold
//  markers at 30 (low) and 70 (high). Color-coded: low=warning,
//  normal=accent, high=loss. No external chart lib — pure SVG.
// ═══════════════════════════════════════════════════════════════

import InfoTooltip from '../ui/InfoTooltip';
import EmptyState from '../ui/EmptyState';
import { BarChart3 } from 'lucide-react';

const TOOLTIP = {
  title: 'IV Rank',
  body: 'Volatilité implicite actuelle positionnée dans son range 52 semaines. 0 = minimum annuel, 100 = maximum annuel.',
  formula: '(IV − IV_min_52w) / (IV_max_52w − IV_min_52w) × 100',
  example: 'IV Rank 45 = milieu de range annuel. Zone Sniper OTM préfère IV Rank < 40.',
};

function toneForRank(r) {
  if (r < 30) return 'warning';
  if (r > 70) return 'loss';
  return 'accent';
}

export default function IVRankHistogram({ data, className }) {
  const rows = Array.isArray(data) ? data : [];

  if (rows.length === 0) {
    return (
      <EmptyState
        size="compact"
        icon={BarChart3}
        title="Pas d'IV Rank disponible"
        description="Ajoute des positions optionnelles ou synchronise la chaîne via l'API Finnhub."
      />
    );
  }

  return (
    <div className={['iv-rank', className].filter(Boolean).join(' ')}>
      <div className="iv-rank__head">
        <span className="uppercase-label">IV Rank par ticker</span>
        <InfoTooltip content={TOOLTIP} size={12} />
      </div>

      <div className="iv-rank__chart" role="img" aria-label="Histogramme IV Rank">
        {/* Threshold lines */}
        <div className="iv-rank__scale">
          <span style={{ bottom: '0%' }}>0</span>
          <span style={{ bottom: '30%' }}>30</span>
          <span style={{ bottom: '70%' }}>70</span>
          <span style={{ bottom: '100%' }}>100</span>
        </div>
        <div className="iv-rank__bars">
          {rows.map((r, i) => {
            const tone = toneForRank(r.ivRank);
            return (
              <div key={i} className="iv-rank__col">
                <div className="iv-rank__bar-wrap">
                  <div
                    className="iv-rank__bar"
                    data-tone={tone}
                    style={{ height: `${r.ivRank}%` }}
                    title={`${r.ticker} · IV Rank ${r.ivRank}%`}
                  />
                </div>
                <span className="iv-rank__value mono">{Math.round(r.ivRank)}</span>
                <span className="iv-rank__ticker mono">{r.ticker}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
