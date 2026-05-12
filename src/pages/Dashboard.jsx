// ═══════════════════════════════════════════════════════════════
//  DASHBOARD v6 — 4K refonte Phase C.1 — Bloomberg-dense bento
//
//  Grid 6 rows :
//    Row 1 (380px) : MasterChart col 1-7 | RiskMatrix col 8-12
//    Row 2 (320px) : LivePositions col 1-12
//    Row 3 (220px) : SniperGateMonitor col 1-12
//    Row 4 (300px) : TradeHistoryPlaceholder — Phase C.2
//    Row 5 (320px) : Watchlist col 1-6 | CalendarMiniPlaceholder col 7-12 — Phase C.3
//    Row 6 (220px) : IVRankMovers col 1-4 | SectorHeatmap col 5-8 | AlertsFeed col 9-12
//
//  Phase C.1 retire 4 modules du dashboard (leurs fichiers restent
//  pour Greeks/Chain/Premarket) :
//    GreeksAggregate · EarningsCalendar · MarketInternals · VolatilitySkew
//
//  RiskMatrix reçoit maintenant un objet metrics fusionné :
//    { ...usePortfolioMetrics(), ...useRiskMatrix(), equityHistory }
//  afin d'accéder à toutes les métriques (sharpe, sortino, sqn, cagr,
//  rMultiples, currentStreak…) sans dupliquer les hook-calls dans
//  RiskMatrix lui-même.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo } from 'react';
import DashboardKPICards from '../components/dashboard/DashboardKPICards';
import EquityChart from '../components/charts/EquityChart';
import DailyPnLChart from '../components/charts/DailyPnLChart';
import RiskMatrix from '../components/dashboard/RiskMatrix';
import LivePositions from '../components/dashboard/LivePositions';
import SniperGateMonitor from '../components/dashboard/SniperGateMonitor';
import Watchlist from '../components/dashboard/Watchlist';
import SectorHeatmap from '../components/dashboard/SectorHeatmap';
import IVRankMovers from '../components/dashboard/IVRankMovers';
import AlertsFeed from '../components/dashboard/AlertsFeed';
import TradeHistoryPlaceholder from '../components/dashboard/TradeHistoryPlaceholder';
import CalendarMiniPlaceholder from '../components/dashboard/CalendarMiniPlaceholder';
import useEquityHistory from '../hooks/useEquityHistory';
import useDailyPnL from '../hooks/useDailyPnL';
import useRiskMatrix from '../hooks/useRiskMatrix';
import useLivePositions from '../hooks/useLivePositions';
import useSniperGates from '../hooks/useSniperGates';
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
  const positions = useLivePositions();
  const gates = useSniperGates();
  const watchlist = useWatchlist();
  const sectors = useSectorHeatmap();
  const ivMovers = useIVMovers();
  const alerts = useAlertsFeed();

  // Merge portfolioMetrics (sharpe/sortino/sqn/cagr/recovery/rMultiples/
  // streaks/breakEven/fees/fxImpact/monthly) + riskMatrixData
  // (currentDDPct/maxDDYtdPct/recoveryPctValue/vol30dPct) + equityHistory
  // pour que RiskMatrix puisse tout dériver via un seul objet `metrics`.
  const riskMetrics = useMemo(
    () => ({ ...portfolioMetrics, ...riskMatrixData, equityHistory }),
    [portfolioMetrics, riskMatrixData, equityHistory]
  );

  // Persiste un snapshot quotidien des métriques (cf. useDailySnapshot.js).
  useDailySnapshotWriter();

  return (
    <div className="dash-shell">
      <DashboardKPICards />
      <div className="dash-grid">
        <EquityChart data={equityHistory} area="equity" />
        <DailyPnLChart
          data={equityHistory}
          dailyPnL={dailyPnL}
          closedTrades={closedTrades}
          liveRate={portfolioMetrics?.liveRate}
          area="dailypnl"
        />
        <RiskMatrix metrics={riskMetrics} area="risk" />
        <LivePositions data={positions} area="positions" />
        <SniperGateMonitor data={gates} area="gates" />
        <TradeHistoryPlaceholder area="history" />
        <Watchlist data={watchlist} area="watch" />
        <CalendarMiniPlaceholder area="calendar" />
        <IVRankMovers data={ivMovers} area="ivr" />
        <SectorHeatmap data={sectors} area="heat" />
        <AlertsFeed data={alerts} area="alert" />
      </div>
    </div>
  );
}
