// ═══════════════════════════════════════════════════════════════
//  MODÈLE A — « Cartouche affiné » (DEV-only, purgé 1.D)
//  La direction ratifiée, polie. Empilement vertical clair :
//  frontière · héros NLV + spark (haut) + ceinture KPI · séparation
//  forte · bande perf + graphe terminal + bande stats.
// ═══════════════════════════════════════════════════════════════

import { Frontier, NlvHero, KpiBelt, ZoneSep, RangeSelector, ViewToggle, ChartFooter } from './blockParts';
import PerfBand from './PerfBand';
import ChartSwitch from './ChartSwitch';

export default function ModelA({ series, windowStats, stats, cells, kpi, rate, range, setRange, view, setView, lineMode, intraday, engine }) {
  return (
    <section className="lh-model lh-model--a">
      <Frontier />
      <div className="lh-zone1">
        <NlvHero nlv={kpi.nlv} rate={rate} dayPnl={kpi.dayPnl} dayPct={kpi.dayPct} spark={kpi.nlvSpark} size="md" />
        <KpiBelt cells={cells} rate={rate} />
      </div>
      <ZoneSep label="GRAPHIQUE" />
      <div className="lh-zone3">
        <div className="lh-chart__head">
          <span className="lh-chart__title">EQUITY / NLV</span>
          <span className="lh-chart__sub">{stats.empty ? '—' : `${(stats.firstDate || '').slice(0, 10)} → ${(stats.lastDate || '').slice(0, 10)} · ${stats.points} pts`}</span>
          <div className="lh-chart__controls"><ViewToggle view={view} setView={setView} /><RangeSelector range={range} setRange={setRange} /></div>
        </div>
        {view === 'drawdown'
          ? <div className="lh-perf"><span className="lh-perf__head">DRAWDOWN · {range}</span><span className="lh-perf__none">vue underwater — perf de fenêtre masquée</span></div>
          : <PerfBand w={windowStats} range={range} rate={rate} />}
        <div className="lh-chart__body lh-chart__body--a"><ChartSwitch engine={engine} data={series} view={view} line={lineMode} intraday={intraday} /></div>
        <ChartFooter stats={stats} rate={rate} />
      </div>
    </section>
  );
}
