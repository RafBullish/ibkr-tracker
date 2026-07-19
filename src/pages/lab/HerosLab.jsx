// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — Brique 1.D « Héros 1 » — BLOC FINAL
//
//  DEV-only (garde import.meta.env.DEV côté route), HORS AppShell,
//  aucune entrée de nav, PURGÉ fin de brique. N'ÉCRIT JAMAIS dans
//  localStorage (§7). Version FINALE avant implémentation : un seul
//  bloc « Héros fusionné » (base B ratifiée) — NLV géant en overlay
//  sur le graphe terminal (lightweight-charts, ratifié) — avec la
//  bande KPI générale remontée en haut (base A).
//
//  Donnée : série héros = NLV DENSE (snapshots quotidiens + live ;
//  intraday démo sur 5D). Drawdown flow-neutral. Modes Démo / Store réel.
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import FinalBlock from './heros/FinalBlock';
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
  const shared = { series, windowStats, stats, cells, kpi, rate, range, setRange, view, setView, lineMode, intraday: useIntraday };

  const seg = (label, k, cur, set) => (
    <button key={k} type="button" className="lh-lab__seg-btn" data-active={cur === k || undefined} onClick={() => set(k)}>{label}</button>
  );

  return (
    <div className="lh-lab">
      <div className="lh-lab__bar">
        <div className="lh-lab__brand"><span className="lh-lab__brand-tag">LAB</span><span className="lh-lab__brand-name">1.D · Héros 1 — BLOC FINAL (Héros fusionné + KPI en haut)</span></div>
        <div className="lh-lab__group"><span className="lh-lab__group-label">Source</span><div className="lh-lab__seg">{seg('Démo dense', 'demo', source, setSource)}{seg('Store réel', 'real', source, setSource)}</div></div>
        {source === 'demo' ? <div className="lh-lab__group"><span className="lh-lab__group-label">Scénario</span><div className="lh-lab__seg">{DEMO_VARIANTS.map(([k, lbl]) => seg(lbl, k, variant, setVariant))}</div></div> : null}
        <div className="lh-lab__group"><span className="lh-lab__group-label">Courbe</span><div className="lh-lab__seg">{seg('Neutre', 'neutral', lineMode, setLineMode)}{seg('Ambre', 'amber', lineMode, setLineMode)}</div></div>
        <div className="lh-lab__hint">
          {source === 'demo'
            ? `Démo dense EN MÉMOIRE (zéro écriture localStorage). Graphe = lightweight-charts (canvas, ratifié). ${useIntraday ? '5D = intraday synthétique.' : '5D → intraday en démo.'}`
            : `Store réel (lecture seule) — ${dailyFull.length} snapshot(s) NLV. Intraday non persisté (TODO writer, voir STOP).`}
        </div>
      </div>

      <div className="lh-lab__stage">
        <FinalBlock {...shared} />
        <div className="lh-lab__legend">
          <span><b>Bande KPI générale</b> (haut, état live) : 12 cellules riches, valeurs blanches + CHF agrandi, micro-contexte + micro-sparklines, packing serré 2 rangs. Δ net en actions-équiv (primaire) + $-exposition en sub. NLV EXCLU (héros du graphe).</span>
          <span><b>Zone graphe</b> : NLV GÉANT en overlay sur le graphe terminal (concept B) · bande perf par période (SUR CETTE PÉRIODE) · auto-échelle Y serrée · axe Y à droite + ligne de prix · crosshair natif + boîte · apport annoté · intraday 5D.</span>
          <span><b>Bande stats</b> (bas, enrichie) : recovery, gain/perte moy., expectancy, % jours gagnants, séries. Double devise.</span>
          <span><b>Loi de couleur</b> : P&L période / clôtures colorés (argent réel) ; NLV / courbe / Θ / Δ / référence = neutres. Drawdown flow-neutral. Poudre sèche = <i>est.</i> (Buying Power IBKR = TODO Sprint C).</span>
        </div>
      </div>
    </div>
  );
}
