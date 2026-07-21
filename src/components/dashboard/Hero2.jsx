// ═══════════════════════════════════════════════════════════════
//  HÉROS 2 (brique 1.E « Réalisé ») — LA FUSION. Jumeau de Héros 1,
//  maison PURE du RÉALISÉ (l'UNREALIZED reste en Héros 1 → corrige le
//  doublon de l'ancien DailyPnLChart). Contient LES 3 VUES roadmap :
//    · zone haute : DECK RÉALISÉ (cellules-MONDE) + MATRICE DE NON-PERTE ;
//    · graphe HÉROS terminal (lightweight-charts) avec TOGGLE
//      CUMULÉ ↔ QUOTIDIEN (comme NLV/Drawdown de Héros 1) + géant en
//      overlay + marqueurs de clôture ;
//    · panneau DISTRIBUTION (histogramme par bucket $), toujours visible ;
//    · footer référence dédupliqué (détail jour + distribution).
//
//  Source = closedTrades réels (useDailyPnL → model réalisé). Réutilise
//  le kit/parts/TvChart de Héros 1 (dépendance lightweight-charts déjà
//  ratifiée, code-split). Loi de couleur respectée.
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState, lazy, Suspense } from 'react';
import { ZoneSep, RangeSelector } from './hero1/parts';
import { RealizedFrontier, ViewToggleRealized, RealizedGiant, RealizedFooter } from './hero2/parts';
import RealizedDeck from './hero2/RealizedDeck';
import Distribution from './hero2/Distribution';
import { deriveRealized } from './hero2/model';
import useDailyPnL from '../../hooks/useDailyPnL';
import { useClosedTrades, useSettings } from '../../store/useStore';

// Graphe terminal code-split (lightweight-charts sur son propre chunk).
const TvChartRealized = lazy(() => import('./hero2/TvChartRealized'));

export default function Hero2({ area = 'hero2' }) {
  const [range, setRange] = useState('ALL');
  const [view, setView] = useState('cumul');

  const closed = useClosedTrades();
  const settings = useSettings();
  const dailyAll = useDailyPnL();
  const rate = settings?.liveRate || null;

  const m = useMemo(
    () => deriveRealized({ dailyAll, closed, rate, range }),
    [dailyAll, closed, rate, range]
  );

  return (
    <section className="lh-final" style={{ gridArea: area }}>
      <RealizedFrontier />
      <RealizedDeck m={m} rate={rate} range={range} />
      <ZoneSep label="GRAPHIQUE" />
      <div className="lh-graphzone">
        <div className="lh-graphzone__bar">
          <span className="lh-chart__title">RÉALISÉ</span>
          <div className="lh-chart__controls">
            <ViewToggleRealized view={view} setView={setView} />
            <RangeSelector range={range} setRange={setRange} />
          </div>
        </div>
        <div className="h2-graphrow">
          {/* Graphe HÉROS terminal + géant en overlay. */}
          <div className="h2-fuse">
            <div className="lh-fuse__overlay">
              <RealizedGiant total={m.matrix.realizedTotal} rate={rate} count={m.matrix.n} span={m.spanDays} />
            </div>
            <div className="lh-fuse__chart">
              {m.empty ? (
                <div className="lh-canvas lh-canvas--empty">Aucune clôture sur la fenêtre</div>
              ) : (
                <Suspense fallback={<div className="lh-canvas lh-canvas--empty">Chargement…</div>}>
                  <TvChartRealized cumul={m.terminalCumul} daily={m.terminalDaily} view={view} />
                </Suspense>
              )}
            </div>
          </div>
          {/* Panneau DISTRIBUTION — 3ᵉ vue, sa propre place. */}
          <Distribution dist={m.dist} />
        </div>
      </div>
      <RealizedFooter m={m} rate={rate} />
    </section>
  );
}
