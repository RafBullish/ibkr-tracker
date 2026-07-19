// ═══════════════════════════════════════════════════════════════
//  DIRECTION III — « Le Double Rang »
//  Frontière = gouttière à gauche (libellé PORTEFEUILLE vertical +
//  double filet). Bande KPI = DEUX rangs hiérarchisés : rang 1 = 4
//  primaires « coup d'œil du matin » (NET LIQ, DAY P&L, POUDRE,
//  RISQUE) en gros ; rang 2 = les 9 de contexte, plus petits. Chart
//  NLV plein dessous. Parti pris : hiérarchie explicite matin/analyse.
//  DEV-only, purgé fin 1.D.
// ═══════════════════════════════════════════════════════════════

import { Frontier, KpiBand, RangeSelector, ViewToggle, ChartFooter } from './blockParts';
import NlvChart from './NlvChart';

export default function BlockIII({ series, stats, cells, range, setRange, view, setView, lineMode }) {
  return (
    <section className="lh-block lh-block--iii">
      <Frontier variant="gutter" />
      <div className="lh-block__inner">
        <KpiBand cells={cells} layout="twoTier" />
        <div className="lh-chart">
          <header className="lh-chart__head">
            <span className="lh-chart__title">EQUITY / NLV</span>
            <span className="lh-chart__sub">
              {stats.empty ? '—' : `${stats.firstDate} → ${stats.lastDate} · ${stats.points} pts`}
            </span>
            <div className="lh-chart__controls">
              <ViewToggle view={view} setView={setView} />
              <RangeSelector range={range} setRange={setRange} />
            </div>
          </header>
          <div className="lh-chart__body lh-chart__body--iii">
            <NlvChart data={series} view={view} line={lineMode} gradId="lhIII" />
          </div>
          <ChartFooter stats={stats} columns={6} />
        </div>
      </div>
    </section>
  );
}
