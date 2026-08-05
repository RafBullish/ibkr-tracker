// ═══════════════════════════════════════════════════════════════
//  DASHBOARD — page reine v1.0 (architecture finale brique 1.F).
//
//  Ordre vertical (DA Obsidienne §7) :
//    1. Cockpit MarketDeck (hors grille — ligne de commandement)
//    2. Héros 1 — Equity/NLV pleine largeur (1.D)
//    3. Héros 2 — Réalisé pleine largeur (1.E)
//    4. BANDE DÉCISION — ATTENTION · FORME · CAPITAL (1.F ;
//       absorbe AlertsFeed, mort en 1.F)
//    5. RiskMatrix pleine largeur (vue détaillée)
//    6. LivePositions · 7. TradeHistory (pleine largeur)
//    8. Rangée de clôture « veille » : Watchlist | CalendarMini
//
//  RiskMatrix reçoit un objet metrics fusionné :
//    { ...usePortfolioMetrics(), ...useRiskMatrix(), equityHistory, greeks }
//  afin d'accéder à toutes les métriques (sharpe, sortino, sqn, cagr,
//  rMultiples, currentStreak…) sans dupliquer les hook-calls.
//  DecisionBand reçoit metrics + greeks par le même pattern.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo } from 'react';
import MarketDeck from '../components/dashboard/MarketDeck';
import Hero1 from '../components/dashboard/Hero1';
import Hero2 from '../components/dashboard/Hero2';
import DecisionBand from '../components/dashboard/decision/DecisionBand';
import RiskMatrix from '../components/dashboard/RiskMatrix';
import LivePositions from '../components/dashboard/LivePositions';
import Watchlist from '../components/dashboard/Watchlist';
import TradeHistory from '../components/dashboard/TradeHistory';
import CalendarMini from '../components/dashboard/CalendarMini';
import useEquityHistory from '../hooks/useEquityHistory';
import useGreeksAggregate from '../hooks/useGreeksAggregate';
import useRiskMatrix from '../hooks/useRiskMatrix';
import useLivePositions from '../hooks/useLivePositions';
import useWatchlist from '../hooks/useWatchlist';
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
  const closedTrades = useClosedTrades();
  const portfolioMetrics = usePortfolioMetrics();
  const riskMatrixData = useRiskMatrix();
  // Greeks hissés ici : DecisionBand (zone CAPITAL) + single source of
  // truth pour Δ/Θ par position — greeksMap injecté dans
  // useLivePositions pour que la table Live Positions affiche les
  // greeks calculés (cascade σ a→b→c) au lieu de '—'.
  const greeks = useGreeksAggregate();
  const positions = useLivePositions({ greeksMap: greeks.greeksMap });
  const watchlist = useWatchlist();

  // Merge portfolioMetrics (sharpe/sortino/sqn/cagr/recovery/rMultiples/
  // streaks/breakEven/fees/fxImpact/monthly) + riskMatrixData
  // (currentDDPct/maxDDYtdPct/recoveryPctValue/volAnnPct) + equityHistory
  // pour que RiskMatrix puisse tout dériver via un seul objet `metrics`.
  // É3 §4.2.3 : greeks retiré du merge — la GreeksStrip de RiskMatrix
  // est morte (triplication Σ Δ/Σ Θ éteinte).
  const riskMetrics = useMemo(
    () => ({ ...portfolioMetrics, ...riskMatrixData, equityHistory }),
    [portfolioMetrics, riskMatrixData, equityHistory]
  );

  // Persiste un snapshot quotidien des métriques (cf. useDailySnapshot.js).
  useDailySnapshotWriter();

  return (
    <div className="dashboard-page">
      {/* v1.0 · 1.C.2 — LE COCKPIT : une seule pièce d'instrument soudée
          (full-bleed, dockée sous la hairline du tape). Étage marché
          (MarketDeck) + hairline interne + étage portefeuille (CommandDeck). */}
      {/* 1.C — étage marché (intangible). Le CommandDeck (KPI portefeuille)
          a migré dans le bloc Héros 1 (zone haute KPI « Bi-héros »). */}
      <section className="cockpit" aria-label="Cockpit — marché">
        <MarketDeck />
      </section>
      <div className="dash-shell">
      <div className="dash-grid">
        {/* 1.D — Héros 1 : Equity/NLV pleine largeur (frontière + KPI
            Bi-héros + graphe terminal + stats). Remplace EquityChart. */}
        <Hero1 area="hero1" />
        {/* 1.E — Héros 2 : Réalisé pleine largeur (cumulé/quotidien/
            distribution + matrice de non-perte). Remplace DailyPnLChart. */}
        <Hero2 area="hero2" />
        {/* 1.F — BANDE DÉCISION : étage DÉCISION (ATTENTION · FORME ·
            CAPITAL). Absorbe AlertsFeed (fusion U7 → ATTENTION). */}
        <DecisionBand metrics={portfolioMetrics} greeks={greeks} area="decision" />
        <RiskMatrix metrics={riskMetrics} area="risk" />
        <LivePositions data={positions} area="positions" />
        <TradeHistory data={closedTrades} liveRate={portfolioMetrics?.liveRate ?? 1} area="history" />
        {/* 1.F — rangée de clôture « veille » : Watchlist | CalendarMini. */}
        <Watchlist data={watchlist} area="watch" />
        <CalendarMini area="calendar" />
      </div>
      </div>
    </div>
  );
}
