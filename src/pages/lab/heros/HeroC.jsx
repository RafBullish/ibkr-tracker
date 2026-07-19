// ═══════════════════════════════════════════════════════════════
//  DIRECTION C — « Le Diptyque »
//  Deux panneaux empilés partageant le même X : équité (haut) +
//  underwater/drawdown (bas, collé à sa ligne de zéro). Parti pris :
//  le drawdown est TOUJOURS visible comme contexte (pas caché derrière
//  un toggle) — lecture « pro platform ». Le toggle change quel
//  panneau domine (emphase), les deux restent présents.
//  DEV-only, purgé fin 1.D.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import EquityCanvas from './EquityCanvas';
import { RangeSelector, ViewToggle, StatCell } from './parts';
import { filterByTimeframe, deriveStats, fmtUsd, fmtPct } from './kit';

export default function HeroC({ scenario, range, setRange, view, setView, colorMode }) {
  const filtered = useMemo(
    () => filterByTimeframe(scenario.data, range),
    [scenario.data, range]
  );
  const stats = useMemo(() => deriveStats(filtered, scenario.base), [filtered, scenario.base]);
  const isNlv = scenario.base > 0;
  const rangeDelta = stats.empty ? 0 : stats.current - (filtered[0]?.equity ?? 0);
  const deltaTone = rangeDelta > 0 ? 'profit' : rangeDelta < 0 ? 'loss' : 'mute';
  const equityDominant = view !== 'drawdown';

  return (
    <section className="lh-hero lh-hero--c">
      <header className="lh-hero__head">
        <div className="lh-hero__hero-inline">
          <span className="lh-hero__title">{isNlv ? 'Net Liquidation' : 'Equity Curve'}</span>
          <span className="lh-hero__bignum">{stats.empty ? '—' : fmtUsd(stats.current)}</span>
          {!stats.empty ? (
            <span className={`lh-hero__deltapill lh-hero__deltapill--${deltaTone}`}>
              {rangeDelta > 0 ? '+' : rangeDelta < 0 ? '−' : ''}
              {fmtUsd(Math.abs(rangeDelta))}
            </span>
          ) : null}
          {!stats.empty ? (
            <span className="lh-hero__ddchip">
              DD {fmtUsd(-stats.currentDD)}
              {stats.currentDDPct != null ? ` · ${fmtPct(stats.currentDDPct)}` : ''}
            </span>
          ) : null}
        </div>
        <div className="lh-hero__controls">
          <ViewToggle view={view} setView={setView} />
          <RangeSelector range={range} setRange={setRange} id="C" />
        </div>
      </header>

      <div className="lh-hero__bodywrap lh-hero__bodywrap--diptych">
        <div className={`lh-pane ${equityDominant ? 'lh-pane--tall' : 'lh-pane--short'}`}>
          <span className="lh-pane__tag">ÉQUITÉ</span>
          <EquityCanvas
            data={filtered}
            view="equity"
            colorMode={colorMode}
            markerStyle="tick"
            showPct={isNlv}
            gradId="lhCeq"
          />
        </div>
        <div className={`lh-pane lh-pane--under ${equityDominant ? 'lh-pane--short' : 'lh-pane--tall'}`}>
          <span className="lh-pane__tag">UNDERWATER</span>
          <EquityCanvas
            data={filtered}
            view="drawdown"
            colorMode={colorMode}
            showMarkers={false}
            showPct={isNlv}
            gradId="lhCdd"
          />
        </div>
      </div>

      <footer className="lh-ribbon lh-ribbon--c">
        <StatCell label="PEAK ALL" value={stats.empty ? '—' : fmtUsd(stats.peak)} />
        <StatCell label="MAX DD" value={stats.empty ? '—' : fmtUsd(-stats.maxDD)} sub={stats.empty || stats.maxDDPct == null ? null : fmtPct(stats.maxDDPct)} />
        <StatCell label="WIN RATE" value={stats.empty ? '—' : `${stats.winRate.toFixed(0)}%`} sub={stats.empty ? null : `${stats.count} tr.`} />
        <StatCell label="VOL / TR." value={stats.empty ? '—' : fmtUsd(stats.vol)} />
        <StatCell label="SHARPE*" value={stats.empty ? '—' : stats.sharpe.toFixed(2)} />
      </footer>
    </section>
  );
}
