// ═══════════════════════════════════════════════════════════════
//  MODÈLE B — « Héros fusionné » (DEV-only, purgé 1.D)
//  Le NLV et son graphe = UNE seule pièce maîtresse : le grand chiffre
//  ancré EN OVERLAY sur un graphe DOMINANT (tall). Bande perf en
//  surimpression haute. KPI + stats disposés DESSOUS. Graphe roi.
// ═══════════════════════════════════════════════════════════════

import { Frontier, NlvHero, KpiBelt, RangeSelector, ViewToggle, ChartFooter } from './blockParts';
import PerfBand from './PerfBand';
import ChartSwitch from './ChartSwitch';

export default function ModelB({ series, windowStats, stats, cells, kpi, rate, range, setRange, view, setView, lineMode, intraday, engine }) {
  return (
    <section className="lh-model lh-model--b">
      <Frontier />
      <div className="lh-fuse">
        <div className="lh-fuse__bar">
          <span className="lh-chart__title">EQUITY / NLV</span>
          <div className="lh-chart__controls"><ViewToggle view={view} setView={setView} /><RangeSelector range={range} setRange={setRange} /></div>
        </div>
        {view === 'drawdown'
          ? <div className="lh-perf"><span className="lh-perf__head">DRAWDOWN · {range}</span><span className="lh-perf__none">vue underwater — perf de fenêtre masquée</span></div>
          : <PerfBand w={windowStats} range={range} rate={rate} />}
        <div className="lh-fuse__stage">
          {/* Overlay héros ancré sur le graphe (pointer-events none → crosshair dessous) */}
          <div className="lh-fuse__overlay">
            <NlvHero nlv={kpi.nlv} rate={rate} dayPnl={kpi.dayPnl} dayPct={kpi.dayPct} spark={kpi.nlvSpark} size="lg" />
          </div>
          <div className="lh-fuse__chart"><ChartSwitch engine={engine} data={series} view={view} line={lineMode} intraday={intraday} /></div>
        </div>
      </div>
      <KpiBelt cells={cells} rate={rate} />
      <ChartFooter stats={stats} rate={rate} />
    </section>
  );
}
