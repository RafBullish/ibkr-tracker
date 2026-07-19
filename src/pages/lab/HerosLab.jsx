// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — Brique 1.D « Héros 1 » v2 (bloc portefeuille)
//
//  DEV-only (garde import.meta.env.DEV côté route), HORS AppShell,
//  aucune entrée de nav, PURGÉ en fin de brique. N'ÉCRIT JAMAIS dans
//  localStorage (§7) : le mode « Démo dense » synthétise la donnée EN
//  MÉMOIRE ; le mode « Store réel » lit le vrai store en lecture seule.
//  Les DEUX passent par le MÊME pipeline (buildNlvSeries) → la donnée
//  est réellement câblée, pas un fixture décoratif.
//
//  Explore le BLOC ENTIER de l'en-tête portefeuille (périmètre 1.D
//  élargi par l'architecte) : (a) bande KPI refondue · (b) frontière
//  marché/portefeuille · (c) vrai graphe Equity/NLV pleine largeur —
//  sur une SÉRIE NLV DENSE (1 pt/jour), pas le cumPnL par trade.
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import BlockI from './heros/BlockI';
import BlockII from './heros/BlockII';
import BlockIII from './heros/BlockIII';
import {
  buildNlvSeries,
  resampleSeries,
  deriveSeriesStats,
  makeDemoInputs,
  DEMO_VARIANTS,
} from './heros/nlvData';
import { toKpiCells, deriveKpisReal, deriveKpisDemo } from './heros/kpiModel';
import { usePortfolioMetrics } from '../../hooks/usePortfolioMetrics';
import { useTradingMetrics } from '../../hooks/useTradingMetrics';
import useGreeksAggregate from '../../hooks/useGreeksAggregate';
import useAvailableCapital from '../../hooks/useAvailableCapital';
import { useOpenPositions, useClosedTrades, useCashFlows, useSettings } from '../../store/useStore';
import { totalSlDollar } from '../../utils/risk';
import '../../styles/lab-heros.css';

const LINE_MODES = [
  ['neutral', 'Ligne neutre'],
  ['amber', 'Ligne ambre'],
];

export default function HerosLab() {
  const [source, setSource] = useState('demo'); // 'demo' | 'real'
  const [variant, setVariant] = useState('nominal');
  const [range, setRange] = useState('ALL');
  const [view, setView] = useState('equity');
  const [lineMode, setLineMode] = useState('neutral');

  // ── Hooks store réel (lecture seule) ──────────────────────────
  const metrics = usePortfolioMetrics();
  const greeks = useGreeksAggregate();
  const avail = useAvailableCapital();
  const openPositions = useOpenPositions();
  const closedTrades = useClosedTrades();
  const cashFlows = useCashFlows();
  const settings = useSettings();
  const trading = useTradingMetrics(closedTrades, metrics?.liveRate || 1);
  const today = new Date().toISOString().slice(0, 10);

  // ── Démo dense (EN MÉMOIRE) ───────────────────────────────────
  const demoInputs = useMemo(() => makeDemoInputs(variant), [variant]);

  // ── Série NLV complète (même pipeline) ────────────────────────
  const fullSeries = useMemo(() => {
    if (source === 'demo') {
      return buildNlvSeries({ ...demoInputs, liveRate: 1 });
    }
    return buildNlvSeries({
      snapshots: settings?.dailySnapshots || [],
      cashFlows,
      closedTrades,
      liveNlv: metrics?.netLiquidationValueUsd ?? null,
      liveRate: metrics?.liveRate || 1,
      today,
    });
  }, [source, demoInputs, settings?.dailySnapshots, cashFlows, closedTrades, metrics, today]);

  const series = useMemo(() => resampleSeries(fullSeries, range), [fullSeries, range]);
  const stats = useMemo(() => deriveSeriesStats(series), [series]);

  // ── KPI (même forme, source démo ou réelle) ───────────────────
  const kpi = useMemo(() => {
    if (source === 'demo') return deriveKpisDemo(variant, fullSeries, demoInputs);
    return deriveKpisReal({
      metrics,
      greeks,
      availableUsd: avail?.availableUsd,
      riskDollar: totalSlDollar(openPositions),
      positions: openPositions,
      series: fullSeries,
      winRate: trading?.winRate,
      profitFactor: trading?.profitFactor,
      today,
    });
  }, [source, variant, fullSeries, demoInputs, metrics, greeks, avail, openPositions, trading, today]);

  const cells = useMemo(() => toKpiCells(kpi), [kpi]);

  const shared = { series, stats, cells, kpi, range, setRange, view, setView, lineMode };

  return (
    <div className="lh-lab">
      <div className="lh-lab__bar">
        <div className="lh-lab__brand">
          <span className="lh-lab__brand-tag">LAB</span>
          <span className="lh-lab__brand-name">1.D · Héros 1 — Bloc portefeuille (KPI + frontière + NLV)</span>
        </div>

        <div className="lh-lab__group">
          <span className="lh-lab__group-label">Source</span>
          <div className="lh-lab__seg">
            {[['demo', 'Démo dense'], ['real', 'Store réel']].map(([k, lbl]) => (
              <button key={k} type="button" className="lh-lab__seg-btn" data-active={source === k || undefined} onClick={() => setSource(k)}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {source === 'demo' ? (
          <div className="lh-lab__group">
            <span className="lh-lab__group-label">Scénario</span>
            <div className="lh-lab__seg">
              {DEMO_VARIANTS.map(([k, lbl]) => (
                <button key={k} type="button" className="lh-lab__seg-btn" data-active={variant === k || undefined} onClick={() => setVariant(k)}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="lh-lab__group">
          <span className="lh-lab__group-label">Courbe</span>
          <div className="lh-lab__seg">
            {LINE_MODES.map(([k, lbl]) => (
              <button key={k} type="button" className="lh-lab__seg-btn" data-active={lineMode === k || undefined} onClick={() => setLineMode(k)}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div className="lh-lab__hint">
          {source === 'demo'
            ? 'Démo synthétique dense EN MÉMOIRE (zéro écriture localStorage). Même pipeline que le store réel.'
            : `Store réel (lecture seule) — ${fullSeries.length} snapshot(s) NLV. Vide si peu d'historique persisté.`}
        </div>
      </div>

      <div className="lh-lab__stage">
        <div className="lh-lab__slot">
          <div className="lh-lab__slot-head"><span className="lh-lab__slot-key">I</span><span className="lh-lab__slot-name">La Console — frontière-barre · KPI une rangée · chart plein</span></div>
          <BlockI {...shared} />
        </div>
        <div className="lh-lab__slot">
          <div className="lh-lab__slot-head"><span className="lh-lab__slot-key">II</span><span className="lh-lab__slot-name">Le Cartouche — NLV fusionné au graphe · KPI en ceinture</span></div>
          <BlockII {...shared} />
        </div>
        <div className="lh-lab__slot">
          <div className="lh-lab__slot-head"><span className="lh-lab__slot-key">III</span><span className="lh-lab__slot-name">Le Double Rang — 4 primaires + 9 contexte · chart plein</span></div>
          <BlockIII {...shared} />
        </div>

        <div className="lh-lab__legend">
          <span><b>Frontière</b> : structurelle (libellé PORTEFEUILLE + filet/plan) — jamais une couleur P&L. Donne l'identité de la zone basse.</span>
          <span><b>Courbe NLV</b> : dense (1 pt/jour), neutre et calme, vraies grilles, interpolation linéaire (pas de lissage cartoon).</span>
          <span><b>Marqueurs</b> : jours de clôture colorés vert/rouge = argent réel (loi de couleur) ; apports = triangle neutre + rail (le saut NLV est expliqué, pas masqué). Drawdown calculé flow-neutral.</span>
          <span><b>Poudre sèche</b> = <i>estimation</i> (availableUsd cash-A), PAS la Buying Power IBKR (Sprint C non câblé).</span>
        </div>
      </div>
    </div>
  );
}
