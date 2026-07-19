// ═══════════════════════════════════════════════════════════════
//  MODÈLE C — « Grille analytique » (DEV-only, purgé 1.D)
//  Grille structurée et équilibrée : héros NLV (carte) + KPI en
//  MATRICE ordonnée en haut ; les analytiques (bande perf + graphe +
//  stats DENSE) prennent une présence forte et rangée en bas. Dense.
// ═══════════════════════════════════════════════════════════════

import { Frontier, NlvHero, KpiBelt, ZoneSep, RangeSelector, ViewToggle, ChartFooter } from './blockParts';
import PerfBand from './PerfBand';
import ChartSwitch from './ChartSwitch';

export default function ModelC({ series, windowStats, stats, cells, kpi, rate, range, setRange, view, setView, lineMode, intraday, engine }) {
  return (
    <section className="lh-model lh-model--c">
      <Frontier />
      <div className="lh-cgrid">
        <div className="lh-cgrid__hero">
          <NlvHero nlv={kpi.nlv} rate={rate} dayPnl={kpi.dayPnl} dayPct={kpi.dayPct} spark={kpi.nlvSpark} size="sm" />
        </div>
        <div className="lh-cgrid__kpi">
          <KpiBelt cells={cells} rate={rate} layout="matrix" />
        </div>
      </div>
      <ZoneSep label="ANALYSE" />
      <div className="lh-zone3">
        <div className="lh-chart__head">
          <span className="lh-chart__title">EQUITY / NLV</span>
          <span className="lh-chart__sub">{stats.empty ? '—' : `${(stats.firstDate || '').slice(0, 10)} → ${(stats.lastDate || '').slice(0, 10)} · ${stats.points} pts`}</span>
          <div className="lh-chart__controls"><ViewToggle view={view} setView={setView} /><RangeSelector range={range} setRange={setRange} /></div>
        </div>
        {view === 'drawdown'
          ? <div className="lh-perf"><span className="lh-perf__head">DRAWDOWN · {range}</span><span className="lh-perf__none">vue underwater — perf de fenêtre masquée</span></div>
          : <PerfBand w={windowStats} range={range} rate={rate} showDays />}
        <div className="lh-chart__body lh-chart__body--c"><ChartSwitch engine={engine} data={series} view={view} line={lineMode} intraday={intraday} /></div>
        <ChartFooter stats={stats} rate={rate} dense />
      </div>
    </section>
  );
}
