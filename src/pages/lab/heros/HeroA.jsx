// ═══════════════════════════════════════════════════════════════
//  DIRECTION A — « Le Bandeau Latéral »
//  Canvas maximal à gauche + rail de stats vertical à droite (ledger
//  persistant, façon terminal). Parti pris : le graphe respire, les
//  stats restent lisibles en colonne sans jamais rogner la courbe.
//  DEV-only, purgé fin 1.D.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import EquityCanvas from './EquityCanvas';
import { RangeSelector, ViewToggle, StatCell } from './parts';
import { filterByTimeframe, deriveStats, fmtUsd, fmtUsdSigned, fmtPct } from './kit';

export default function HeroA({ scenario, range, setRange, view, setView, colorMode }) {
  const filtered = useMemo(
    () => filterByTimeframe(scenario.data, range),
    [scenario.data, range]
  );
  const stats = useMemo(() => deriveStats(filtered, scenario.base), [filtered, scenario.base]);
  const isNlv = scenario.base > 0;
  const rangeDelta = stats.empty ? 0 : stats.current - (filtered[0]?.equity ?? 0);
  const deltaTone = rangeDelta > 0 ? 'profit' : rangeDelta < 0 ? 'loss' : 'mute';

  return (
    <section className="lh-hero lh-hero--a">
      <header className="lh-hero__head">
        <div className="lh-hero__titlewrap">
          <span className="lh-hero__title">{isNlv ? 'Net Liquidation' : 'Equity Curve'}</span>
          <span className="lh-hero__sub">
            {stats.empty ? '—' : `${stats.firstDate} → ${stats.lastDate}`}
          </span>
        </div>
        <div className="lh-hero__controls">
          <ViewToggle view={view} setView={setView} />
          <RangeSelector range={range} setRange={setRange} id="A" />
        </div>
      </header>

      <div className="lh-hero__bodywrap lh-hero__bodywrap--rail">
        <EquityCanvas
          data={filtered}
          view={view}
          colorMode={colorMode}
          markerStyle="ring"
          showPct={isNlv}
          gradId="lhA"
        />
        <aside className="lh-rail">
          <div className="lh-rail__hero">
            <span className="lh-rail__hero-label">{isNlv ? 'NLV · LIVE' : 'CURRENT'}</span>
            <span className="lh-rail__hero-value">{stats.empty ? '—' : fmtUsd(stats.current)}</span>
            {isNlv && !stats.empty ? (
              <span className="lh-rail__hero-sub">déployé {fmtUsd(filtered[filtered.length - 1]?.capital)}</span>
            ) : null}
          </div>
          <div className="lh-rail__grid">
            <StatCell label={`Δ ${range}`} value={stats.empty ? '—' : `${rangeDelta > 0 ? '+' : rangeDelta < 0 ? '−' : ''}${fmtUsd(Math.abs(rangeDelta))}`} tone={stats.empty ? undefined : deltaTone} />
            <StatCell label="PEAK ALL" value={stats.empty ? '—' : fmtUsd(stats.peak)} />
            <StatCell label="MAX DD" value={stats.empty ? '—' : fmtUsd(-stats.maxDD)} sub={stats.empty || stats.maxDDPct == null ? null : fmtPct(stats.maxDDPct)} />
            <StatCell label="CURRENT DD" value={stats.empty ? '—' : fmtUsd(-stats.currentDD)} sub={stats.empty || stats.currentDDPct == null ? null : fmtPct(stats.currentDDPct)} />
            <StatCell label="WIN RATE" value={stats.empty ? '—' : `${stats.winRate.toFixed(0)}%`} sub={stats.empty ? null : `${stats.count} tr.`} />
            <StatCell label="PROFIT F." value={stats.empty ? '—' : (Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞')} />
            <StatCell label="VOL / TR." value={stats.empty ? '—' : fmtUsd(stats.vol)} />
            <StatCell label="SHARPE*" value={stats.empty ? '—' : stats.sharpe.toFixed(2)} />
          </div>
        </aside>
      </div>
    </section>
  );
}
