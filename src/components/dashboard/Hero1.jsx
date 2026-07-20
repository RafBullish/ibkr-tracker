// ═══════════════════════════════════════════════════════════════
//  HÉROS 1 (brique 1.D) — bloc Equity/NLV pleine largeur.
//  Structure B « Bi-héros » ratifiée par Rafael :
//    · frontière Marché / Portefeuille
//    · ZONE HAUTE KPI = 2 gros chiffres d'ancrage (LIQUIDITÉ DISPO +
//      DAY P&L) + rangée de support (KpiBiHero)
//    · séparation forte
//    · ZONE GRAPHE : NLV GÉANT en overlay sur le graphe terminal
//      (lightweight-charts) + bande perf par période + toggles
//    · bande stats enrichie du bas
//
//  Donnée : série héros = NLV DENSE (settings.dailySnapshots + point
//  live du jour), jamais le cumPnL par trade. Drawdown flow-neutral
//  (un apport ne guérit pas un drawdown). Loi de couleur respectée.
//
//  LIQUIDITÉ DISPO = VRAIE Available Funds IBKR (settings.ibkrLiveData,
//  bridge local) quand le snapshot est frais → chiffre réel, marqueur
//  « IBKR ». Sinon → estimation cash-A + marqueur « est. » (fast-follow
//  1/5). Le Flex EOD n'expose pas la Buying Power ; seul le bridge le fait.
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState, lazy, Suspense } from 'react';
import { Frontier, ZoneSep, RangeSelector, ViewToggle, ChartFooter, NlvHero } from './hero1/parts';
import PortfolioDeck from './hero1/PortfolioDeck';
import PerfBand from './hero1/PerfBand';
// Le graphe terminal (lightweight-charts, ~canvas) est code-split : la
// dépendance ne pèse QUE sur son propre chunk, hors bundle index.
const TvChart = lazy(() => import('./hero1/TvChart'));
import { deriveKpisReal } from './hero1/model';
import { buildNlvSeries, resampleSeries, deriveSeriesStats, deriveWindowStats } from '../../utils/nlvSeries';
import { usePortfolioMetrics } from '../../hooks/usePortfolioMetrics';
import { useTradingMetrics } from '../../hooks/useTradingMetrics';
import useDailyPnL from '../../hooks/useDailyPnL';
import useGreeksAggregate from '../../hooks/useGreeksAggregate';
import useAvailableCapital, { resolveLiveAvailableUsd } from '../../hooks/useAvailableCapital';
import { useOpenPositions, useClosedTrades, useCashFlows, useSettings } from '../../store/useStore';
import { totalSlDollar, totalNotional } from '../../utils/risk';

export default function Hero1({ area = 'hero1' }) {
  const [range, setRange] = useState('ALL');
  const [view, setView] = useState('equity');

  const metrics = usePortfolioMetrics();
  const greeks = useGreeksAggregate();
  const avail = useAvailableCapital();
  const openPositions = useOpenPositions();
  const closedTrades = useClosedTrades();
  const cashFlows = useCashFlows();
  const settings = useSettings();
  const trading = useTradingMetrics(closedTrades, metrics?.liveRate || 1);
  const dailyPnL = useDailyPnL();
  const today = new Date().toISOString().slice(0, 10);
  const rate = metrics?.liveRate || null;

  // WTD / YTD = sommes des clôtures (semaine / année) via useDailyPnL.
  const { wtd, ytd } = useMemo(() => {
    if (!Array.isArray(dailyPnL) || dailyPnL.length === 0) return { wtd: null, ytd: null };
    const now = new Date();
    const yearStart = `${now.getFullYear()}-01-01`;
    // Début de semaine (lundi) en ISO.
    const dow = (now.getDay() + 6) % 7;
    const weekStart = new Date(now.getTime() - dow * 86_400_000).toISOString().slice(0, 10);
    let w = 0;
    let y = 0;
    for (const d of dailyPnL) {
      const v = d.dailyPnl || 0;
      if (d.date >= yearStart) y += v;
      if (d.date >= weekStart) w += v;
    }
    return { wtd: w, ytd: y };
  }, [dailyPnL]);

  const notional = useMemo(() => totalNotional(openPositions), [openPositions]);

  // Fast-follow 1/5 — VRAIE liquidité déployable : Available Funds IBKR
  // (bridge live) si le snapshot est frais, sinon `null` → on retombe sur
  // l'estimation cash-A (avail.availableUsd) et le marqueur « est. ».
  const realAvailableUsd = useMemo(
    () => resolveLiveAvailableUsd(settings?.ibkrLiveData, metrics?.liveRate),
    [settings?.ibkrLiveData, metrics?.liveRate]
  );

  const dailyFull = useMemo(
    () =>
      buildNlvSeries({
        snapshots: settings?.dailySnapshots || [],
        cashFlows,
        closedTrades,
        liveNlv: metrics?.netLiquidationValueUsd ?? null,
        liveRate: metrics?.liveRate || 1,
        today,
      }),
    [settings?.dailySnapshots, cashFlows, closedTrades, metrics, today]
  );

  const series = useMemo(() => resampleSeries(dailyFull, range), [dailyFull, range]);
  const stats = useMemo(() => deriveSeriesStats(series), [series]);
  const windowStats = useMemo(() => deriveWindowStats(series), [series]);
  const kpi = useMemo(
    () =>
      deriveKpisReal({
        metrics,
        greeks,
        availableUsd: realAvailableUsd ?? avail?.availableUsd,
        availableIsReal: realAvailableUsd != null,
        riskDollar: totalSlDollar(openPositions),
        positions: openPositions,
        series: dailyFull,
        winRate: trading?.winRate,
        profitFactor: trading?.profitFactor,
        expectancy: trading?.expectancy,
        tradesCount: trading?.totalPnlCount ?? (closedTrades || []).length,
        trading,
        notional,
        mtd: metrics?.monthlyPnlUsd,
        ytd,
        wtd,
        today,
      }),
    [metrics, greeks, avail, realAvailableUsd, openPositions, dailyFull, trading, notional, closedTrades, ytd, wtd, today]
  );

  return (
    <section className="lh-final" style={{ gridArea: area }}>
      <Frontier />
      <PortfolioDeck kpi={kpi} rate={rate} />
      <ZoneSep label="GRAPHIQUE" />
      <div className="lh-graphzone">
        <div className="lh-graphzone__bar">
          <span className="lh-chart__title">EQUITY / NLV</span>
          <div className="lh-chart__controls">
            <ViewToggle view={view} setView={setView} />
            <RangeSelector range={range} setRange={setRange} />
          </div>
        </div>
        {view === 'drawdown' ? (
          <div className="lh-perf">
            <span className="lh-perf__head">DRAWDOWN · {range}</span>
            <span className="lh-perf__none">vue underwater — perf de fenêtre masquée</span>
          </div>
        ) : (
          <PerfBand w={windowStats} range={range} rate={rate} />
        )}
        <div className="lh-fuse__stage">
          <div className="lh-fuse__overlay">
            <NlvHero nlv={kpi.nlv} rate={rate} dayPnl={kpi.dayPnl} dayPct={kpi.dayPct} spark={kpi.nlvSpark} size="lg" />
          </div>
          <div className="lh-fuse__chart">
            <Suspense fallback={<div className="lh-canvas lh-canvas--empty">Chargement…</div>}>
              <TvChart data={series} view={view} line="neutral" intraday={false} />
            </Suspense>
          </div>
        </div>
      </div>
      <ChartFooter stats={stats} rate={rate} />
    </section>
  );
}
