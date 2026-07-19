// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — Brique 1.D « Héros 1 » v3 — LE CARTOUCHE (final)
//
//  DEV-only (garde import.meta.env.DEV côté route), HORS AppShell,
//  aucune entrée de nav, PURGÉ fin de brique. N'ÉCRIT JAMAIS dans
//  localStorage (§7). Base ratifiée « Le Cartouche », refondu en 3
//  zones (données · séparation · graphe). 2 hypothèses à tester
//  exposées (bande perf A/B ; Δ net $ vs actions) → Rafael tranche.
//
//  Donnée : série héros = NLV DENSE (snapshots quotidiens + point live ;
//  intraday DÉMO sur 5D). Drawdown flow-neutral. Modes Démo / Store réel.
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import Cartouche from './heros/Cartouche';
import {
  buildNlvSeries, resampleSeries, deriveSeriesStats, deriveWindowStats,
  makeDemoInputs, DEMO_VARIANTS,
} from './heros/nlvData';
import { toKpiCells, deriveKpisReal, deriveKpisDemo } from './heros/kpiModel';
import { usePortfolioMetrics } from '../../hooks/usePortfolioMetrics';
import { useTradingMetrics } from '../../hooks/useTradingMetrics';
import useGreeksAggregate from '../../hooks/useGreeksAggregate';
import useAvailableCapital from '../../hooks/useAvailableCapital';
import { useOpenPositions, useClosedTrades, useCashFlows, useSettings } from '../../store/useStore';
import { totalSlDollar } from '../../utils/risk';
import '../../styles/lab-heros.css';

const DEMO_RATE = 0.88; // CHF/USD démo (le réel vient de metrics.liveRate)

export default function HerosLab() {
  const [source, setSource] = useState('demo');
  const [variant, setVariant] = useState('nominal');
  const [range, setRange] = useState('ALL');
  const [view, setView] = useState('equity');
  const [lineMode, setLineMode] = useState('neutral');
  const [perfHypo, setPerfHypo] = useState('A');
  const [deltaMode, setDeltaMode] = useState('dollar');

  // Hooks store réel (lecture seule)
  const metrics = usePortfolioMetrics();
  const greeks = useGreeksAggregate();
  const avail = useAvailableCapital();
  const openPositions = useOpenPositions();
  const closedTrades = useClosedTrades();
  const cashFlows = useCashFlows();
  const settings = useSettings();
  const trading = useTradingMetrics(closedTrades, metrics?.liveRate || 1);
  const today = new Date().toISOString().slice(0, 10);

  const demoInputs = useMemo(() => makeDemoInputs(variant), [variant]);
  const rate = source === 'demo' ? DEMO_RATE : metrics?.liveRate || null;

  // Séries complètes (daily + intraday démo)
  const dailyFull = useMemo(() => {
    if (source === 'demo') return buildNlvSeries({ ...demoInputs, liveRate: 1 });
    return buildNlvSeries({
      snapshots: settings?.dailySnapshots || [],
      cashFlows, closedTrades,
      liveNlv: metrics?.netLiquidationValueUsd ?? null,
      liveRate: metrics?.liveRate || 1, today,
    });
  }, [source, demoInputs, settings?.dailySnapshots, cashFlows, closedTrades, metrics, today]);

  const intradayFull = useMemo(() => {
    if (source !== 'demo') return [];
    return buildNlvSeries({
      snapshots: demoInputs.intradaySnapshots || [],
      cashFlows: demoInputs.cashFlows, closedTrades: demoInputs.closedTrades,
      liveNlv: null, liveRate: 1, today,
    });
  }, [source, demoInputs, today]);

  // 5D en démo → série intraday (dense) ; sinon quotidienne.
  const useIntraday = source === 'demo' && range === '5D' && intradayFull.length > 0;
  const activeFull = useIntraday ? intradayFull : dailyFull;

  const series = useMemo(() => resampleSeries(activeFull, range), [activeFull, range]);
  const stats = useMemo(() => deriveSeriesStats(series), [series]);
  const windowStats = useMemo(() => deriveWindowStats(series), [series]);

  const kpi = useMemo(() => {
    if (source === 'demo') return deriveKpisDemo(variant, dailyFull, demoInputs);
    return deriveKpisReal({
      metrics, greeks, availableUsd: avail?.availableUsd,
      riskDollar: totalSlDollar(openPositions), positions: openPositions,
      series: dailyFull, winRate: trading?.winRate, profitFactor: trading?.profitFactor, today,
    });
  }, [source, variant, dailyFull, demoInputs, metrics, greeks, avail, openPositions, trading, today]);

  const cells = useMemo(() => toKpiCells(kpi, deltaMode), [kpi, deltaMode]);

  const shared = { series, windowStats, stats, cells, kpi, rate, range, setRange, view, setView, lineMode, perfHypo };

  const seg = (label, k, cur, set) => (
    <button key={k} type="button" className="lh-lab__seg-btn" data-active={cur === k || undefined} onClick={() => set(k)}>{label}</button>
  );

  return (
    <div className="lh-lab">
      <div className="lh-lab__bar">
        <div className="lh-lab__brand">
          <span className="lh-lab__brand-tag">LAB</span>
          <span className="lh-lab__brand-name">1.D · Héros 1 — Le Cartouche (Données · Séparation · Graphe)</span>
        </div>
        <div className="lh-lab__group"><span className="lh-lab__group-label">Source</span><div className="lh-lab__seg">{seg('Démo dense', 'demo', source, setSource)}{seg('Store réel', 'real', source, setSource)}</div></div>
        {source === 'demo' ? (
          <div className="lh-lab__group"><span className="lh-lab__group-label">Scénario</span><div className="lh-lab__seg">{DEMO_VARIANTS.map(([k, lbl]) => seg(lbl, k, variant, setVariant))}</div></div>
        ) : null}
        <div className="lh-lab__group"><span className="lh-lab__group-label">Courbe</span><div className="lh-lab__seg">{seg('Neutre', 'neutral', lineMode, setLineMode)}{seg('Ambre', 'amber', lineMode, setLineMode)}</div></div>
        <div className="lh-lab__group lh-lab__group--test"><span className="lh-lab__group-label">Bande perf ⚑</span><div className="lh-lab__seg">{seg('A · Quant', 'A', perfHypo, setPerfHypo)}{seg('B · Momentum', 'B', perfHypo, setPerfHypo)}</div></div>
        <div className="lh-lab__group lh-lab__group--test"><span className="lh-lab__group-label">Δ net ⚑</span><div className="lh-lab__seg">{seg('$ exposition', 'dollar', deltaMode, setDeltaMode)}{seg('actions-équiv', 'shares', deltaMode, setDeltaMode)}</div></div>
        <div className="lh-lab__hint">
          {source === 'demo'
            ? `Démo dense EN MÉMOIRE (zéro écriture localStorage). ⚑ = « à tester » (Rafael tranche). ${useIntraday ? 'Vue 5D = intraday synthétique.' : '5D → intraday en démo.'}`
            : `Store réel (lecture seule) — ${dailyFull.length} snapshot(s) NLV. Intraday non persisté (voir note STOP).`}
        </div>
      </div>

      <div className="lh-lab__stage">
        <Cartouche {...shared} />
        <div className="lh-lab__legend">
          <span><b>Zone 1 données</b> : NLV live héros (USD grand + CHF au FX live + pill jour + spark) ; bande KPI ceinture, valeurs blanches, double devise ; état COURANT.</span>
          <span><b>Zone 2</b> : séparation forte (haut = état général · bas = le graphe réglé par période). Structurelle, jamais couleur P&L.</span>
          <span><b>Zone 3 graphe</b> : bande perf qui se recalcule par période (⚑ A/B à tester) · graphe pro (grilles, remplissage neutre profond, crosshair V+H, apport annoté) · pied stats extrêmes/drawdown indépendant.</span>
          <span><b>Loi de couleur</b> : Δ période / rendement colorés (perf réelle) ; marqueurs clôture vert/rouge = argent réel ; NLV/courbe/Θ/Δ/σ/Sharpe = neutres. Drawdown flow-neutral (apport ne guérit pas). Poudre sèche = <i>est.</i> (Buying Power IBKR = TODO Sprint C).</span>
        </div>
      </div>
    </div>
  );
}
