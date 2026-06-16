// ═══════════════════════════════════════════════════════════════
//  DASHBOARD v6 — 4K refonte Phase C.1 / C.2 — Bloomberg-dense bento
//
//  Grid 5 rows (Phase C.2.10 — SniperGate retiré, reconstruction
//  ultérieure) :
//    Row 1 (520px) : Equity col 1-3 | Cumul P&L col 4-6 | RiskMatrix col 7-12
//    Row 2 (auto)  : LivePositions col 1-12 (19 cols Phase C.1 originale)
//    Row 3 (480px) : TradeHistory col 1-12 (14 cols Phase C.2)
//    Row 4 (180px) : Watchlist col 1-6 | CalendarMini col 7-12
//    Row 5 (160px) : IVRankMovers col 1-4 | SectorHeatmap col 5-8 | AlertsFeed col 9-12
//
//  Phase C.1 retire 4 modules du dashboard (leurs fichiers restent
//  pour Greeks/Chain/Premarket) :
//    GreeksAggregate · EarningsCalendar · MarketInternals · VolatilitySkew
//
//  Phase C.2.10 retire SniperGateMonitor du dashboard. Le composant
//  reste sur disque pour reconstruction Phase C.3+ (hook + JSX
//  pourront être ré-introduits sans dépendances cassées).
//
//  RiskMatrix reçoit maintenant un objet metrics fusionné :
//    { ...usePortfolioMetrics(), ...useRiskMatrix(), equityHistory }
//  afin d'accéder à toutes les métriques (sharpe, sortino, sqn, cagr,
//  rMultiples, currentStreak…) sans dupliquer les hook-calls dans
//  RiskMatrix lui-même.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import DashboardKPICards from '../components/dashboard/DashboardKPICards';
import EquityChart from '../components/charts/EquityChart';
import DailyPnLChart from '../components/charts/DailyPnLChart';
import RiskMatrix from '../components/dashboard/RiskMatrix';
import LivePositions from '../components/dashboard/LivePositions';
import Watchlist from '../components/dashboard/Watchlist';
import SectorHeatmap from '../components/dashboard/SectorHeatmap';
import IVRankMovers from '../components/dashboard/IVRankMovers';
import AlertsFeed from '../components/dashboard/AlertsFeed';
import TradeHistory from '../components/dashboard/TradeHistory';
import CalendarMini from '../components/dashboard/CalendarMini';
import useEquityHistory from '../hooks/useEquityHistory';
import useDailyPnL from '../hooks/useDailyPnL';
import useGreeksAggregate from '../hooks/useGreeksAggregate';
import useRiskMatrix from '../hooks/useRiskMatrix';
import useLivePositions from '../hooks/useLivePositions';
import useWatchlist from '../hooks/useWatchlist';
import useSectorHeatmap from '../hooks/useSectorHeatmap';
import useIVMovers from '../hooks/useIVMovers';
import useAlertsFeed from '../hooks/useAlertsFeed';
import useAvailableCapital from '../hooks/useAvailableCapital';
import { usePortfolioMetrics, useKPIs } from '../hooks/usePortfolioMetrics';
import { useOpenPositions, useDispatch, useClosedTrades } from '../store/useStore';

// 4K refonte Phase B — daily snapshot writer (inchangé).
function useDailySnapshotWriter() {
  const dispatch = useDispatch();
  const metrics = usePortfolioMetrics();
  const kpis = useKPIs();
  const { availableUsd } = useAvailableCapital();
  const openPositions = useOpenPositions();

  const nlv = metrics?.netLiquidationValueUsd;
  const unrealized = metrics?.unrealizedPnlUsd;
  const exposure = metrics?.totalExposure;
  const realized = metrics?.realizedPnlUsd;
  const positionsCount = (openPositions || []).length;
  const winRate = kpis?.winRate;
  const profitFactor = kpis?.profitFactor;

  useEffect(() => {
    if (typeof nlv !== 'number' || !Number.isFinite(nlv)) return;
    const today = new Date().toISOString().slice(0, 10);
    const round = (v) =>
      typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
    dispatch({
      type: 'UPDATE_DAILY_SNAPSHOT',
      payload: {
        date: today,
        nlv: round(nlv),
        availCapital: round(availableUsd),
        unrealized: round(unrealized),
        exposure: round(exposure),
        openPositionsCount: positionsCount,
        realized: round(realized),
        winRate: round(winRate),
        profitFactor:
          profitFactor === Infinity
            ? null
            : typeof profitFactor === 'number' && Number.isFinite(profitFactor)
              ? round(profitFactor)
              : null,
      },
    });
  }, [
    dispatch,
    nlv,
    availableUsd,
    unrealized,
    exposure,
    realized,
    positionsCount,
    winRate,
    profitFactor,
  ]);
}

export default function Dashboard() {
  const equityHistory = useEquityHistory();
  const dailyPnL = useDailyPnL();
  const closedTrades = useClosedTrades();
  const portfolioMetrics = usePortfolioMetrics();
  const riskMatrixData = useRiskMatrix();
  // B4 — greeks hissés ici pour alimenter le strip dans le cockpit.
  // DashboardKPICards garde son propre appel autonome (back-compat).
  // Single source of truth pour Δ/Θ par position : on injecte greeksMap
  // dans useLivePositions pour que la table Live Positions affiche les
  // greeks calculés (cascade σ a→b→c) au lieu de '—'.
  const greeks = useGreeksAggregate();
  const positions = useLivePositions({ greeksMap: greeks.greeksMap });
  const watchlist = useWatchlist();
  const sectors = useSectorHeatmap();
  const ivMovers = useIVMovers();
  const alerts = useAlertsFeed();

  // Merge portfolioMetrics (sharpe/sortino/sqn/cagr/recovery/rMultiples/
  // streaks/breakEven/fees/fxImpact/monthly) + riskMatrixData
  // (currentDDPct/maxDDYtdPct/recoveryPctValue/volAnnPct) + equityHistory
  // + greeks (Σ Δ/Γ/Θ/ν pour le strip Options Greeks B4)
  // pour que RiskMatrix puisse tout dériver via un seul objet `metrics`.
  const riskMetrics = useMemo(
    () => ({ ...portfolioMetrics, ...riskMatrixData, equityHistory, greeks }),
    [portfolioMetrics, riskMatrixData, equityHistory, greeks]
  );

  // Persiste un snapshot quotidien des métriques (cf. useDailySnapshot.js).
  useDailySnapshotWriter();

  // B3 — timeframe partagé entre Equity Curve et Cumulative P&L (lift state).
  // Cliquer un timeframe sur l'un synchronise l'autre.
  const [chartRange, setChartRange] = useState('ALL');

  return (
    <div className="dashboard-page">
      <div className="dash-shell">
        <DashboardKPICards />
      <div className="dash-grid">
        <EquityChart
          data={equityHistory}
          range={chartRange}
          onRangeChange={setChartRange}
          area="equity"
        />
        <DailyPnLChart
          data={equityHistory}
          dailyPnL={dailyPnL}
          closedTrades={closedTrades}
          liveRate={portfolioMetrics?.liveRate}
          range={chartRange}
          onRangeChange={setChartRange}
          area="dailypnl"
        />
        <RiskMatrix metrics={riskMetrics} area="risk" />
        <LivePositions data={positions} area="positions" />
        <TradeHistory data={closedTrades} liveRate={portfolioMetrics?.liveRate ?? 1} area="history" />
        <Watchlist data={watchlist} area="watch" />
        <CalendarMini area="calendar" />
        <IVRankMovers data={ivMovers} area="ivr" />
        <SectorHeatmap data={sectors} area="heat" />
        <AlertsFeed data={alerts} area="alert" />
      </div>
      </div>
    </div>
  );
}
