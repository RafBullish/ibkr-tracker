// ═══════════════════════════════════════════════════════════════
//  BANDE DÉCISION (brique 1.F) — l'étage DÉCISION du Dashboard.
//  UN SEUL panneau continu au cadre cockpit canonique (.lh-final),
//  TROIS ZONES séparées par des hairlines verticales (rails
//  MarketDeck) : ATTENTION (la plus large) · FORME · CAPITAL.
//
//  Remplace AlertsFeed (fusion U7 → ATTENTION, matrice de non-perte
//  1.F) : generateAlerts red/orange + kill switch y vivent désormais,
//  enrichis des 3 gates Sniper câblés (useSniperGates).
//
//  Sources — jamais de recalcul divergent :
//    ATTENTION : generateAlerts (moteur canonique U7) + useSniperGates
//                + useDailyKillSwitch ;
//    FORME     : deriveRealized (modèle Héros 2, range ALL) +
//                usePortfolioMetrics (currentStreak, monthlyPnlUsd) ;
//    CAPITAL   : miroir de Héros 1 (totalExposure, resolveLiveAvailable,
//                totalSlDollar, useGreeksAggregate, tierParams).
//  metrics + greeks arrivent en props (hissés par Dashboard, pattern
//  RiskMatrix) — pas de double appel de hooks lourds.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import AttentionZone from './AttentionZone';
import FormeZone from './FormeZone';
import CapitalZone from './CapitalZone';
import { deriveAttention, deriveForme, deriveCapital } from './model';
import { deriveRealized } from '../hero2/model';
import useSniperGates from '../../../hooks/useSniperGates';
import useDailyKillSwitch from '../../../hooks/useDailyKillSwitch';
import useDailyPnL from '../../../hooks/useDailyPnL';
import useAvailableCapital, { resolveLiveAvailableUsd } from '../../../hooks/useAvailableCapital';
import { useOpenPositions, useClosedTrades, useSettings } from '../../../store/useStore';
import { generateAlerts } from '../../../utils/alerts';
import { totalSlDollar } from '../../../utils/risk';
import { tierParams } from '../../../utils/sniperMeta';
import { toFloat } from '../../../utils/math';

// generateAlerts accepte un greeksMap mais aucune règle red/orange ne
// l'utilise → Map vide stable (même convention que l'ex-useAlertsFeed).
const EMPTY_GREEKS = new Map();

export default function DecisionBand({ metrics, greeks, area = 'decision' }) {
  const openPositions = useOpenPositions();
  const closed = useClosedTrades();
  const settings = useSettings();
  const dailyAll = useDailyPnL();
  const gates = useSniperGates();
  const kill = useDailyKillSwitch();
  const avail = useAvailableCapital();

  const rate = metrics?.liveRate || null;
  const lr = toFloat(settings?.liveRate) || 1;

  // ── ATTENTION ──
  const alerts = useMemo(
    () =>
      generateAlerts(openPositions || [], EMPTY_GREEKS, lr).filter(
        (a) => a.severity === 'red' || a.severity === 'orange'
      ),
    [openPositions, lr]
  );
  const watchedCount = useMemo(
    () => (openPositions || []).filter((p) => p.as === 'Option').length,
    [openPositions]
  );
  const attention = useMemo(
    () =>
      deriveAttention({
        alerts,
        gateRows: gates.rows,
        watchedCount,
        kill: { triggered: kill.triggered, dailyPnlUsd: kill.dailyPnlUsd, maxLoss: kill.maxLoss },
      }),
    [alerts, gates.rows, watchedCount, kill.triggered, kill.dailyPnlUsd, kill.maxLoss]
  );

  // ── FORME (modèle Héros 2, fenêtre ALL) ──
  const realized = useMemo(
    () => deriveRealized({ dailyAll, closed, rate, range: 'ALL' }),
    [dailyAll, closed, rate]
  );
  const forme = useMemo(
    () =>
      deriveForme({
        perTrade: realized.perTrade,
        matrix: realized.matrix,
        currentStreak: metrics?.currentStreak,
        mtd: metrics?.monthlyPnlUsd,
      }),
    [realized, metrics?.currentStreak, metrics?.monthlyPnlUsd]
  );

  // ── CAPITAL (miroir Héros 1) ──
  const realAvailableUsd = useMemo(
    () => resolveLiveAvailableUsd(settings?.ibkrLiveData, metrics?.liveRate),
    [settings?.ibkrLiveData, metrics?.liveRate]
  );
  const capital = useMemo(
    () =>
      deriveCapital({
        metrics,
        greeks,
        availableUsd: realAvailableUsd ?? avail?.availableUsd,
        availableIsReal: realAvailableUsd != null,
        riskDollar: totalSlDollar(openPositions),
        tier: tierParams(settings?.activeSniperTier),
      }),
    [metrics, greeks, realAvailableUsd, avail?.availableUsd, openPositions, settings?.activeSniperTier]
  );

  return (
    <section className="lh-final decision-band" style={{ gridArea: area }} aria-label="Bande décision">
      <div className="db-grid">
        <AttentionZone attention={attention} />
        <FormeZone forme={forme} rate={rate} />
        <CapitalZone capital={capital} rate={rate} />
      </div>
    </section>
  );
}
