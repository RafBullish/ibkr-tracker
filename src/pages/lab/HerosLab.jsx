// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — Brique 1.D « Héros 1 » v4 — 3 MODÈLES
//
//  DEV-only (garde import.meta.env.DEV côté route), HORS AppShell,
//  aucune entrée de nav, PURGÉ fin de brique. N'ÉCRIT JAMAIS dans
//  localStorage (§7). 3 modèles BIEN DISTINCTS du bloc portefeuille,
//  tous avec le graphe terminal (lightweight-charts) + corrections :
//    A · Cartouche affiné   — empilement vertical poli
//    B · Héros fusionné      — NLV ancré au graphe dominant
//    C · Grille analytique   — héros + KPI en matrice, analytiques denses
//
//  Donnée : série héros = NLV DENSE (snapshots quotidiens + live ;
//  intraday démo sur 5D). Drawdown flow-neutral. Modes Démo / Store réel.
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import ModelA from './heros/ModelA';
import ModelB from './heros/ModelB';
import ModelC from './heros/ModelC';
import { buildNlvSeries, resampleSeries, deriveSeriesStats, deriveWindowStats, makeDemoInputs, DEMO_VARIANTS } from './heros/nlvData';
import { toKpiCells, deriveKpisReal, deriveKpisDemo } from './heros/kpiModel';
import { usePortfolioMetrics } from '../../hooks/usePortfolioMetrics';
import { useTradingMetrics } from '../../hooks/useTradingMetrics';
import useGreeksAggregate from '../../hooks/useGreeksAggregate';
import useAvailableCapital from '../../hooks/useAvailableCapital';
import { useOpenPositions, useClosedTrades, useCashFlows, useSettings } from '../../store/useStore';
import { totalSlDollar } from '../../utils/risk';
import '../../styles/lab-heros.css';

const DEMO_RATE = 0.88; // CHF/USD démo (réel = metrics.liveRate)

export default function HerosLab() {
  const [source, setSource] = useState('demo');
  const [variant, setVariant] = useState('nominal');
  const [range, setRange] = useState('ALL');
  const [view, setView] = useState('equity');
  const [lineMode, setLineMode] = useState('neutral');
  const [engine, setEngine] = useState('tv');

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

  const dailyFull = useMemo(() => {
    if (source === 'demo') return buildNlvSeries({ ...demoInputs, liveRate: 1 });
    return buildNlvSeries({ snapshots: settings?.dailySnapshots || [], cashFlows, closedTrades, liveNlv: metrics?.netLiquidationValueUsd ?? null, liveRate: metrics?.liveRate || 1, today });
  }, [source, demoInputs, settings?.dailySnapshots, cashFlows, closedTrades, metrics, today]);

  const intradayFull = useMemo(() => {
    if (source !== 'demo') return [];
    return buildNlvSeries({ snapshots: demoInputs.intradaySnapshots || [], cashFlows: demoInputs.cashFlows, closedTrades: demoInputs.closedTrades, liveNlv: null, liveRate: 1, today });
  }, [source, demoInputs, today]);

  const useIntraday = source === 'demo' && range === '5D' && intradayFull.length > 0;
  const activeFull = useIntraday ? intradayFull : dailyFull;

  const series = useMemo(() => resampleSeries(activeFull, range), [activeFull, range]);
  const stats = useMemo(() => deriveSeriesStats(series), [series]);
  const windowStats = useMemo(() => deriveWindowStats(series), [series]);

  const kpi = useMemo(() => {
    if (source === 'demo') return deriveKpisDemo(variant, dailyFull, demoInputs);
    return deriveKpisReal({ metrics, greeks, availableUsd: avail?.availableUsd, riskDollar: totalSlDollar(openPositions), positions: openPositions, series: dailyFull, winRate: trading?.winRate, profitFactor: trading?.profitFactor, today });
  }, [source, variant, dailyFull, demoInputs, metrics, greeks, avail, openPositions, trading, today]);

  const cells = useMemo(() => toKpiCells(kpi), [kpi]);
  const shared = { series, windowStats, stats, cells, kpi, rate, range, setRange, view, setView, lineMode, intraday: useIntraday, engine };

  const seg = (label, k, cur, set) => (
    <button key={k} type="button" className="lh-lab__seg-btn" data-active={cur === k || undefined} onClick={() => set(k)}>{label}</button>
  );

  return (
    <div className="lh-lab">
      <div className="lh-lab__bar">
        <div className="lh-lab__brand"><span className="lh-lab__brand-tag">LAB</span><span className="lh-lab__brand-name">1.D · Héros 1 — 3 modèles (graphe terminal lightweight-charts)</span></div>
        <div className="lh-lab__group"><span className="lh-lab__group-label">Source</span><div className="lh-lab__seg">{seg('Démo dense', 'demo', source, setSource)}{seg('Store réel', 'real', source, setSource)}</div></div>
        {source === 'demo' ? <div className="lh-lab__group"><span className="lh-lab__group-label">Scénario</span><div className="lh-lab__seg">{DEMO_VARIANTS.map(([k, lbl]) => seg(lbl, k, variant, setVariant))}</div></div> : null}
        <div className="lh-lab__group"><span className="lh-lab__group-label">Courbe</span><div className="lh-lab__seg">{seg('Neutre', 'neutral', lineMode, setLineMode)}{seg('Ambre', 'amber', lineMode, setLineMode)}</div></div>
        <div className="lh-lab__group"><span className="lh-lab__group-label">Moteur</span><div className="lh-lab__seg">{seg('TradingView', 'tv', engine, setEngine)}{seg('Recharts (repli)', 'recharts', engine, setEngine)}</div></div>
        <div className="lh-lab__hint">
          {source === 'demo'
            ? `Démo dense EN MÉMOIRE (zéro écriture localStorage). Graphe = lightweight-charts (canvas). ${useIntraday ? '5D = intraday synthétique.' : '5D → intraday en démo.'}`
            : `Store réel (lecture seule) — ${dailyFull.length} snapshot(s) NLV. Intraday non persisté (TODO writer, voir STOP).`}
        </div>
      </div>

      <div className="lh-lab__stage">
        <div className="lh-lab__slot"><div className="lh-lab__slot-head"><span className="lh-lab__slot-key">A</span><span className="lh-lab__slot-name">Cartouche affiné — empilement vertical poli</span></div><ModelA {...shared} /></div>
        <div className="lh-lab__slot"><div className="lh-lab__slot-head"><span className="lh-lab__slot-key">B</span><span className="lh-lab__slot-name">Héros fusionné — NLV ancré au graphe dominant</span></div><ModelB {...shared} /></div>
        <div className="lh-lab__slot"><div className="lh-lab__slot-head"><span className="lh-lab__slot-key">C</span><span className="lh-lab__slot-name">Grille analytique — héros + KPI matrice, analytiques denses</span></div><ModelC {...shared} /></div>

        <div className="lh-lab__legend">
          <span><b>Graphe terminal</b> : lightweight-charts (TradingView, canvas) — auto-échelle Y serrée par période, axe Y à droite + ligne de prix, crosshair natif + boîte, apport = événement annoté, remplissage dégradé neutre.</span>
          <span><b>Zone données</b> : NLV live héros (USD grand + spark collée + pill jour + CHF agrandi) ; ceinture KPI blanche, double devise ; Δ net en actions-équiv (primaire) + $-exposition en sous-ligne.</span>
          <span><b>Bande perf</b> (par période) : « sur cette période, voilà » — P&L · hauts/bas · meilleur/pire jour · max DD · trades. <b>Bande stats</b> (bas, enrichie) : recovery, moyennes, expectancy, % jours gagnants, séries.</span>
          <span><b>Loi de couleur</b> : P&L période / clôtures colorés (argent réel) ; NLV / courbe / Θ / Δ / stats de référence = neutres. Drawdown flow-neutral. Poudre sèche = <i>est.</i> (Buying Power IBKR = TODO Sprint C).</span>
        </div>
      </div>
    </div>
  );
}
