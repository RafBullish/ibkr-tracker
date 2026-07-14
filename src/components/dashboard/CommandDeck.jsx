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

import { motion, useReducedMotion } from 'framer-motion';
import { usePortfolioMetrics } from '../../hooks/usePortfolioMetrics';
import { useTradingMetrics } from '../../hooks/useTradingMetrics';
import useDailyPnL from '../../hooks/useDailyPnL';
import useMarketSession from '../../hooks/useMarketSession';
import { useClosedTrades, useSettings } from '../../store/useStore';
import { FRESHNESS } from '../../constants/timing';
import NumAnat from '../ui/NumAnat';

// ─── Formateurs (convention KPI existante, cf. en-tête) ─────────

const fmtUsdCompact = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1_000_000) {
    return `$${(v / 1_000_000).toLocaleString('de-CH', { maximumFractionDigits: 2 })}M`;
  }
  return `$${Math.round(v).toLocaleString('de-CH')}`;
};

const fmtUsdSigned = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return '$0';
  const sign = v > 0 ? '+' : '−';
  return `${sign}$${Math.round(Math.abs(v)).toLocaleString('de-CH')}`;
};

const toneSign = (v) => {
  if (v == null || !Number.isFinite(v) || v === 0) return undefined;
  return v > 0 ? 'profit' : 'loss';
};

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

// ─── Indicateur du vivant (zone NET LIQ) ────────────────────────
// Échelle de décision 1.A : (a) données bridge IBKR fraîches
// (settings.ibkrLiveData, même seuil FRESHNESS que le badge LIVE du
// CommandBar) → LIVE pulsé ; (b) sinon session RTH (useMarketSession)
// → SESSION (ouverte, ambre statique) / CLOSED (mute).
function useLivenessState() {
  const settings = useSettings();
  const session = useMarketSession(); // tick 30 s → rafraîchit aussi la fraîcheur
  const live = settings?.ibkrLiveData;
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const isFresh = Boolean(
    live?.timestamp && nowMs - new Date(live.timestamp).getTime() < FRESHNESS.LIVE_DATA_MAX_AGE_MS
  );
  if (isFresh) return { kind: 'live', text: 'LIVE' };
  if (session.isOpen) return { kind: 'session', text: 'SESSION' };
  return { kind: 'closed', text: 'CLOSED' };
}

function LiveIndicator() {
  const state = useLivenessState();
  const dotCls =
    state.kind === 'live'
      ? 'obs-live-dot obs-live-dot--pulse'
      : state.kind === 'session'
        ? 'obs-live-dot'
        : 'obs-live-dot obs-live-dot--off';
  return (
    <span className="command-deck__live" data-live={state.kind}>
      <span className={dotCls} aria-hidden="true" />
      <span className="command-deck__live-text">{state.text}</span>
    </span>
  );
}

// ─── Composant principal ────────────────────────────────────────

export default function CommandDeck() {
  const metrics = usePortfolioMetrics();
  const dailyPnL = useDailyPnL();
  const closedTrades = useClosedTrades();
  const trading = useTradingMetrics(closedTrades, metrics?.liveRate || 1);

  const nlvUsd = metrics?.netLiquidationValueUsd;
  const unrealUsd = metrics?.unrealizedPnlUsd;
  const realizedUsd = metrics?.realizedPnlUsd;
  const exposureUsd = metrics?.totalExposure;
  const monthlyPnlUsd = metrics?.monthlyPnlUsd;
  const dayPnl = todayPnlUsd(dailyPnL);

  // Jauge EXPOSURE : engagé / NLV, clampé 0-100, repère décision à 70 %.
  const expoPct =
    Number.isFinite(exposureUsd) && Number.isFinite(nlvUsd) && nlvUsd > 0
      ? Math.max(0, Math.min(100, (exposureUsd / nlvUsd) * 100))
      : null;
  const expoWarn = expoPct != null && expoPct >= 70;

  // WIN RATE / PF — neutres. useTradingMetrics gate déjà winRate/PF ;
  // le seuil produit reste « moins de 10 trades clôturés → — + n < 10 ».
  const closedCount = (closedTrades || []).length;
  const underSample = closedCount < 10;
  const winRate = !underSample && Number.isFinite(trading?.winRate) ? trading.winRate : null;
  const profitFactor =
    !underSample && Number.isFinite(trading?.profitFactor) ? trading.profitFactor : null;

  return (
    <section className="command-deck obs-panel" aria-label="Ligne de commandement">
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

      {/* 2 · DAY P&L — $ réel, coloré par signe */}
      <div className="command-deck__zone">
        <div className="command-deck__head">
          <span className="command-deck__label">DAY P&amp;L</span>
        </div>
        <DeckValue text={fmtUsdSigned(dayPnl)} tone={toneSign(dayPnl)} animated />
        <div className="command-deck__sub" />
      </div>

      {/* 3 · UNREALIZED — $ réel latent, coloré par signe */}
      <div className="command-deck__zone">
        <div className="command-deck__head">
          <span className="command-deck__label">UNREALIZED</span>
        </div>
        <DeckValue text={fmtUsdSigned(unrealUsd)} tone={toneSign(unrealUsd)} animated />
        <div className="command-deck__sub" />
      </div>

      {/* 4 · REALIZED — all-time + sous-ligne MTD (mois en cours) */}
      <div className="command-deck__zone">
        <div className="command-deck__head">
          <span className="command-deck__label">REALIZED</span>
        </div>
        <DeckValue text={fmtUsdSigned(realizedUsd)} tone={toneSign(realizedUsd)} />
        <div className="command-deck__sub">
          <span className="command-deck__mtd">
            <span className="command-deck__mtd-label">MTD</span>
            <span className="command-deck__mtd-value" data-tone={toneSign(monthlyPnlUsd)}>
              <NumAnat tier="mid">{fmtUsdSigned(monthlyPnlUsd)}</NumAnat>
            </span>
          </span>
        </div>
      </div>

      {/* 5 · EXPOSURE — capital DÉPLOYÉ, NEUTRE + jauge engagé/NLV */}
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
                ? `Capital déployé : ${Math.round(expoPct)} % du NLV (repère 70 %)`
                : 'Capital déployé : indisponible'
            }
          >
            <div
              className="command-deck__gauge-fill"
              style={{ width: expoPct != null ? `${expoPct}%` : 0 }}
            />
            <div className="command-deck__gauge-marker" aria-hidden="true" />
          </div>
          <span
            className={`command-deck__caption${expoWarn ? ' command-deck__caption--warn' : ''}`}
          >
            {expoPct != null ? `${Math.round(expoPct)} % du NLV` : '— % du NLV'}
          </span>
        </div>
      </div>

      {/* 6 · WIN RATE · PROFIT FACTOR — neutres */}
      <div className="command-deck__zone command-deck__zone--duo">
        <div className="command-deck__head command-deck__head--duo">
          <span className="command-deck__label">WIN RATE</span>
          <span className="command-deck__label">PROFIT FACTOR</span>
        </div>
        <div className="command-deck__duo-values">
          <span className="command-deck__value command-deck__value--duo">
            <NumAnat tier="mid">{winRate != null ? `${winRate.toFixed(1)}%` : '—'}</NumAnat>
          </span>
          <span className="command-deck__value command-deck__value--duo">
            <NumAnat tier="mid">{profitFactor != null ? profitFactor.toFixed(2) : '—'}</NumAnat>
          </span>
        </div>
        <div className="command-deck__sub">
          {underSample ? <span className="command-deck__caption">n &lt; 10</span> : null}
        </div>
      </div>
    </section>
  );
}
