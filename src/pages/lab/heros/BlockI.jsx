// ═══════════════════════════════════════════════════════════════
//  DIRECTION I — « La Console »
//  Frontière = barre pleine largeur (libellé PORTEFEUILLE + filet
//  franc). Bande KPI = UNE rangée dense (NET LIQ héros + sparkline en
//  tête, les 12 autres uniformes). Chart NLV plein dessous, pied dense
//  8 colonnes. Parti pris : lecture « console de trading » horizontale,
//  tout d'un coup d'œil. DEV-only, purgé fin 1.D.
// ═══════════════════════════════════════════════════════════════

import { Frontier, KpiBand, RangeSelector, ViewToggle, ChartFooter } from './blockParts';
import NlvChart from './NlvChart';

export default function BlockI({ series, stats, cells, range, setRange, view, setView, lineMode }) {
  return (
    <section className="lh-block lh-block--i">
      <Frontier variant="rule" />
      <KpiBand cells={cells} layout="row" />
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
        <div className="lh-chart__body lh-chart__body--i">
          <NlvChart data={series} view={view} line={lineMode} gradId="lhI" />
        </div>
        <ChartFooter stats={stats} columns={8} />
      </div>
    </section>
  );
}
