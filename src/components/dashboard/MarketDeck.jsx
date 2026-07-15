// ═══════════════════════════════════════════════════════════════
//  MARKET DECK v2 — densité absolue (v1.0 · 1.C.2)
//
//  Étage MARCHÉ du cockpit (le conteneur .cockpit soude cet étage à
//  l'étage portefeuille — CommandDeck — sous la hairline du tape).
//  6 zones sur hairlines verticales, 2-3 lignes de données par zone :
//    Z1 SESSION     — dot + phase 23 · countdown 30 (tick 1 s isolé) ·
//                     heure NY 15
//    Z2 INDICES US  — grille 2×2 SPX·NDX / DJI·RUT (prix 22, pastille
//                     15, spark 36×24) + sous-ligne FUTURES hors RTH
//                     (ES/NQ/YM — injectés dans le MÊME batch quotes
//                     via useQuoteBatchExtras, zéro boucle nouvelle)
//    Z3 VOLATILITÉ  — VIX 32 + pastille 18 + chip RÉGIME (seuils 1.C)
//                     + bornes du jour H · L (payload quote high/low)
//    Z4 FX & TAUX   — USD/CHF appliqué 26 (store FX, badge mode) +
//                     EUR/USD · US10Y · DXY empilés
//    Z5 EUROPE·ASIE — DAX / FTSE / NIKKEI en pile serrée
//    Z6 AGENDA 14 J — 2 macro + 2 earnings de POSITIONS OUVERTES,
//                     AUJ./J-1/J-2 en accent, ARMED ≤ J-2
//
//  Registre micro data-viz sanctionné (1.C.2 §0) : valeurs secondaires
//  et intérieurs de pastilles 13-16 ; labels de LECTURE ≥17.
//  Données : pollers partagés 1.C (tape) — zéro appel additionnel.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import useMarketQuotes, { useQuoteBatchExtras } from '../../hooks/useMarketQuotes';
import { useMarketSparklines } from '../../hooks/useMarketSparklines';
import useCalendarFeeds from '../../hooks/useCalendarFeeds';
import { useFx } from '../../hooks/useFx';
import { useOpenPositions } from '../../store/useStore';
import { STATIC_FETCH_SYMBOLS, TickerSparkline } from '../layout/TickerTape';
import { computeMarketPhase, formatCountdown } from '../../utils/marketPhase';
import { macroEventsInRange } from '../../data/macroEvents2026';

const PHASE_LABELS = {
  open: 'OUVERT',
  pre: 'PRÉ-MARCHÉ',
  after: 'AFTER',
  closed: 'FERMÉ',
};

const EVENT_WINDOW_DAYS = 14;

// Futures overnight — mêmes symboles que la page Premarket (U12),
// servis par /api/quote (cascade Yahoo). Consommés HORS RTH uniquement.
const FUTURES = [
  { sym: 'ES=F', label: 'ES' },
  { sym: 'NQ=F', label: 'NQ' },
  { sym: 'YM=F', label: 'YM' },
];
const FUTURES_SYMBOLS = FUTURES.map((f) => f.sym);

// ─── Z1 — Session : tick 1 s isolé (ne re-rend pas le deck) ─────
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
      <div className="market-deck__ny">NEW YORK {nyLabel}</div>
    </>
  );
}

// ─── Pastille Δ% (anatomie tape, tailles du registre micro) ─────
function DeltaPill({ pct, size = 'sm' }) {
  if (pct == null || !Number.isFinite(pct)) {
    return <span className={`market-deck__pill market-deck__pill--${size} market-deck__pill--mute`}>—</span>;
  }
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '';
  return (
    <span className={`market-deck__pill market-deck__pill--${size} market-deck__pill--${dir}`}>
      {arrow && <span className="market-deck__pill-arrow">{arrow}</span>}
      {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

function fmtIndexPrice(price, decimals = 2) {
  if (price == null || !Number.isFinite(price)) return '—';
  if (price >= 1000) return new Intl.NumberFormat('de-CH').format(Math.round(price));
  return price.toFixed(decimals);
}

function sparkColorOf(spark) {
  if (!spark?.prices || spark.prices.length < 2) return 'var(--ink-soft)';
  const first = spark.prices[0];
  const last = spark.prices[spark.prices.length - 1];
  if (last > first) return 'var(--pnl-up)';
  if (last < first) return 'var(--pnl-down)';
  return 'var(--ink-soft)';
}

// ─── Z2 — cellule d'indice US (grille 2×2) ──────────────────────
function IndexCell({ label, quote, spark }) {
  const color = useMemo(() => sparkColorOf(spark), [spark]);
  return (
    <div className="market-deck__index">
      <div className="market-deck__index-head">
        <span className="market-deck__index-symbol">{label}</span>
        <DeltaPill pct={quote?.changePercent} size="sm" />
      </div>
      <div className="market-deck__index-body">
        <span className="market-deck__index-price">{fmtIndexPrice(quote?.price)}</span>
        {spark?.prices && spark.prices.length > 1 && (
          <span className="market-deck__index-spark">
            <TickerSparkline prices={spark.prices} color={color} width={36} height={24} />
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Z5 — rangée internationale (pile serrée) ───────────────────
function IntlRow({ label, quote }) {
  return (
    <div className="market-deck__intl-row">
      <span className="market-deck__intl-symbol">{label}</span>
      <span className="market-deck__intl-price">{fmtIndexPrice(quote?.price)}</span>
      <DeltaPill pct={quote?.changePercent} size="sm" />
    </div>
  );
}

// ─── Z4 — rangée taux/FX secondaire ─────────────────────────────
function RateRow({ label, quote, decimals = 2 }) {
  return (
    <div className="market-deck__rate-row">
      <span className="market-deck__rate-label">{label}</span>
      <span className="market-deck__rate-value">
        {quote?.price != null && Number.isFinite(quote.price) ? quote.price.toFixed(decimals) : '—'}
      </span>
      <DeltaPill pct={quote?.changePercent} size="xs" />
    </div>
  );
}

// ─── Z3 — régime VIX (seuils 1.C inchangés) ─────────────────────
function vixRegime(v) {
  if (v == null || !Number.isFinite(v)) return null;
  if (v < 15) return { label: 'CALME', hot: false };
  if (v < 20) return { label: 'NORMAL', hot: false };
  if (v < 27) return { label: 'NERVEUX', hot: true };
  return { label: 'STRESS', hot: true };
}

// ─── Z6 — dates ─────────────────────────────────────────────────
function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoPlusDays(days) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function daysUntil(iso) {
  const a = new Date(`${isoToday()}T00:00:00Z`).getTime();
  const b = new Date(`${iso}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function etaLabel(days) {
  return days === 0 ? 'AUJ.' : `J-${days}`;
}

// Compacte le nom d'événement macro : « FOMC — Décision de taux » →
// « FOMC », « CPI (juin 2026) » → « CPI ». La zone n'offre ~90 px au
// nom : une ellipse en pleine parenthèse (« CPI (jui… ») est pire que
// le sigle sec — le détail complet reste dans le title (hover).
function compactEventName(name) {
  return String(name || '')
    .split(' — ')[0]
    .split(' (')[0];
}

// Groupe d'agenda (macro ou earnings) : items EMPILÉS, un par ligne —
// le kind n'est posé que sur la première ligne, les suivantes s'indentent.
function AgendaGroup({ kind, items, emptyLabel, armedAt = null }) {
  if (items.length === 0) {
    return (
      <div className="market-deck__agenda-line">
        <span className="market-deck__agenda-kind">{kind}</span>
        <span className="market-deck__agenda-empty">{emptyLabel}</span>
      </div>
    );
  }
  return (
    <>
      {items.map((it, i) => {
        const d = daysUntil(it.date);
        const hot = d <= 2; // AUJ./J-1/J-2 en accent (signal d'attention)
        return (
          <div className="market-deck__agenda-line" key={`${it.name}-${it.date}-${i}`}>
            <span className="market-deck__agenda-kind">{i === 0 ? kind : ''}</span>
            <span className="market-deck__agenda-name" title={it.name}>
              {compactEventName(it.name)}
            </span>
            {armedAt != null && d <= armedAt && <span className="market-deck__armed">ARMED</span>}
            <span className={`market-deck__agenda-eta${hot ? ' market-deck__agenda-eta--hot' : ''}`}>
              {etaLabel(d)}
            </span>
          </div>
        );
      })}
    </>
  );
}

export default function MarketDeck() {
  // Phase de marché au rythme des re-renders du deck (les trains de
  // quotes 60 s suffisent ; le tick 1 s vit dans SessionZone).
  // eslint-disable-next-line react-hooks/purity
  const phase = computeMarketPhase(new Date()).phase;
  const horsRTH = phase !== 'open';

  const { quotes } = useMarketQuotes(STATIC_FETCH_SYMBOLS);
  // Futures : rejoignent le MÊME batch, HORS RTH uniquement.
  useQuoteBatchExtras(STATIC_FETCH_SYMBOLS, horsRTH ? FUTURES_SYMBOLS : []);
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

  // MACRO : jusqu'à 2 prochains (feed Finnhub sinon fallback local).
  const nextMacros = useMemo(() => {
    const feed = (macro || [])
      .map((e) => ({ date: e.time || e.date, name: e.event }))
      .filter((e) => e.date && e.date >= today && e.date <= horizon);
    const src = feed.length
      ? feed
      : macroEventsInRange(today, horizon).map((e) => ({ date: e.time, name: e.event }));
    return src.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 2);
  }, [macro, today, horizon]);

  // EARNINGS : jusqu'à 2 prochains d'une POSITION OUVERTE.
  const nextEarnings = useMemo(() => {
    const rows = (earnings || [])
      .map((e) => ({ date: e.date || e.time, name: String(e.symbol || '').toUpperCase() }))
      .filter((e) => e.date && e.name && e.date >= today && e.date <= horizon);
    return rows.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 2);
  }, [earnings, today, horizon]);

  const vix = quotes['^VIX'];
  const regime = vixRegime(vix?.price);
  const vixHigh = vix?.high;
  const vixLow = vix?.low;

  // Badge de mode FX (1.C) : manual → MANUEL ; auto + source live → LIVE ; sinon AUTO.
  const fxBadge =
    mode === 'manual' ? 'MANUEL' : String(source || '').startsWith('live') ? 'LIVE' : 'AUTO';

  // Futures avec données servies (prix fini) — proxy muet → ligne absente.
  const liveFutures = horsRTH
    ? FUTURES.filter((f) => Number.isFinite(quotes[f.sym]?.price))
    : [];

  return (
    <section className="market-deck" aria-label="Marché en un coup d'œil">
      {/* Z1 — SESSION */}
      <div className="market-deck__zone market-deck__zone--session">
        <span className="market-deck__label">SESSION</span>
        <SessionZone />
      </div>

      {/* Z2 — INDICES US (2×2) + FUTURES hors RTH */}
      <div className="market-deck__zone market-deck__zone--indices">
        <span className="market-deck__label">INDICES US</span>
        <div className="market-deck__indices-grid">
          <IndexCell label="SPX" quote={quotes['^SPX']} spark={sparklines['^SPX']} />
          <IndexCell label="NDX" quote={quotes['^NDX']} spark={sparklines['^NDX']} />
          <IndexCell label="DJI" quote={quotes['^DJI']} spark={sparklines['^DJI']} />
          <IndexCell label="RUT" quote={quotes['^RUT']} spark={sparklines['^RUT']} />
        </div>
        {liveFutures.length > 0 && (
          <div className="market-deck__futures">
            <span className="market-deck__futures-tag">FUT</span>
            {liveFutures.map((f) => (
              <span className="market-deck__future" key={f.sym}>
                <span className="market-deck__future-label">{f.label}</span>
                <DeltaPill pct={quotes[f.sym]?.changePercent} size="xs" />
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Z3 — VOLATILITÉ */}
      <div className="market-deck__zone">
        <span className="market-deck__label">VOLATILITÉ</span>
        <div className="market-deck__vix-row">
          <span className="market-deck__vix-value">
            {vix?.price != null && Number.isFinite(vix.price) ? vix.price.toFixed(2) : '—'}
          </span>
          <DeltaPill pct={vix?.changePercent} size="md" />
        </div>
        {regime ? (
          <span className={`market-deck__regime${regime.hot ? ' market-deck__regime--hot' : ''}`}>
            {regime.label}
          </span>
        ) : (
          <span className="market-deck__caption">— régime</span>
        )}
        <div className="market-deck__hl">
          {Number.isFinite(vixHigh) && Number.isFinite(vixLow) ? (
            <>
              <span className="market-deck__hl-bit">
                <span className="market-deck__hl-label">H</span>
                <span className="market-deck__hl-value">{vixHigh.toFixed(2)}</span>
              </span>
              <span className="market-deck__agenda-sep">·</span>
              <span className="market-deck__hl-bit">
                <span className="market-deck__hl-label">L</span>
                <span className="market-deck__hl-value">{vixLow.toFixed(2)}</span>
              </span>
            </>
          ) : (
            <span className="market-deck__hl-bit">
              <span className="market-deck__hl-label">H · L</span>
              <span className="market-deck__hl-value">—</span>
            </span>
          )}
        </div>
      </div>

      {/* Z4 — FX & TAUX */}
      <div className="market-deck__zone">
        <span className="market-deck__label">
          FX &amp; TAUX
          <span className="market-deck__fx-mode">{fxBadge}</span>
        </span>
        <div className="market-deck__fx-row">
          <span className="market-deck__rate-label">USD/CHF</span>
          <span className="market-deck__fx-value">
            {rate != null && Number.isFinite(rate) ? rate.toFixed(4) : '—'}
          </span>
        </div>
        <span className="market-deck__fx-caption">taux appliqué</span>
        <div className="market-deck__rates">
          <RateRow label="EUR/USD" quote={quotes['EURUSD=X']} decimals={4} />
          <RateRow label="US10Y" quote={quotes['^TNX']} />
          <RateRow label="DXY" quote={quotes['DX-Y.NYB']} />
        </div>
      </div>

      {/* Z5 — EUROPE · ASIE */}
      <div className="market-deck__zone">
        <span className="market-deck__label">EUROPE · ASIE</span>
        <div className="market-deck__intl">
          <IntlRow label="DAX" quote={quotes['^GDAXI']} />
          <IntlRow label="FTSE" quote={quotes['^FTSE']} />
          <IntlRow label="NIKKEI" quote={quotes['^N225']} />
        </div>
      </div>

      {/* Z6 — AGENDA 14 J */}
      <div className="market-deck__zone market-deck__zone--events">
        <span className="market-deck__label">
          AGENDA 14 J
          {calError ? <span className="market-deck__fx-mode">LOCAL</span> : null}
        </span>
        <div className="market-deck__agenda">
          <AgendaGroup
            kind="MACRO"
            items={nextMacros}
            emptyLabel={`— sous ${EVENT_WINDOW_DAYS} j`}
          />
          <AgendaGroup
            kind="EARNINGS"
            items={nextEarnings}
            emptyLabel={`— sous ${EVENT_WINDOW_DAYS} j`}
            armedAt={2}
          />
        </div>
      </div>
    </section>
  );
}
