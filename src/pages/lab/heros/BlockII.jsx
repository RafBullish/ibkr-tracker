// ═══════════════════════════════════════════════════════════════
//  DIRECTION II — « Le Cartouche »
//  Frontière = pas tonal (la zone basse sur un plan légèrement décalé
//  + libellé). NET LIQ PROMU dans l'en-tête du graphe (gros chiffre +
//  spark + DAY pill) — NLV et courbe = une seule pièce. Bande KPI =
//  ceinture compacte des 12 autres, entre frontière et graphe. Parti
//  pris : le chiffre reine et sa courbe fusionnés, le reste en ceinture
//  secondaire. DEV-only, purgé fin 1.D.
// ═══════════════════════════════════════════════════════════════

import { Frontier, KpiBand, MiniSpark, RangeSelector, ViewToggle, ChartFooter } from './blockParts';
import NlvChart from './NlvChart';
import { fmtUsd, fmtUsdSigned, toneSign } from './kit';

export default function BlockII({ series, stats, cells, kpi, range, setRange, view, setView, lineMode }) {
  const beltCells = cells.filter((c) => c.id !== 'nlv');
  const dayTone = toneSign(kpi.dayPnl);

  return (
    <section className="lh-block lh-block--ii">
      <Frontier variant="step" />
      <KpiBand cells={beltCells} layout="belt" />
      <div className="lh-chart lh-chart--fused">
        <header className="lh-chart__head lh-chart__head--fused">
          <div className="lh-fusehero">
            <span className="lh-fusehero__label">NET LIQ</span>
            <span className="lh-fusehero__value">{kpi.nlv == null ? '—' : fmtUsd(kpi.nlv)}</span>
            {kpi.dayPnl != null ? (
              <span className={`lh-fusehero__pill${dayTone ? ` lh-fusehero__pill--${dayTone}` : ''}`}>
                {fmtUsdSigned(kpi.dayPnl)}
                {kpi.dayPct != null ? ` · ${kpi.dayPct >= 0 ? '+' : '−'}${Math.abs(kpi.dayPct).toFixed(2)}%` : ''}
              </span>
            ) : null}
            <MiniSpark points={kpi.nlvSpark} w={120} h={30} />
          </div>
          <div className="lh-chart__controls">
            <ViewToggle view={view} setView={setView} />
            <RangeSelector range={range} setRange={setRange} />
          </div>
        </header>
        <div className="lh-chart__body lh-chart__body--ii">
          <NlvChart data={series} view={view} line={lineMode} gradId="lhII" />
        </div>
        <ChartFooter stats={stats} columns={6} />
      </div>
    </section>
  );
}
