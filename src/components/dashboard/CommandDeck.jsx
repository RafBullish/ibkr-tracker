// ═══════════════════════════════════════════════════════════════
//  COMMAND DECK — la Ligne de commandement (v1.0 · 1.A)
//
//  Étage 1 du Dashboard : UN panneau continu .obs-panel (verre noir,
//  hairline, tranche lumineuse), 6 zones séparées par des hairlines
//  verticales — zéro carte, zéro gap. Remplace DashboardKPICards.
//
//  Zones (gauche → droite) :
//    1. NET LIQ    — donnée reine + indicateur du vivant (LIVE/SESSION/CLOSED)
//    2. DAY P&L    — formule EXACTE de l'ancienne carte (todayPnlUsd :
//                    P&L réalisé du jour par close-date, 0 si aucune
//                    clôture aujourd'hui) — coloré par signe ($ réel)
//    3. UNREALIZED — usePortfolioMetrics, coloré par signe ($ réel)
//    4. REALIZED   — total réalisé all-time (déf. de l'ancienne carte),
//                    sous-ligne MTD (monthlyPnlUsd, mois en cours)
//    5. EXPOSURE   — capital DÉPLOYÉ (coût des primes), NEUTRE +
//                    jauge engagé/NLV avec repère 70 %
//    6. WIN RATE · PROFIT FACTOR — neutres, useTradingMetrics
//                    (n < 10 trades clôturés → « — » + caption)
//
//  Lecture SEULE via hooks existants — aucune logique métier neuve.
//  Formateurs : convention KPI existante (arrondi de-CH, signes +/−),
//  reprise à l'identique de DashboardKPICards (supprimé par 1.A).
//  Styles : v1-dashboard.css (base <1440) + c3-hires.css (palier ≥1440).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { usePortfolioMetrics } from '../../hooks/usePortfolioMetrics';
import { useTradingMetrics } from '../../hooks/useTradingMetrics';
import useDailyPnL from '../../hooks/useDailyPnL';
import { useClosedTrades, useOpenPositions, useCashFlows, useSettings } from '../../store/useStore';
import { calculateOpenPositionPnl } from '../../utils/calculations';
import { tierParams } from '../../utils/sniperMeta';
import { toFloat } from '../../utils/math';
import { FRESHNESS } from '../../constants/timing';
import NumAnat from '../ui/NumAnat';
// 1.C — formateurs KPI extraits vers le module partagé (une seule
// convention monétaire pour les decks).
import { fmtUsdCompact, fmtUsdSigned, toneSign } from '../../utils/formatKpi';

// Formule EXACTE de l'ancienne carte DAY P&L (DashboardKPICards) :
// l'entrée du jour dans la série useDailyPnL (réalisé par close-date),
// 0 si la série existe mais n'a rien aujourd'hui, null si série vide.
function todayPnlUsd(dailyPnL) {
  if (!Array.isArray(dailyPnL) || dailyPnL.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const hit = dailyPnL.find((d) => d.date === today);
  return hit ? hit.dailyPnl : 0;
}

// ─── Valeur animée — fondu + translateY 2px / 180ms au changement ──
// key sur la chaîne formatée → remonte (et anime) uniquement quand la
// valeur AFFICHÉE change. Coupé sous prefers-reduced-motion.
function DeckValue({ text, tone, tier = 'display', animated = false, className = '' }) {
  const reduced = useReducedMotion();
  const cls = `command-deck__value ${className}`.trim();
  if (!animated) {
    return (
      <span className={cls} data-tone={tone}>
        <NumAnat tier={tier}>{text}</NumAnat>
      </span>
    );
  }
  return (
    <motion.span
      key={text}
      className={cls}
      data-tone={tone}
      initial={reduced ? false : { opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <NumAnat tier={tier}>{text}</NumAnat>
    </motion.span>
  );
}

// ─── Indicateur du vivant (zone NET LIQ) — v2 (1.C) ─────────────
// RECENTRÉ sur la FRAÎCHEUR DES DONNÉES : LIVE (ibkrLiveData frais,
// même seuil FRESHNESS que l'ex-badge CommandBar) sinon EOD. Les états
// SESSION/CLOSED ont déménagé au Market Deck Z1 (phase de marché).
function useLivenessState() {
  const settings = useSettings();
  // Tick 30 s : la fraîcheur expire même sans re-render externe.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const live = settings?.ibkrLiveData;
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const isFresh = Boolean(
    live?.timestamp && nowMs - new Date(live.timestamp).getTime() < FRESHNESS.LIVE_DATA_MAX_AGE_MS
  );
  if (isFresh) return { kind: 'live', text: 'LIVE' };
  return { kind: 'eod', text: 'EOD' };
}

function LiveIndicator() {
  const state = useLivenessState();
  const dotCls =
    state.kind === 'live' ? 'obs-live-dot obs-live-dot--pulse' : 'obs-live-dot obs-live-dot--off';
  return (
    <span className="command-deck__live" data-live={state.kind}>
      <span className={dotCls} aria-hidden="true" />
      <span className="command-deck__live-text">{state.text}</span>
    </span>
  );
}

// ─── Composant principal ────────────────────────────────────────

// Valeur USD d'un cashflow pour le Day P&L (v2) : mouvements de
// financement externes du jour, en USD. Les conversions internes
// fx_buy_* laissent la NLV inchangée → exclues.
function flowUsd(e, liveRate) {
  const a1 = toFloat(e.a1);
  switch (e.ty) {
    case 'dep_usd':
    case 'adj_usd':
    case 'div_usd':
      return a1;
    case 'wit_usd':
    case 'fee_usd':
      return -a1;
    case 'dep_chf':
    case 'adj_chf':
      return liveRate > 0 ? a1 / liveRate : 0;
    case 'wit_chf':
      return liveRate > 0 ? -a1 / liveRate : 0;
    default:
      return 0;
  }
}

export default function CommandDeck() {
  const metrics = usePortfolioMetrics();
  const dailyPnL = useDailyPnL();
  const closedTrades = useClosedTrades();
  const openPositions = useOpenPositions();
  const cashFlows = useCashFlows();
  const settings = useSettings();
  const trading = useTradingMetrics(closedTrades, metrics?.liveRate || 1);

  const nlvUsd = metrics?.netLiquidationValueUsd;
  const unrealUsd = metrics?.unrealizedPnlUsd;
  const realizedUsd = metrics?.realizedPnlUsd;
  const exposureUsd = metrics?.totalExposure;
  const monthlyPnlUsd = metrics?.monthlyPnlUsd;
  const liveRate = metrics?.liveRate || 1;
  const dayR = todayPnlUsd(dailyPnL);

  // ─── Z2 v2 — DAY P&L complet, marche (a) ──────────────────────
  // total = NLV_actuelle − NLV(dernier snapshot AVANT aujourd'hui)
  //         − Σ cashflows du jour (USD). Aucun snapshot antérieur → « — ».
  // Même filtre de validité que l'ex-nlvDeltas des KPI cards (nlv > 0).
  const today = new Date().toISOString().slice(0, 10);
  const dayTotal = useMemo(() => {
    const snaps = Array.isArray(settings?.dailySnapshots)
      ? settings.dailySnapshots
          .filter((s) => s && typeof s.date === 'string' && Number.isFinite(s.nlv) && s.nlv > 0)
          .sort((a, b) => a.date.localeCompare(b.date))
      : [];
    let ref = null;
    for (let i = snaps.length - 1; i >= 0; i -= 1) {
      if (snaps[i].date < today) {
        ref = snaps[i];
        break;
      }
    }
    if (!ref || !Number.isFinite(nlvUsd)) return { value: null, refNlv: null };
    const flowsToday = (cashFlows || [])
      .filter((e) => e && e.da === today)
      .reduce((s, e) => s + flowUsd(e, liveRate), 0);
    return { value: nlvUsd - ref.nlv - flowsToday, refNlv: ref.nlv };
  }, [settings?.dailySnapshots, nlvUsd, cashFlows, liveRate, today]);

  const dayU = dayTotal.value != null ? dayTotal.value - (dayR || 0) : null;
  const dayPct =
    dayTotal.value != null && dayTotal.refNlv > 0 ? (dayTotal.value / dayTotal.refNlv) * 100 : null;

  // ─── Z3 v2 — compteurs positions en profit / en perte ─────────
  const upDown = useMemo(() => {
    let up = 0;
    let down = 0;
    for (const pos of openPositions || []) {
      const pnl = calculateOpenPositionPnl(pos, liveRate)?.unrealizedPnlUsd;
      if (Number.isFinite(pnl)) {
        if (pnl > 0) up += 1;
        else if (pnl < 0) down += 1;
      }
    }
    return { up, down };
  }, [openPositions, liveRate]);

  // ─── Z4 v2 — YTD = somme des clôtures de l'année (dérivation locale
  // sur la série useDailyPnL, même formule que l'ex-carte KPI). ───────
  const ytdUsd = useMemo(() => {
    if (!dailyPnL || dailyPnL.length === 0) return null;
    const yearStart = `${new Date().getFullYear()}-01-01`;
    return dailyPnL.filter((d) => d.date >= yearStart).reduce((s, d) => s + d.dailyPnl, 0);
  }, [dailyPnL]);

  // ─── Z5 v2 — jauge à DOUBLE repère : 70 % + cap du tier Sniper ─
  const tier = useMemo(() => tierParams(settings?.activeSniperTier), [settings?.activeSniperTier]);
  const capPct = tier?.notionalMaxPct;

  // Jauge EXPOSURE : engagé / NLV, clampé 0-100.
  const expoPct =
    Number.isFinite(exposureUsd) && Number.isFinite(nlvUsd) && nlvUsd > 0
      ? Math.max(0, Math.min(100, (exposureUsd / nlvUsd) * 100))
      : null;
  const expoWarn = expoPct != null && Number.isFinite(capPct) && expoPct >= capPct;

  // WIN RATE / PF — neutres. useTradingMetrics gate déjà winRate/PF ;
  // le seuil produit reste « moins de 10 trades clôturés → — + n < 10 ».
  const closedCount = (closedTrades || []).length;
  const underSample = closedCount < 10;
  const winRate = !underSample && Number.isFinite(trading?.winRate) ? trading.winRate : null;
  const profitFactor =
    !underSample && Number.isFinite(trading?.profitFactor) ? trading.profitFactor : null;
  const winCount = trading?.winCount ?? 0;

  return (
    <section className="command-deck" aria-label="Ligne de commandement">
      {/* 1 · NET LIQ — la donnée reine */}
      <div className="command-deck__zone command-deck__zone--nlv">
        <div className="command-deck__head">
          <span className="command-deck__label">NET LIQ</span>
          <LiveIndicator />
        </div>
        <DeckValue
          text={fmtUsdCompact(nlvUsd)}
          tier="display"
          animated
          className="command-deck__value--nlv"
        />
        <div className="command-deck__sub" />
      </div>

      {/* 2 · DAY P&L v2 — total mark-to-market (marche a) + R/U + % */}
      <div className="command-deck__zone">
        <div className="command-deck__head">
          <span className="command-deck__label">DAY P&amp;L</span>
        </div>
        <DeckValue text={fmtUsdSigned(dayTotal.value)} tone={toneSign(dayTotal.value)} animated />
        <div className="command-deck__sub">
          <span className="command-deck__subline">
            <span className="command-deck__subline-bit">
              <span className="command-deck__subline-label">R</span>
              <span className="command-deck__subline-value" data-tone={toneSign(dayR)}>
                {fmtUsdSigned(dayR)}
              </span>
            </span>
            <span className="command-deck__subline-sep">·</span>
            <span className="command-deck__subline-bit">
              <span className="command-deck__subline-label">U</span>
              <span className="command-deck__subline-value" data-tone={toneSign(dayU)}>
                {fmtUsdSigned(dayU)}
              </span>
            </span>
            {dayPct != null && (
              <span className="command-deck__subline-pct">
                {`${dayPct >= 0 ? '+' : '−'}${Math.abs(dayPct).toFixed(2)} % du NLV`}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* 3 · UNREALIZED v2 — + compteurs positions ↑/↓ */}
      <div className="command-deck__zone">
        <div className="command-deck__head">
          <span className="command-deck__label">UNREALIZED</span>
        </div>
        <DeckValue text={fmtUsdSigned(unrealUsd)} tone={toneSign(unrealUsd)} animated />
        <div className="command-deck__sub">
          <span className="command-deck__subline">
            <span className="command-deck__subline-value" data-tone={upDown.up > 0 ? 'profit' : undefined}>
              {upDown.up}↑
            </span>
            <span className="command-deck__subline-sep">·</span>
            <span className="command-deck__subline-value" data-tone={upDown.down > 0 ? 'loss' : undefined}>
              {upDown.down}↓
            </span>
          </span>
        </div>
      </div>

      {/* 4 · REALIZED v2 — all-time + sous-ligne MTD · YTD */}
      <div className="command-deck__zone">
        <div className="command-deck__head">
          <span className="command-deck__label">REALIZED</span>
        </div>
        <DeckValue text={fmtUsdSigned(realizedUsd)} tone={toneSign(realizedUsd)} />
        <div className="command-deck__sub">
          <span className="command-deck__subline">
            <span className="command-deck__subline-bit">
              <span className="command-deck__subline-label">MTD</span>
              <span className="command-deck__subline-value" data-tone={toneSign(monthlyPnlUsd)}>
                {fmtUsdSigned(monthlyPnlUsd)}
              </span>
            </span>
            <span className="command-deck__subline-sep">·</span>
            <span className="command-deck__subline-bit">
              <span className="command-deck__subline-label">YTD</span>
              <span className="command-deck__subline-value" data-tone={toneSign(ytdUsd)}>
                {fmtUsdSigned(ytdUsd)}
              </span>
            </span>
          </span>
        </div>
      </div>

      {/* 5 · EXPOSURE v2 — jauge à DOUBLE repère (70 % + cap tier) */}
      <div className="command-deck__zone">
        <div className="command-deck__head">
          <span className="command-deck__label">EXPOSURE</span>
        </div>
        <DeckValue text={fmtUsdCompact(exposureUsd)} />
        <div className="command-deck__sub">
          <div
            className="command-deck__gauge"
            role="img"
            aria-label={
              expoPct != null
                ? `Capital déployé : ${Math.round(expoPct)} % du NLV (repère 70 %, cap tier ${capPct} %)`
                : 'Capital déployé : indisponible'
            }
          >
            <div
              className="command-deck__gauge-fill"
              style={{ width: expoPct != null ? `${expoPct}%` : 0 }}
            />
            <div className="command-deck__gauge-marker" aria-hidden="true" />
            {Number.isFinite(capPct) && capPct !== 70 && (
              <div
                className="command-deck__gauge-marker command-deck__gauge-marker--cap"
                style={{ left: `${Math.max(0, Math.min(100, capPct))}%` }}
                aria-hidden="true"
              />
            )}
          </div>
          <span
            className={`command-deck__caption${expoWarn ? ' command-deck__caption--warn' : ''}`}
          >
            {expoPct != null
              ? `${Math.round(expoPct)} % du NLV · cap tier ${Number.isFinite(capPct) ? capPct : '—'} %`
              : '— % du NLV'}
          </span>
        </div>
      </div>

      {/* 6 · WIN RATE · PROFIT FACTOR — neutres. Enfants directs de la
          grille 2 colonnes de la zone : chaque valeur s'aligne sous SON
          label (colonnes partagées entre les deux rangées). */}
      <div className="command-deck__zone command-deck__zone--duo">
        <span className="command-deck__label">WIN RATE</span>
        <span className="command-deck__label">PROFIT FACTOR</span>
        <span className="command-deck__value command-deck__value--duo">
          <NumAnat tier="mid">{winRate != null ? `${winRate.toFixed(1)}%` : '—'}</NumAnat>
        </span>
        <span className="command-deck__value command-deck__value--duo">
          <NumAnat tier="mid">{profitFactor != null ? profitFactor.toFixed(2) : '—'}</NumAnat>
        </span>
        <div className="command-deck__sub">
          {underSample ? (
            <span className="command-deck__caption">n &lt; 10</span>
          ) : (
            <span className="command-deck__subline">
              <span className="command-deck__subline-value">{winCount}</span>
              <span className="command-deck__subline-label">/ {closedCount} trades</span>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
