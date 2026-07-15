// ═══════════════════════════════════════════════════════════════
//  MARKET DECK — le marché en un coup d'œil (v1.0 · 1.C)
//
//  Étage 0 du Dashboard (doctrine Avenant n°1 : « tout en haut = le
//  marché, live »), au-dessus du CommandDeck. UN panneau .obs-panel,
//  5 zones sur hairlines verticales :
//    Z1 SESSION   — phase NY + dot du vivant + compte à rebours 1 s
//                   (tick isolé dans <SessionZone/>, ne re-rend pas le
//                   deck) + heure NY
//    Z2 INDICES   — SPX · NDX · DJI : prix 28, pastille Δ% (anatomie
//                   tape), sparkline 48×36
//    Z3 VIX       — valeur 32 + pastille Δ% + chip RÉGIME (seuils
//                   architecte : <15 CALME · 15-20 NORMAL · 20-27
//                   NERVEUX · ≥27 STRESS ; NERVEUX/STRESS = --accent)
//    Z4 FX & TAUX — USD/CHF DU STORE FX (taux appliqué aux conversions,
//                   PAS le quote brut du tape) + badge AUTO/LIVE/MANUEL ·
//                   DXY & US10Y (flux existant)
//    Z5 ÉVÉNEMENT — prochain macro (useCalendarFeeds, fallback local
//                   macroEvents2026) + prochain earnings d'une POSITION
//                   OUVERTE (croisement ticker∩dates — la gate EARN-J2
//                   de useSniperGates est un stub « pending », non
//                   consommable), badge ARMED ambre si ≤ J-2. Fenêtre 14 j.
//
//  DONNÉES : quotes/sparklines = les hooks du tape avec la MÊME liste
//  de symboles → poller partagé module-scope (1.C), ZÉRO appel réseau
//  additionnel. Calendrier : useCalendarFeeds (déjà caché côté
//  calendarApi). Lecture seule, rien au store.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import useMarketQuotes from '../../hooks/useMarketQuotes';
import { useMarketSparklines } from '../../hooks/useMarketSparklines';
import useCalendarFeeds from '../../hooks/useCalendarFeeds';
import { useFx } from '../../hooks/useFx';
import { useOpenPositions } from '../../store/useStore';
import {
  STATIC_FETCH_SYMBOLS,
  TickerSparkline,
} from '../layout/TickerTape';
import { computeMarketPhase, formatCountdown } from '../../utils/marketPhase';
import { macroEventsInRange } from '../../data/macroEvents2026';

const PHASE_LABELS = {
  open: 'OUVERT',
  pre: 'PRÉ-MARCHÉ',
  after: 'AFTER',
  closed: 'FERMÉ',
};

const EVENT_WINDOW_DAYS = 14;

// ─── Z1 — Session : tick 1 s isolé ──────────────────────────────
function SessionZone() {
  const [now, setNow] = useState(() => new Date());
  const reduced = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  useEffect(() => {
    if (reduced) return undefined; // countdown statique sous reduced-motion
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [reduced]);

  const { phase, targetKind, targetMs, nyLabel } = computeMarketPhase(now);
  const countdown = formatCountdown(targetMs != null ? targetMs - now.getTime() : null);

  return (
    <>
      <div className="market-deck__session-row">
        <span
          className={`market-deck__session-dot${phase === 'open' ? ' market-deck__session-dot--live' : ''}`}
          aria-hidden="true"
        />
        <span className="market-deck__session-phase" data-phase={phase}>
          {PHASE_LABELS[phase]}
        </span>
      </div>
      <div className="market-deck__countdown">
        <span className="market-deck__countdown-label">
          {targetKind === 'close' ? 'CLÔTURE DANS' : 'OUVERTURE DANS'}
        </span>
        <span className="market-deck__countdown-value">{countdown}</span>
      </div>
      <div className="market-deck__caption">NEW YORK {nyLabel}</div>
    </>
  );
}

// ─── Pastille Δ% (anatomie exacte du tape) ──────────────────────
function DeltaPill({ pct, compact = false }) {
  if (pct == null || !Number.isFinite(pct)) {
    return <span className="market-deck__pill market-deck__pill--mute">—</span>;
  }
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '';
  return (
    <span
      className={`market-deck__pill market-deck__pill--${dir}${compact ? ' market-deck__pill--compact' : ''}`}
    >
      {arrow && <span className="market-deck__pill-arrow">{arrow}</span>}
      {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

// ─── Z2 — un indice ─────────────────────────────────────────────
function IndexCell({ label, quote, spark }) {
  const price = quote?.price;
  const sparkColor = useMemo(() => {
    if (!spark?.prices || spark.prices.length < 2) return 'var(--ink-soft)';
    const first = spark.prices[0];
    const last = spark.prices[spark.prices.length - 1];
    if (last > first) return 'var(--pnl-up)';
    if (last < first) return 'var(--pnl-down)';
    return 'var(--ink-soft)';
  }, [spark]);

  return (
    <div className="market-deck__index">
      <div className="market-deck__index-head">
        <span className="market-deck__index-symbol">{label}</span>
        <DeltaPill pct={quote?.changePercent} />
      </div>
      <div className="market-deck__index-body">
        <span className="market-deck__index-price">
          {price != null && Number.isFinite(price)
            ? price >= 1000
              ? new Intl.NumberFormat('de-CH').format(Math.round(price))
              : price.toFixed(2)
            : '—'}
        </span>
        {spark?.prices && spark.prices.length > 1 && (
          <span className="market-deck__index-spark">
            <TickerSparkline prices={spark.prices} color={sparkColor} width={48} height={36} />
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Z3 — régime VIX (seuils architecte, pure logique d'affichage) ──
function vixRegime(v) {
  if (v == null || !Number.isFinite(v)) return null;
  if (v < 15) return { label: 'CALME', hot: false };
  if (v < 20) return { label: 'NORMAL', hot: false };
  if (v < 27) return { label: 'NERVEUX', hot: true };
  return { label: 'STRESS', hot: true };
}

// ─── Z5 — dates ─────────────────────────────────────────────────
function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoPlusDays(days) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function daysUntil(iso) {
  const today = isoToday();
  const a = new Date(`${today}T00:00:00Z`).getTime();
  const b = new Date(`${iso}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export default function MarketDeck() {
  const { quotes } = useMarketQuotes(STATIC_FETCH_SYMBOLS);
  const { sparklines } = useMarketSparklines(STATIC_FETCH_SYMBOLS);
  const openPositions = useOpenPositions();
  const { rate, mode, source } = useFx();

  const myTickers = useMemo(
    () => [...new Set((openPositions || []).map((p) => p.tk).filter(Boolean))],
    [openPositions]
  );

  const today = isoToday();
  const horizon = isoPlusDays(EVENT_WINDOW_DAYS);
  const view = useMemo(() => {
    const d = new Date();
    return { viewYear: d.getFullYear(), viewMonth: d.getMonth() };
  }, []);
  const { earnings, macro, error: calError } = useCalendarFeeds({
    viewYear: view.viewYear,
    viewMonth: view.viewMonth,
    myTickers,
    minImpact: 'medium',
  });

  // MACRO : feed Finnhub si non vide, sinon fallback local (Finnhub HS).
  const nextMacro = useMemo(() => {
    const feed = (macro || [])
      .map((e) => ({ date: e.time || e.date, name: e.event }))
      .filter((e) => e.date && e.date >= today && e.date <= horizon);
    const source2 = feed.length
      ? feed
      : macroEventsInRange(today, horizon).map((e) => ({ date: e.time, name: e.event }));
    if (!source2.length) return null;
    return source2.sort((a, b) => a.date.localeCompare(b.date))[0];
  }, [macro, today, horizon]);

  // EARNINGS : prochain earnings d'une POSITION OUVERTE (le feed est déjà
  // filtré myTickers par useCalendarFeeds).
  const nextEarnings = useMemo(() => {
    const rows = (earnings || [])
      .map((e) => ({ date: e.date || e.time, ticker: String(e.symbol || '').toUpperCase() }))
      .filter((e) => e.date && e.date >= today && e.date <= horizon);
    if (!rows.length) return null;
    return rows.sort((a, b) => a.date.localeCompare(b.date))[0];
  }, [earnings, today, horizon]);

  const vix = quotes['^VIX'];
  const regime = vixRegime(vix?.price);

  // Badge de mode FX : manual → MANUEL ; auto + source live → LIVE ; sinon AUTO.
  const fxBadge =
    mode === 'manual' ? 'MANUEL' : String(source || '').startsWith('live') ? 'LIVE' : 'AUTO';

  const earnDays = nextEarnings ? daysUntil(nextEarnings.date) : null;

  return (
    <section className="market-deck obs-panel" aria-label="Marché en un coup d'œil">
      {/* Z1 — SESSION */}
      <div className="market-deck__zone market-deck__zone--session">
        <span className="market-deck__label">SESSION</span>
        <SessionZone />
      </div>

      {/* Z2 — INDICES */}
      <div className="market-deck__zone market-deck__zone--indices">
        <span className="market-deck__label">INDICES US</span>
        <div className="market-deck__indices-row">
          <IndexCell label="SPX" quote={quotes['^SPX']} spark={sparklines['^SPX']} />
          <IndexCell label="NDX" quote={quotes['^NDX']} spark={sparklines['^NDX']} />
          <IndexCell label="DJI" quote={quotes['^DJI']} spark={sparklines['^DJI']} />
        </div>
      </div>

      {/* Z3 — VIX + RÉGIME */}
      <div className="market-deck__zone">
        <span className="market-deck__label">VIX</span>
        <div className="market-deck__vix-row">
          <span className="market-deck__vix-value">
            {vix?.price != null && Number.isFinite(vix.price) ? vix.price.toFixed(2) : '—'}
          </span>
          <DeltaPill pct={vix?.changePercent} compact />
        </div>
        {regime ? (
          <span
            className={`market-deck__regime${regime.hot ? ' market-deck__regime--hot' : ''}`}
          >
            {regime.label}
          </span>
        ) : (
          <span className="market-deck__caption">— régime</span>
        )}
      </div>

      {/* Z4 — FX & TAUX */}
      <div className="market-deck__zone">
        <span className="market-deck__label">
          USD/CHF
          <span className="market-deck__fx-mode">{fxBadge}</span>
        </span>
        <div className="market-deck__fx-row">
          <span className="market-deck__fx-value">
            {rate != null && Number.isFinite(rate) ? rate.toFixed(4) : '—'}
          </span>
        </div>
        <div className="market-deck__rates-row">
          <span className="market-deck__rate">
            <span className="market-deck__rate-label">DXY</span>
            <span className="market-deck__rate-value">
              {Number.isFinite(quotes['DX-Y.NYB']?.price)
                ? quotes['DX-Y.NYB'].price.toFixed(2)
                : '—'}
            </span>
            <DeltaPill pct={quotes['DX-Y.NYB']?.changePercent} compact />
          </span>
          <span className="market-deck__rate">
            <span className="market-deck__rate-label">US10Y</span>
            <span className="market-deck__rate-value">
              {Number.isFinite(quotes['^TNX']?.price) ? quotes['^TNX'].price.toFixed(2) : '—'}
            </span>
            <DeltaPill pct={quotes['^TNX']?.changePercent} compact />
          </span>
        </div>
        <span className="market-deck__caption">taux appliqué</span>
      </div>

      {/* Z5 — ÉVÉNEMENT */}
      <div className="market-deck__zone market-deck__zone--events">
        <span className="market-deck__label">
          ÉVÉNEMENT
          {calError ? <span className="market-deck__fx-mode">LOCAL</span> : null}
        </span>
        <div className="market-deck__event-line">
          <span className="market-deck__event-kind">MACRO</span>
          {nextMacro ? (
            <>
              <span className="market-deck__event-name" title={nextMacro.name}>
                {nextMacro.name}
              </span>
              <span className="market-deck__event-eta">
                {daysUntil(nextMacro.date) === 0 ? 'AUJ.' : `J-${daysUntil(nextMacro.date)}`}
              </span>
            </>
          ) : (
            <span className="market-deck__event-empty">— sous {EVENT_WINDOW_DAYS} j</span>
          )}
        </div>
        <div className="market-deck__event-line">
          <span className="market-deck__event-kind">EARNINGS</span>
          {nextEarnings ? (
            <>
              <span className="market-deck__event-name">{nextEarnings.ticker}</span>
              <span className="market-deck__event-eta">
                {earnDays === 0 ? 'AUJ.' : `J-${earnDays}`}
              </span>
              {earnDays != null && earnDays <= 2 && (
                <span className="market-deck__armed">ARMED</span>
              )}
            </>
          ) : (
            <span className="market-deck__event-empty">— sous {EVENT_WINDOW_DAYS} j</span>
          )}
        </div>
      </div>
    </section>
  );
}
