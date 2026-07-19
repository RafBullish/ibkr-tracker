// ═══════════════════════════════════════════════════════════════
//  DIRECTION B — « Le Ruban »
//  Canvas pleine largeur bord à bord + pied de stats DENSE en une
//  bande (évolution du footer 3-cellules actuel → 7 cellules). Parti
//  pris : continuité avec le pattern existant, risque minimal, le
//  chart occupe toute la largeur, le gros chiffre vit dans le header.
//  DEV-only, purgé fin 1.D.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import EquityCanvas from './EquityCanvas';
import { RangeSelector, ViewToggle, StatCell } from './parts';
import { filterByTimeframe, deriveStats, fmtUsd, fmtPct } from './kit';

export default function HeroB({ scenario, range, setRange, view, setView, colorMode }) {
  const filtered = useMemo(
    () => filterByTimeframe(scenario.data, range),
    [scenario.data, range]
  );
  const stats = useMemo(() => deriveStats(filtered, scenario.base), [filtered, scenario.base]);
  const isNlv = scenario.base > 0;
  const rangeDelta = stats.empty ? 0 : stats.current - (filtered[0]?.equity ?? 0);
  // % seulement si base d'équité réelle (NLV) — sinon dishonnête (cf. kit).
  const rangePct =
    stats.empty || !stats.hasBase || !filtered[0]?.equity
      ? null
      : (rangeDelta / Math.abs(filtered[0].equity)) * 100;
  const deltaTone = rangeDelta > 0 ? 'profit' : rangeDelta < 0 ? 'loss' : 'mute';

  return (
    <section className="lh-hero lh-hero--b">
      <header className="lh-hero__head lh-hero__head--b">
        <div className="lh-hero__hero-inline">
          <span className="lh-hero__title">{isNlv ? 'Net Liquidation' : 'Equity Curve'}</span>
          <span className="lh-hero__bignum">{stats.empty ? '—' : fmtUsd(stats.current)}</span>
          {!stats.empty ? (
            <span className={`lh-hero__deltapill lh-hero__deltapill--${deltaTone}`}>
              {rangeDelta > 0 ? '+' : rangeDelta < 0 ? '−' : ''}
              {fmtUsd(Math.abs(rangeDelta))}
              {rangePct != null ? ` (${fmtPct(rangePct)})` : ''}
            </span>
          ) : null}
        </div>
        <div className="lh-hero__controls">
          <ViewToggle view={view} setView={setView} />
          <RangeSelector range={range} setRange={setRange} id="B" />
        </div>
      </header>

      <div className="lh-hero__bodywrap">
        <EquityCanvas
          data={filtered}
          view={view}
          colorMode={colorMode}
          markerStyle="dot"
          showPct={isNlv}
          gradId="lhB"
        />
      </div>

      <footer className="lh-ribbon">
        <StatCell label="PEAK ALL" value={stats.empty ? '—' : fmtUsd(stats.peak)} />
        <StatCell label="HIGH / LOW" value={stats.empty ? '—' : fmtUsd(stats.high)} sub={stats.empty ? null : `bas ${fmtUsd(stats.low)}`} />
        <StatCell label="MAX DD" value={stats.empty ? '—' : fmtUsd(-stats.maxDD)} sub={stats.empty || stats.maxDDPct == null ? null : fmtPct(stats.maxDDPct)} />
        <StatCell label="CURRENT DD" value={stats.empty ? '—' : fmtUsd(-stats.currentDD)} sub={stats.empty || stats.currentDDPct == null ? null : fmtPct(stats.currentDDPct)} />
        <StatCell label="WIN RATE" value={stats.empty ? '—' : `${stats.winRate.toFixed(0)}%`} sub={stats.empty ? null : `${stats.count} tr.`} />
        <StatCell label="BEST" value={stats.empty ? '—' : fmtUsd(stats.best)} tone={stats.empty ? undefined : 'profit'} />
        <StatCell label="WORST" value={stats.empty ? '—' : fmtUsd(stats.worst)} tone={stats.empty ? undefined : 'loss'} />
        <StatCell label="VOL / TR." value={stats.empty ? '—' : fmtUsd(stats.vol)} />
      </footer>
    </section>
  );
}
