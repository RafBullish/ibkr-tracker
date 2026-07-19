// ═══════════════════════════════════════════════════════════════
//  BLOC FINAL 1.D — « Héros fusionné » (base B) + bande KPI générale
//  remontée EN HAUT (base A). DEV-only, purgé fin 1.D.
//
//  Structure (haut → bas) :
//    1. Frontière Marché / Portefeuille (structurelle)
//    2. BANDE KPI GÉNÉRALE (état live, TOUS les KPI sauf NLV) — grande,
//       dense, enrichie (double devise CHF agrandi, micro-contexte,
//       micro-sparklines), packing serré, grille 2 rangs
//    3. Séparation FORTE données / graphe
//    4. ZONE GRAPHE : titre + toggle + périodes · bande perf (période) ·
//       graphe terminal lightweight-charts avec NLV GÉANT en overlay
//    5. BANDE STATS enrichie (indépendante)
// ═══════════════════════════════════════════════════════════════

import { Frontier, NlvHero, ZoneSep, RangeSelector, ViewToggle, ChartFooter } from './blockParts';
import { KpiTerminal, KpiBiHero } from './KpiZones';
import PerfBand from './PerfBand';
import TvChart from './TvChart';

export default function FinalBlock({ series, windowStats, stats, cells, kpi, rate, range, setRange, view, setView, lineMode, intraday, topStructure = 'A' }) {
  return (
    <section className="lh-final">
      <Frontier />

      {/* 2 · ZONE HAUTE KPI (état live) — 2 structures au choix */}
      {topStructure === 'B' ? <KpiBiHero cells={cells} rate={rate} /> : <KpiTerminal cells={cells} rate={rate} />}

      {/* 3 · Séparation forte */}
      <ZoneSep label="GRAPHIQUE" />

      {/* 4 · ZONE GRAPHE (concept B : NLV géant en overlay) */}
      <div className="lh-graphzone">
        <div className="lh-graphzone__bar">
          <span className="lh-chart__title">EQUITY / NLV</span>
          <div className="lh-chart__controls"><ViewToggle view={view} setView={setView} /><RangeSelector range={range} setRange={setRange} /></div>
        </div>
        {view === 'drawdown'
          ? <div className="lh-perf"><span className="lh-perf__head">DRAWDOWN · {range}</span><span className="lh-perf__none">vue underwater — perf de fenêtre masquée</span></div>
          : <PerfBand w={windowStats} range={range} rate={rate} />}
        <div className="lh-fuse__stage">
          <div className="lh-fuse__overlay">
            <NlvHero nlv={kpi.nlv} rate={rate} dayPnl={kpi.dayPnl} dayPct={kpi.dayPct} spark={kpi.nlvSpark} size="lg" />
          </div>
          <div className="lh-fuse__chart"><TvChart data={series} view={view} line={lineMode} intraday={intraday} /></div>
        </div>
      </div>

      {/* 5 · BANDE STATS enrichie (indépendante) */}
      <ChartFooter stats={stats} rate={rate} />
    </section>
  );
}
