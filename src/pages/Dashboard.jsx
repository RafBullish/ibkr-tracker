// ═══════════════════════════════════════════════════════════════
//  DASHBOARD v4.0 → v5 Sprint 2.1 — Bento 12-col / 5-rows
//
//  12/12 modules vivants après ajout du Sniper Gate Monitor (Sprint 2).
//
//  Bricks v4 livrées :
//    ROW 1 : MASTER + RISK + GREEKS                  (brick 3-5)
//    ROW 2 : LIVE POSITIONS                          (brick 6)
//    ROW 3 : WATCH + EARN + HEAT + IVR               (brick 7)
//    ROW 4 : INTRN + SKEW + ALERT                    (brick 8)
//
//  v5 Sprint 2.1 :
//    ROW 5 (NEW)  : SNIPER GATE MONITOR — 1 row par option, 6 jauges
//                   par row (SL35/DTE45/E-J2/E+J30/TP/TR), pulse
//                   armed-red à fill≥95.
//
//  Hooks real-store qui retournent encore stub (brick 7-8) — les
//  modules affichent leur empty state sur /dashboard. La brick
//  data-source ultérieure remplacera les stubs par vrais feeds.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo } from 'react';
import DashboardKPICards from '../components/dashboard/DashboardKPICards';
import MasterChart from '../components/charts/MasterChart';
import RiskMatrix from '../components/dashboard/RiskMatrix';
import GreeksAggregate from '../components/dashboard/GreeksAggregate';
import LivePositions from '../components/dashboard/LivePositions';
import SniperGateMonitor from '../components/dashboard/SniperGateMonitor';
import Watchlist from '../components/dashboard/Watchlist';
import EarningsCalendar from '../components/dashboard/EarningsCalendar';
import SectorHeatmap from '../components/dashboard/SectorHeatmap';
import IVRankMovers from '../components/dashboard/IVRankMovers';
import MarketInternals from '../components/dashboard/MarketInternals';
import VolatilitySkew from '../components/dashboard/VolatilitySkew';
import AlertsFeed from '../components/dashboard/AlertsFeed';
import useEquityHistory from '../hooks/useEquityHistory';
import useDailyPnL from '../hooks/useDailyPnL';
import useRiskMatrix from '../hooks/useRiskMatrix';
import useGreeksAggregate from '../hooks/useGreeksAggregate';
import useLivePositions from '../hooks/useLivePositions';
import useSniperGates from '../hooks/useSniperGates';
import useWatchlist from '../hooks/useWatchlist';
import useEarningsCalendar from '../hooks/useEarningsCalendar';
import useSectorHeatmap from '../hooks/useSectorHeatmap';
import useIVMovers from '../hooks/useIVMovers';
import useMarketInternals from '../hooks/useMarketInternals';
import useVolSkew from '../hooks/useVolSkew';
import useAlertsFeed from '../hooks/useAlertsFeed';
import useAvailableCapital from '../hooks/useAvailableCapital';
import { usePortfolioMetrics, useKPIs } from '../hooks/usePortfolioMetrics';
import { useOpenPositions, useDispatch } from '../store/useStore';

// 4K refonte Phase B — daily snapshot writer.
// Construit le payload du jour à partir des hooks portfolio existants
// et dispatche UPDATE_DAILY_SNAPSHOT. Le reducer est idempotent par
// date : un appel répété avec les mêmes valeurs renvoie la même
// référence d'état (pas de re-render storm). FIFO 60 jours côté store.
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
  const riskMetrics = useRiskMatrix();
  const greeks = useGreeksAggregate();
  const positions = useLivePositions();
  const gates = useSniperGates();
  const watchlist = useWatchlist();
  const earnings = useEarningsCalendar();
  const sectors = useSectorHeatmap();
  const ivMovers = useIVMovers();
  const internals = useMarketInternals();
  const volSkew = useVolSkew();
  const alerts = useAlertsFeed();

  const openPositions = useOpenPositions();
  const ownedTickers = useMemo(
    () => new Set((openPositions || []).map((p) => p.tk).filter(Boolean)),
    [openPositions]
  );

  // Persiste un snapshot quotidien des métriques pour alimenter les
  // sparklines du nouveau bloc KPI cards (cf. useDailySnapshot.js).
  useDailySnapshotWriter();

  return (
    <div className="dash-shell">
      <DashboardKPICards />
      <div className="dash-grid">
        <MasterChart data={equityHistory} dailyPnL={dailyPnL} mode="real" area="master" />
        <RiskMatrix metrics={riskMetrics} area="risk" />
        <GreeksAggregate data={greeks} area="greeks" />
        <LivePositions data={positions} area="positions" />
        <SniperGateMonitor data={gates} area="gates" />
        <Watchlist data={watchlist} area="watch" />
        <EarningsCalendar data={earnings} ownedTickers={ownedTickers} maxDte={7} area="earn" />
        <SectorHeatmap data={sectors} area="heat" />
        <IVRankMovers data={ivMovers} area="ivr" />
        <MarketInternals data={internals} area="intrn" />
        <VolatilitySkew data={volSkew} area="skew" />
        <AlertsFeed data={alerts} area="alert" />
      </div>
    </div>
  );
}
