// ═══════════════════════════════════════════════════════════════
//  SECTOR HEATMAP v4 brick 7 — module col 7-9 row 3 (200 px)
//
//  Treemap simplifiée 4 × 3 (12 cells, 11 sectors + 1 vide).
//  Pas de pondération market cap pour cette brick — toutes les
//  cells ont la même taille. Une vraie treemap weighted serait
//  une brick séparée si demandée.
//
//  Cell content :
//    - Top : code 3-4 lettre (TECH / FIN / HLTH / DISC / etc.)
//    - Bottom : perf jour signée
//  Background : color-mix var(--profit/loss) avec alpha
//  proportionnelle à |perf| (sectorAlpha).
// ═══════════════════════════════════════════════════════════════

import { sectorShortCode, sectorTone, sectorAlpha } from '../../utils/sectors';

const fmtPctSigned = (v, digits = 2) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return '0.00 %';
  const sign = v > 0 ? '+' : '−';
  return `${sign}${Math.abs(v).toFixed(digits)} %`;
};

function HeatCell({ sector }) {
  const tone = sectorTone(sector.perfDayPct);
  const alpha = sectorAlpha(sector.perfDayPct);
  const code = sectorShortCode(sector.code);
  const baseColor = tone.startsWith('profit')
    ? 'var(--profit)'
    : tone.startsWith('loss')
      ? 'var(--loss)'
      : 'var(--text-tertiary)';

  return (
    <div
      className="heat-cell"
      title={`${sector.label} · ${fmtPctSigned(sector.perfDayPct)}${sector.marketCapTrn ? ` · cap $${sector.marketCapTrn}T` : ''}`}
      style={{
        background: `color-mix(in srgb, ${baseColor} ${Math.round(alpha * 100)}%, transparent)`,
      }}
    >
      <span className="heat-cell__code">{code}</span>
      <span className={`heat-cell__pct heat-cell__pct--${tone}`}>
        {fmtPctSigned(sector.perfDayPct)}
      </span>
    </div>
  );
}

export default function SectorHeatmap({ data, area = 'heat' }) {
  const sectors = Array.isArray(data) ? data : [];
  const isEmpty = sectors.length === 0;

  return (
    <section className="module sector-heatmap" style={{ gridArea: area }}>
      <header className="module-header">
        <span className="module-header__title">Sectors · GICS 11</span>
        <span className="module-header__hint">Today</span>
      </header>
      <div className="module-body sector-heatmap__body">
        {isEmpty ? (
          <div className="sector-heatmap__empty module-empty">
            <span className="module-empty__title">Aucun sector data</span>
            <span className="module-empty__sub">
              Performance par secteur GICS 11. Câblage Finnhub sector ETF prévu en sprint
              data-source.
            </span>
          </div>
        ) : (
          <div className="sector-heatmap__grid">
            {sectors.map((s) => (
              <HeatCell key={s.code} sector={s} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
