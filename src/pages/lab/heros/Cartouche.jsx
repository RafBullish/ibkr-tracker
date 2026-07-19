// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — LE CARTOUCHE (bloc portefeuille quasi-final).
//  DEV-only, purgé fin 1.D. 3 zones empilées :
//    ZONE 1 — DONNÉES  : héros NLV live + bande KPI ceinture (état courant)
//    ZONE 2 — SÉPARATION forte données / graphe
//    ZONE 3 — GRAPHE   : bande perf (période) + graphe pro + pied stats
// ═══════════════════════════════════════════════════════════════

import { Frontier, NlvHero, KpiBelt, ZoneSep, RangeSelector, ViewToggle, ChartFooter } from './blockParts';
import PerfBand from './PerfBand';
import NlvChart from './NlvChart';

export default function Cartouche({ series, windowStats, stats, cells, kpi, rate, range, setRange, view, setView, lineMode, perfHypo }) {
  return (
    <section className="lh-cartouche">
      <Frontier />

      {/* ZONE 1 — DONNÉES (état général, live) */}
      <div className="lh-zone1">
        <NlvHero nlv={kpi.nlv} rate={rate} dayPnl={kpi.dayPnl} dayPct={kpi.dayPct} spark={kpi.nlvSpark} />
        <KpiBelt cells={cells} rate={rate} />
      </div>

      {/* ZONE 2 — SÉPARATION forte */}
      <ZoneSep label="GRAPHIQUE" />

      {/* ZONE 3 — GRAPHE (3 étages) */}
      <div className="lh-zone3">
        <div className="lh-chart__head">
          <span className="lh-chart__title">EQUITY / NLV</span>
          <span className="lh-chart__sub">
            {stats.empty ? '—' : `${(stats.firstDate || '').slice(0, 10)} → ${(stats.lastDate || '').slice(0, 10)} · ${stats.points} pts`}
          </span>
          <div className="lh-chart__controls">
            <ViewToggle view={view} setView={setView} />
            <RangeSelector range={range} setRange={setRange} />
          </div>
        </div>

        {/* Étage 1 — bande perf, se recalcule par période */}
        {view === 'drawdown' ? (
          <div className="lh-perf lh-perf--dd">
            <span className="lh-perf__title">DRAWDOWN · {range}</span>
            <span className="lh-perf__none">vue underwater — perf de fenêtre masquée</span>
          </div>
        ) : (
          <PerfBand w={windowStats} range={range} hypothesis={perfHypo} rate={rate} />
        )}

        {/* Étage 2 — le graphe */}
        <div className="lh-chart__body">
          <NlvChart data={series} view={view} line={lineMode} gradId="lhCart" />
        </div>

        {/* Étage 3 — pied stats (extrêmes & drawdown), indépendant */}
        <ChartFooter stats={stats} rate={rate} />
      </div>
    </section>
  );
}
