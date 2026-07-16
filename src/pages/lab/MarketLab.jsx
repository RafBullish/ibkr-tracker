// ═══════════════════════════════════════════════════════════════
//  MARKET LAB — /lab/market (1.C.3) · DEV-ONLY, ÉPHÉMÈRE
//
//  Calibration COMPOSITIONNELLE de l'étage marché du cockpit (méthode
//  des labs D1/D2.F/1.B.3). Quatre étages empilés, finition production :
//    A · Témoin v2 (composant réel)        · 150 px
//    B · MONITEUR — grille tabulaire pure  · ~170 px
//    C · INSTRUMENT — B + organes data-viz · ~190 px
//    D · COMMAND WALL — mur maximal        · ~220 px
//
//  LOI ANTI-VIDE : colonnes tabulaires serrées (gaps 8-12), rangées
//  ~24 px, aucun justify-between étiré — le surplus meurt en fin de
//  zone. Données : pollers partagés du cockpit (une instanciation en
//  tête de page), sparklines du cache — ZÉRO polling additionnel.
//  Sondes L0 affichées en tête. PURGÉ intégralement en L2.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import useMarketQuotes, { useQuoteBatchExtras } from '../../hooks/useMarketQuotes';
import { useMarketSparklines } from '../../hooks/useMarketSparklines';
import useCalendarFeeds from '../../hooks/useCalendarFeeds';
import { useFx } from '../../hooks/useFx';
import { useOpenPositions } from '../../store/useStore';
import MarketDeck from '../../components/dashboard/MarketDeck';
import { STATIC_FETCH_SYMBOLS, TickerSparkline } from '../../components/layout/TickerTape';
import { computeMarketPhase, formatCountdown } from '../../utils/marketPhase';
import { macroEventsInRange } from '../../data/macroEvents2026';
import '../../styles/lab-market.css';

const FUTURES = [
  { sym: 'ES=F', label: 'ES' },
  { sym: 'NQ=F', label: 'NQ' },
  { sym: 'YM=F', label: 'YM' },
];
const FUTURES_SYMBOLS = FUTURES.map((f) => f.sym);

const US_INDICES = [
  { sym: '^SPX', label: 'SPX' },
  { sym: '^NDX', label: 'NDX' },
  { sym: '^DJI', label: 'DJI' },
  { sym: '^RUT', label: 'RUT' },
];

const INTL = [
  { sym: '^GDAXI', label: 'DAX' },
  { sym: '^FTSE', label: 'FTSE' },
  { sym: '^N225', label: 'NIKKEI' },
];

const MONDE_ROW2 = [
  { sym: 'GC=F', label: 'GOLD' },
  { sym: 'CL=F', label: 'CRUDE' },
  { sym: 'BTC-USD', label: 'BTC' },
];

const PHASE_LABELS = { open: 'OUVERT', pre: 'PRÉ-MARCHÉ', after: 'AFTER', closed: 'FERMÉ' };
const EVENT_WINDOW_DAYS = 14;

// ─── Helpers ────────────────────────────────────────────────────
function fmtPrice(price, decimals = 2) {
  if (price == null || !Number.isFinite(price)) return '—';
  if (price >= 1000) return new Intl.NumberFormat('de-CH').format(Math.round(price));
  return price.toFixed(decimals);
}

function fmtNet(change) {
  if (change == null || !Number.isFinite(change)) return '—';
  const sign = change > 0 ? '+' : change < 0 ? '−' : '';
  const abs = Math.abs(change);
  return `${sign}${abs >= 1000 ? new Intl.NumberFormat('de-CH').format(Math.round(abs)) : abs.toFixed(2)}`;
}

function sparkColorOf(spark) {
  if (!spark?.prices || spark.prices.length < 2) return 'var(--ink-soft)';
  const first = spark.prices[0];
  const last = spark.prices[spark.prices.length - 1];
  if (last > first) return 'var(--pnl-up)';
  if (last < first) return 'var(--pnl-down)';
  return 'var(--ink-soft)';
}

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
function etaLabel(d) {
  return d === 0 ? 'AUJ.' : `J-${d}`;
}
function compactEventName(name) {
  return String(name || '').split(' — ')[0].split(' (')[0];
}

function Pill({ pct, size = 'sm' }) {
  if (pct == null || !Number.isFinite(pct)) {
    return <span className={`lm-pill lm-pill--${size} lm-pill--mute`}>—</span>;
  }
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '';
  return (
    <span className={`lm-pill lm-pill--${size} lm-pill--${dir}`}>
      {arrow && <span className="lm-pill__arrow">{arrow}</span>}
      {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

// ─── Organes data-viz (C/D) ─────────────────────────────────────
function SessionProgress({ startMs, targetMs, nowMs }) {
  if (startMs == null || targetMs == null || targetMs <= startMs) return null;
  const pct = Math.max(0, Math.min(100, ((nowMs - startMs) / (targetMs - startMs)) * 100));
  return (
    <div className="lm-progress" aria-hidden="true">
      <div className="lm-progress__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

function AmplitudeBar({ low, high, price }) {
  if (![low, high, price].every(Number.isFinite) || high <= low) return null;
  const pct = Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100));
  return (
    <span className="lm-ampl" title={`L ${low.toFixed(2)} · H ${high.toFixed(2)}`} aria-hidden="true">
      <span className="lm-ampl__cursor" style={{ left: `${pct}%` }} />
    </span>
  );
}

// Échelle de régime VIX : 4 segments <15 · 15-20 · 20-27 · ≥27 (bornes
// visuelles 10-40), curseur triangulaire, libellé au-dessus du segment actif.
const VIX_SEGMENTS = [
  { from: 10, to: 15, label: 'CALME' },
  { from: 15, to: 20, label: 'NORMAL' },
  { from: 20, to: 27, label: 'NERVEUX' },
  { from: 27, to: 40, label: 'STRESS' },
];

function RegimeScale({ vix }) {
  if (!Number.isFinite(vix)) return null;
  const clamped = Math.max(10, Math.min(40, vix));
  const segIdx = VIX_SEGMENTS.findIndex((s) => clamped >= s.from && clamped < s.to);
  const idx = segIdx === -1 ? 3 : segIdx;
  const seg = VIX_SEGMENTS[idx];
  // Position : segments égaux (25 % chacun), interpolation dans le segment.
  const inner = (clamped - seg.from) / (seg.to - seg.from);
  const pct = idx * 25 + inner * 25;
  const hot = vix >= 20;
  return (
    <div className="lm-scale" aria-label={`Régime VIX : ${seg.label}`}>
      <div className="lm-scale__labels">
        <span className="lm-scale__regime" style={{ left: `${idx * 25 + 12.5}%` }}>
          {seg.label}
        </span>
      </div>
      <div className="lm-scale__track">
        {VIX_SEGMENTS.map((s, i) => (
          <span className="lm-scale__seg" key={s.label} data-i={i} />
        ))}
        <span
          className={`lm-scale__cursor${hot ? ' lm-scale__cursor--hot' : ''}`}
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Timeline14({ macros, earnings }) {
  const events = [
    ...macros.map((m) => ({ ...m, kind: 'macro' })),
    ...earnings.map((e) => ({ ...e, kind: 'earn' })),
  ];
  return (
    <div className="lm-timeline" aria-label="Timeline 14 jours">
      <div className="lm-timeline__track">
        {Array.from({ length: 15 }, (_, i) => (
          <span className="lm-timeline__tick" key={i} style={{ left: `${(i / 14) * 100}%` }} />
        ))}
        {events.map((ev, i) => {
          const d = daysUntil(ev.date);
          if (d < 0 || d > 14) return null;
          const hot = d <= 2;
          const pct = Math.max(2, Math.min(98, (d / 14) * 100));
          return (
            <span
              key={`${ev.kind}-${ev.name}-${i}`}
              className={`lm-timeline__dot lm-timeline__dot--${ev.kind}${hot ? ' lm-timeline__dot--hot' : ''}`}
              style={{ left: `${pct}%` }}
              title={`${ev.name} · ${etaLabel(d)}`}
            />
          );
        })}
      </div>
      <div className="lm-timeline__names">
        {events.map((ev, i) => {
          const d = daysUntil(ev.date);
          if (d < 0 || d > 14) return null;
          // Bornes 6-92 % : les labels d'extrémité ne se font pas couper.
          const pct = Math.max(6, Math.min(92, (d / 14) * 100));
          return (
            <span
              key={`n-${ev.kind}-${i}`}
              className="lm-timeline__name"
              style={{ left: `${pct}%` }}
            >
              {compactEventName(ev.name)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Z1 SESSION (tick 1 s isolé) ────────────────────────────────
function SessionZone({ cfg }) {
  const [now, setNow] = useState(() => new Date());
  const reduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );
  useEffect(() => {
    if (reduced) return undefined;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [reduced]);

  const { phase, targetKind, targetMs, phaseStartMs, nyLabel } = computeMarketPhase(now);
  return (
    <>
      <div className="lm-session-row">
        <span
          className={`lm-dot${phase === 'open' ? ' lm-dot--live' : ''}`}
          aria-hidden="true"
        />
        <span className="lm-phase">{PHASE_LABELS[phase]}</span>
      </div>
      <div className="lm-countdown">
        <span className="lm-countdown__label">
          {targetKind === 'close' ? 'CLÔTURE DANS' : 'OUVERTURE DANS'}
        </span>
        <span className="lm-countdown__value" style={{ fontSize: cfg.countdown }}>
          {formatCountdown(targetMs != null ? targetMs - now.getTime() : null)}
        </span>
      </div>
      {cfg.organs && (
        <SessionProgress startMs={phaseStartMs} targetMs={targetMs} nowMs={now.getTime()} />
      )}
      <div className="lm-ny">NEW YORK {nyLabel}</div>
    </>
  );
}

// ─── Z2 INDICES US — mini-table tabulaire ───────────────────────
function IndicesZone({ cfg, quotes, sparklines, showFut, futServed, isRTH }) {
  const cols = cfg.organs ? 6 : 5;
  return (
    <>
      <div className={`lm-table lm-table--idx${cfg.organs ? ' lm-table--idx-organs' : ''}`}>
        {US_INDICES.map(({ sym, label }) => {
          const q = quotes[sym];
          const spark = sparklines[sym];
          return (
            <div className="lm-row" key={sym} style={{ gridColumn: `span ${cols}`, display: 'contents' }}>
              <span className="lm-sym">{label}</span>
              <span className="lm-price">{fmtPrice(q?.price)}</span>
              <Pill pct={q?.changePercent} size="sm" />
              <span className="lm-net">{fmtNet(q?.change)}</span>
              <span className="lm-spark">
                {spark?.prices && spark.prices.length > 1 ? (
                  <TickerSparkline prices={spark.prices} color={sparkColorOf(spark)} width={cfg.organs ? 34 : 40} height={18} />
                ) : null}
              </span>
              {cfg.organs && <AmplitudeBar low={q?.low} high={q?.high} price={q?.price} />}
            </div>
          );
        })}
      </div>
      {/* Rangée FUT : B/C hors RTH (ou toggle) ; D = slot permanent. */}
      {futServed && (showFut || cfg.wall) && (
        <div className="lm-fut">
          <span className="lm-fut__tag">FUT</span>
          {cfg.wall && isRTH && !showFut ? (
            <>
              <span className="lm-chip">RTH</span>
              {FUTURES.map(({ sym, label }) => {
                const q = quotes[sym];
                return (
                  <span className="lm-fut__item" key={sym}>
                    <span className="lm-fut__label">{label}</span>
                    <span className="lm-fut__hl">
                      {Number.isFinite(q?.low) && Number.isFinite(q?.high)
                        ? `${Math.round(q.low)}–${Math.round(q.high)}`
                        : '—'}
                    </span>
                  </span>
                );
              })}
            </>
          ) : (
            FUTURES.map(({ sym, label }) => (
              <span className="lm-fut__item" key={sym}>
                <span className="lm-fut__label">{label}</span>
                <Pill pct={quotes[sym]?.changePercent} size="xs" />
              </span>
            ))
          )}
        </div>
      )}
    </>
  );
}

// ─── Z3 VOLATILITÉ ──────────────────────────────────────────────
function VolZone({ cfg, quotes, sparklines }) {
  const vix = quotes['^VIX'];
  const spark = sparklines['^VIX'];
  // Δ5j dérivé de la série 7 j en cache (marqué ~), si ≥6 points.
  const d5 = useMemo(() => {
    const p = spark?.prices;
    if (!p || p.length < 6) return null;
    const ref = p[p.length - 6];
    const last = p[p.length - 1];
    if (!Number.isFinite(ref) || !Number.isFinite(last) || ref === 0) return null;
    return ((last - ref) / ref) * 100;
  }, [spark]);

  return (
    <>
      <div className="lm-vix-row">
        <span className="lm-vix">{Number.isFinite(vix?.price) ? vix.price.toFixed(2) : '—'}</span>
        <Pill pct={vix?.changePercent} size="md" />
      </div>
      {cfg.organs ? (
        <RegimeScale vix={vix?.price} />
      ) : (
        <span className="lm-chip">
          {Number.isFinite(vix?.price)
            ? vix.price < 15 ? 'CALME' : vix.price < 20 ? 'NORMAL' : vix.price < 27 ? 'NERVEUX' : 'STRESS'
            : '—'}
        </span>
      )}
      <div className="lm-hl">
        <span className="lm-hl__bit">
          <span className="lm-hl__k">H</span>
          <span className="lm-hl__v">{Number.isFinite(vix?.high) ? vix.high.toFixed(2) : '—'}</span>
        </span>
        <span className="lm-sep">·</span>
        <span className="lm-hl__bit">
          <span className="lm-hl__k">L</span>
          <span className="lm-hl__v">{Number.isFinite(vix?.low) ? vix.low.toFixed(2) : '—'}</span>
        </span>
      </div>
      {cfg.wall && d5 != null && (
        <div className="lm-hl">
          <span className="lm-hl__bit">
            <span className="lm-hl__k">Δ5J</span>
            <span className="lm-hl__v">{`~${d5 >= 0 ? '+' : '−'}${Math.abs(d5).toFixed(1)}%`}</span>
          </span>
        </div>
      )}
      <span className="lm-spark lm-spark--vix">
        {spark?.prices && spark.prices.length > 1 ? (
          <TickerSparkline prices={spark.prices} color={sparkColorOf(spark)} width={56} height={20} />
        ) : null}
      </span>
    </>
  );
}

// ─── Z4 FX & TAUX — mini-table 4 rangées ────────────────────────
function FxZone({ quotes, rate, fxBadge }) {
  return (
    <div className="lm-table lm-table--fx">
      <span className="lm-sym">USD/CHF</span>
      <span className="lm-price lm-price--fx">{Number.isFinite(rate) ? rate.toFixed(4) : '—'}</span>
      <span className="lm-fx-tags">
        <span className="lm-chip lm-chip--tight">{fxBadge}</span>
        <span className="lm-suffix">APPLIQUÉ</span>
      </span>
      <span className="lm-sym">EUR/USD</span>
      <span className="lm-price lm-price--fx">
        {Number.isFinite(quotes['EURUSD=X']?.price) ? quotes['EURUSD=X'].price.toFixed(4) : '—'}
      </span>
      <Pill pct={quotes['EURUSD=X']?.changePercent} size="sm" />
      <span className="lm-sym">US10Y</span>
      <span className="lm-price lm-price--fx">
        {Number.isFinite(quotes['^TNX']?.price) ? quotes['^TNX'].price.toFixed(2) : '—'}
      </span>
      <Pill pct={quotes['^TNX']?.changePercent} size="sm" />
      <span className="lm-sym">DXY</span>
      <span className="lm-price lm-price--fx">
        {Number.isFinite(quotes['DX-Y.NYB']?.price) ? quotes['DX-Y.NYB'].price.toFixed(2) : '—'}
      </span>
      <Pill pct={quotes['DX-Y.NYB']?.changePercent} size="sm" />
    </div>
  );
}

// ─── Z5 EUROPE·ASIE / MONDE ─────────────────────────────────────
function IntlZone({ cfg, quotes, sparklines }) {
  return (
    <>
      <div className="lm-table lm-table--intl">
        {INTL.map(({ sym, label }) => {
          const q = quotes[sym];
          const spark = sparklines[sym];
          return (
            <div key={sym} style={{ display: 'contents' }}>
              <span className="lm-sym">{label}</span>
              <span className="lm-price lm-price--intl">{fmtPrice(q?.price)}</span>
              <Pill pct={q?.changePercent} size="sm" />
              <span className="lm-spark">
                {spark?.prices && spark.prices.length > 1 ? (
                  <TickerSparkline prices={spark.prices} color={sparkColorOf(spark)} width={32} height={16} />
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
      {cfg.wall && (
        <div className="lm-monde">
          {MONDE_ROW2.map(({ sym, label }) => (
            <span className="lm-monde__item" key={sym}>
              <span className="lm-monde__sym">{label}</span>
              <span className="lm-monde__val">{fmtPrice(quotes[sym]?.price)}</span>
              <Pill pct={quotes[sym]?.changePercent} size="xs" />
            </span>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Z6 AGENDA ──────────────────────────────────────────────────
function AgendaZone({ cfg, macros, earnings }) {
  const textRows = cfg.organs && !cfg.wall
    ? [
        { k: 'M', it: macros[0] },
        { k: 'E', it: earnings[0], armed: true },
      ]
    : [
        { k: 'M', it: macros[0] },
        { k: 'M', it: macros[1] },
        { k: 'E', it: earnings[0], armed: true },
        { k: 'E', it: earnings[1], armed: true },
      ];
  return (
    <>
      <div className="lm-agenda">
        {textRows.map((row, i) => {
          const it = row.it;
          if (!it) {
            return (
              <div className="lm-agenda__row" key={i}>
                <span className="lm-agenda__k">{row.k}</span>
                <span className="lm-sep">·</span>
                <span className="lm-agenda__empty">— sous {EVENT_WINDOW_DAYS} j</span>
              </div>
            );
          }
          const d = daysUntil(it.date);
          const hot = d <= 2;
          return (
            <div className="lm-agenda__row" key={i}>
              <span className="lm-agenda__k">{row.k}</span>
              <span className="lm-sep">·</span>
              <span className="lm-agenda__name" title={it.name}>
                {compactEventName(it.name)}
              </span>
              <span className="lm-sep">·</span>
              <span className={`lm-agenda__eta${hot ? ' lm-agenda__eta--hot' : ''}`}>{etaLabel(d)}</span>
              {row.armed && hot && <span className="lm-armed">ARMED</span>}
            </div>
          );
        })}
      </div>
      {cfg.organs && <Timeline14 macros={macros} earnings={earnings} />}
    </>
  );
}

// ─── Un étage marché complet (variante paramétrique) ────────────
function LabMarketFloor({ cfg, quotes, sparklines, rate, fxBadge, macros, earnings, showFut, futServed, isRTH }) {
  return (
    <section className="lm-floor" style={{ minHeight: cfg.h }} aria-label={`Variante ${cfg.key}`}>
      <div className="lm-zone">
        <span className="lm-label">SESSION</span>
        <SessionZone cfg={cfg} />
      </div>
      <div className="lm-zone">
        <span className="lm-label">INDICES US</span>
        <IndicesZone cfg={cfg} quotes={quotes} sparklines={sparklines} showFut={showFut} futServed={futServed} isRTH={isRTH} />
      </div>
      <div className="lm-zone">
        <span className="lm-label">VOLATILITÉ</span>
        <VolZone cfg={cfg} quotes={quotes} sparklines={sparklines} />
      </div>
      <div className="lm-zone">
        <span className="lm-label">FX &amp; TAUX</span>
        <FxZone quotes={quotes} rate={rate} fxBadge={fxBadge} />
      </div>
      <div className="lm-zone">
        <span className="lm-label">{cfg.wall ? 'MONDE' : 'EUROPE · ASIE'}</span>
        <IntlZone cfg={cfg} quotes={quotes} sparklines={sparklines} />
      </div>
      <div className="lm-zone">
        <span className="lm-label">AGENDA 14 J</span>
        <AgendaZone cfg={cfg} macros={macros} earnings={earnings} />
      </div>
    </section>
  );
}

const VARIANTS = [
  { key: 'B', name: 'MONITEUR', h: 170, countdown: 30, organs: false, wall: false },
  { key: 'C', name: 'INSTRUMENT', h: 190, countdown: 30, organs: true, wall: false },
  { key: 'D', name: 'COMMAND WALL', h: 220, countdown: 32, organs: true, wall: true },
];

// ─── Page ───────────────────────────────────────────────────────
export default function MarketLab() {
  const { quotes } = useMarketQuotes(STATIC_FETCH_SYMBOLS);
  // Lab : les futures rejoignent le batch en PERMANENCE (dev-only,
  // présentation — même train, aucune boucle nouvelle).
  useQuoteBatchExtras(STATIC_FETCH_SYMBOLS, FUTURES_SYMBOLS);
  const { sparklines } = useMarketSparklines(STATIC_FETCH_SYMBOLS);
  const openPositions = useOpenPositions();
  const { rate, mode, source } = useFx();
  const [forceFut, setForceFut] = useState(false);

  const fxBadge =
    mode === 'manual' ? 'MANUEL' : String(source || '').startsWith('live') ? 'LIVE' : 'AUTO';

  // eslint-disable-next-line react-hooks/purity
  const phase = computeMarketPhase(new Date()).phase;
  const isRTH = phase === 'open';

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
  const { earnings, macro } = useCalendarFeeds({
    viewYear: view.viewYear,
    viewMonth: view.viewMonth,
    myTickers,
    minImpact: 'medium',
  });

  const macros = useMemo(() => {
    const feed = (macro || [])
      .map((e) => ({ date: e.time || e.date, name: e.event }))
      .filter((e) => e.date && e.date >= today && e.date <= horizon);
    const src = feed.length
      ? feed
      : macroEventsInRange(today, horizon).map((e) => ({ date: e.time, name: e.event }));
    return src.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 2);
  }, [macro, today, horizon]);

  const earningsItems = useMemo(() => {
    const rows = (earnings || [])
      .map((e) => ({ date: e.date || e.time, name: String(e.symbol || '').toUpperCase() }))
      .filter((e) => e.date && e.name && e.date >= today && e.date <= horizon);
    return rows.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 2);
  }, [earnings, today, horizon]);

  // Sondes L0 (verdicts live)
  const futServed = FUTURES_SYMBOLS.every((s) => Number.isFinite(quotes[s]?.price));
  const hlServed = ['^SPX', '^NDX', '^DJI', '^RUT', '^VIX'].filter(
    (s) => Number.isFinite(quotes[s]?.high) && Number.isFinite(quotes[s]?.low)
  );
  const d5Derivable = (sparklines['^VIX']?.prices?.length || 0) >= 6;

  const common = {
    quotes,
    sparklines,
    rate,
    fxBadge,
    macros,
    earnings: earningsItems,
    showFut: forceFut || !isRTH,
    futServed,
    isRTH: isRTH && !forceFut,
  };

  return (
    <div className="lm-page">
      <header className="lm-head">
        <h1 className="lm-title">LAB · MARKET — calibration 1.C.3</h1>
        <p className="lm-sub">
          Quatre étages marché, mêmes données live. Loi anti-vide : grille tabulaire serrée.
          Choisis à l'œil : A (témoin), B, C ou D.
        </p>
        <div className="lm-probes">
          <span className={`lm-probe${futServed ? ' is-ok' : ' is-ko'}`}>
            FUT (ES/NQ/YM) : {futServed ? 'SERVIS' : 'NON SERVIS — ligne retirée'}
          </span>
          <span className="lm-probe is-ok">H/L servis : {hlServed.map((s) => s.replace('^', '')).join(' ') || '—'}</span>
          <span className={`lm-probe${d5Derivable ? ' is-ok' : ' is-ko'}`}>
            Δ5j VIX : {d5Derivable ? 'dérivable (~)' : 'indérivable — omis'}
          </span>
        </div>
        <button
          type="button"
          className={`lm-toggle${forceFut ? ' is-on' : ''}`}
          onClick={() => setForceFut((v) => !v)}
          aria-pressed={forceFut}
        >
          {forceFut ? '■ FUT/hors-RTH forcés' : '► Forcer FUT/hors-RTH'}
        </button>
      </header>

      <section className="lm-variant">
        <div className="lm-variant__label">A · Témoin v2 · 150 px (étage actuel, composant réel)</div>
        <div className="lm-witness">
          <MarketDeck />
        </div>
      </section>

      {VARIANTS.map((cfg) => (
        <section className="lm-variant" key={cfg.key}>
          <div className="lm-variant__label">
            {cfg.key} · {cfg.name} · ~{cfg.h} px
          </div>
          <LabMarketFloor cfg={cfg} {...common} />
        </section>
      ))}
    </div>
  );
}
