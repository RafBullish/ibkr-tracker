// ═══════════════════════════════════════════════════════════════
//  MARKET LAB III — /lab/market (1.C.5) · DEV-ONLY, ÉPHÉMÈRE
//
//  FUSION : UN seul langage (tuiles vivantes V2 × organes V3 ×
//  discipline tabulaire V1), en TROIS calibrations F1/F2/F3 dont
//  l'axe unique est la part des courbes (28 / 42 / 54 px).
//
//  LOIS DE CRAFT (1.C.5 §2) appliquées par construction :
//  - une seule anatomie de pastille (tape à l'échelle 15/16/18) et
//    une seule anatomie de chip reverse-video ;
//  - héros (tuiles indices, VIX) = pastilles · rangées tabulaires
//    (FX, MONDE, FUT) = Δ% texte coloré gras ;
//  - baseline 24 px, grille 4 px, titres de zone identiques (13 caps
//    .1em mute, même y), rangées tabulaires 24 px exactement ;
//  - décimales par classe : indices 0 · FX 4 · taux 2 · VIX 2 ·
//    GOLD/CRUDE 2 · BTC 0 ;
//  - courbes : intraday 1d/5m (sonde : 79 points → largeur max
//    474 px), interpolation monotone, aire 12 %→0, stroke 1.25 ;
//  - hairlines : --line-emphasis entre blocs, --hairline-rest
//    internes, zéro radius.
//  Données : pollers partagés 1.C (quotes + extras FUT) ; série
//  intraday via /api/chart EXISTANT (params range/interval déjà
//  whitelistés côté serveur — aucun endpoint/param nouveau).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react';
import useMarketQuotes, { useQuoteBatchExtras } from '../../hooks/useMarketQuotes';
import { useMarketSparklines } from '../../hooks/useMarketSparklines';
import useCalendarFeeds from '../../hooks/useCalendarFeeds';
import { useFx } from '../../hooks/useFx';
import { useOpenPositions } from '../../store/useStore';
import MarketDeck from '../../components/dashboard/MarketDeck';
import { STATIC_FETCH_SYMBOLS } from '../../components/layout/TickerTape';
import { computeMarketPhase, formatCountdown } from '../../utils/marketPhase';
import { macroEventsInRange } from '../../data/macroEvents2026';
import '../../styles/lab-market.css';

const FUTURES = [
  { sym: 'ES=F', label: 'ES' },
  { sym: 'NQ=F', label: 'NQ' },
  { sym: 'YM=F', label: 'YM' },
];
const FUTURES_SYMBOLS = FUTURES.map((f) => f.sym);
const US = [
  { sym: '^SPX', label: 'SPX' },
  { sym: '^NDX', label: 'NDX' },
  { sym: '^DJI', label: 'DJI' },
  { sym: '^RUT', label: 'RUT' },
];
const US_SYMBOLS = US.map((u) => u.sym);
const PHASE_LABELS = { open: 'OUVERT', pre: 'PRÉ-MARCHÉ', after: 'AFTER', closed: 'FERMÉ' };
const WINDOW_DAYS = 14;

// ─── Décimales par classe d'actif (loi §2.4) ────────────────────
const CHF = new Intl.NumberFormat('de-CH');
const CHF2 = new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmtVal(v, cls) {
  if (v == null || !Number.isFinite(v)) return '—';
  switch (cls) {
    case 'index':
    case 'btc':
      return CHF.format(Math.round(v));
    case 'fx':
      return v.toFixed(4);
    case 'rate':
    case 'vix':
      return v.toFixed(2);
    case 'cmdty':
      return CHF2.format(v);
    default:
      return CHF.format(Math.round(v));
  }
}
// Δ$ suit les décimales de la classe (loi §2.4) : indices 0 déc.
function fmtNet(change, cls = 'index') {
  if (change == null || !Number.isFinite(change)) return '—';
  const sign = change > 0 ? '+' : change < 0 ? '−' : '';
  const abs = Math.abs(change);
  if (cls === 'index' || cls === 'btc') return `${sign}${CHF.format(Math.round(abs))}`;
  return `${sign}${abs.toFixed(2)}`;
}
function fmtPct(pct) {
  if (pct == null || !Number.isFinite(pct)) return '—';
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return `${sign}${Math.abs(pct).toFixed(2)}%`;
}
function dirOf(v) {
  if (v == null || !Number.isFinite(v) || v === 0) return 'flat';
  return v > 0 ? 'up' : 'down';
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
function shortDate(iso) {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
}
function compactName(name) {
  return String(name || '').split(' — ')[0].split(' (')[0];
}

// ─── Atomes de craft (anatomies UNIQUES — loi §2.1) ─────────────
function Pastille({ pct, size = 16 }) {
  if (pct == null || !Number.isFinite(pct)) {
    return <span className={`fz-pill fz-pill--${size} fz-pill--flat`}>—</span>;
  }
  const dir = dirOf(pct);
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '';
  return (
    <span className={`fz-pill fz-pill--${size} fz-pill--${dir}`}>
      {arrow && <span className="fz-pill__arrow">{arrow}</span>}
      {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

function Chip({ children, tone = 'ink' }) {
  return <span className={`fz-chip fz-chip--${tone}`}>{children}</span>;
}

function DeltaText({ v, size = 15 }) {
  return (
    <span className={`fz-delta fz-delta--${size} fz-delta--${dirOf(v)}`}>{fmtPct(v)}</span>
  );
}

// ─── Courbe intraday — interpolation monotone (Fritsch–Carlson) ──
// Lissage doux SANS invention de données : la courbe passe par tous
// les points, les tangentes sont bornées pour ne jamais dépasser.
function monotonePath(xs, ys) {
  const n = xs.length;
  if (n < 2) return '';
  const dx = [];
  const slopes = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(xs[i + 1] - xs[i]);
    slopes.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  }
  const m = [slopes[0]];
  for (let i = 1; i < n - 1; i += 1) {
    if (slopes[i - 1] * slopes[i] <= 0) m.push(0);
    else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m.push((w1 + w2) / (w1 / slopes[i - 1] + w2 / slopes[i]));
    }
  }
  m.push(slopes[n - 2]);
  let d = `M ${xs[0].toFixed(2)},${ys[0].toFixed(2)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i] / 3;
    d += ` C ${(xs[i] + h).toFixed(2)},${(ys[i] + m[i] * h).toFixed(2)} ${(xs[i + 1] - h).toFixed(2)},${(ys[i + 1] - m[i + 1] * h).toFixed(2)} ${xs[i + 1].toFixed(2)},${ys[i + 1].toFixed(2)}`;
  }
  return d;
}

let gradSeq = 0;
function IntradaySpark({ prices, height }) {
  const idRef = useRef(null);
  if (idRef.current == null) {
    gradSeq += 1;
    idRef.current = `fzgrad${gradSeq}`;
  }
  if (!prices || prices.length < 2) {
    return <div className="fz-spark fz-spark--empty" style={{ height }} />;
  }
  const W = 120;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const xs = prices.map((_, i) => (i / (prices.length - 1)) * W);
  const ys = prices.map((p) => height - 3 - ((p - min) / range) * (height - 6));
  const line = monotonePath(xs, ys);
  const area = `${line} L ${W},${height} L 0,${height} Z`;
  const up = prices[prices.length - 1] >= prices[0];
  const color = up ? 'var(--pnl-up)' : 'var(--pnl-down)';
  return (
    <svg
      className="fz-spark"
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      style={{ height }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={idRef.current} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${idRef.current})`} stroke="none" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.25" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function useSessionNow() {
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
  return now;
}

// ═══ B1 · COMMANDEMENT ══════════════════════════════════════════
function CommandBlock() {
  const now = useSessionNow();
  const { phase, targetKind, targetMs, phaseStartMs, nyLabel } = computeMarketPhase(now);
  const nowMs = now.getTime();
  const pct =
    phaseStartMs != null && targetMs != null && targetMs > phaseStartMs
      ? Math.max(0, Math.min(100, ((nowMs - phaseStartMs) / (targetMs - phaseStartMs)) * 100))
      : null;
  return (
    <div className="fz-b fz-cmd">
      <div className="fz-cmd__phase">
        <span className={`fz-dot${phase === 'open' ? ' fz-dot--live' : ''}`} aria-hidden="true" />
        <Chip tone={phase === 'open' ? 'amber' : 'ink'}>{PHASE_LABELS[phase]}</Chip>
      </div>
      <div className="fz-cmd__cdlabel">
        {targetKind === 'close' ? 'CLÔTURE DANS' : 'OUVERTURE DANS'}
      </div>
      <div className="fz-cmd__cd">{formatCountdown(targetMs != null ? targetMs - nowMs : null)}</div>
      {pct != null && (
        <div className="fz-progress" role="img" aria-label={`Séance écoulée à ${Math.round(pct)} %`}>
          <div className="fz-progress__track">
            <div className="fz-progress__fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="fz-progress__pct">{Math.round(pct)} %</span>
        </div>
      )}
      <div className="fz-cmd__ny">NEW YORK {nyLabel}</div>
    </div>
  );
}

// ═══ B2 · INDICES US + FUT ══════════════════════════════════════
function IndexTile({ label, quote, spark, cal }) {
  return (
    <div className="fz-tile">
      <div className="fz-tile__head">
        <span className="fz-tile__sym">{label}</span>
        <Pastille pct={quote?.changePercent} size={cal.pill} />
      </div>
      <div className="fz-tile__pricerow">
        <span className="fz-tile__price">{fmtVal(quote?.price, 'index')}</span>
        <span className={`fz-delta fz-delta--15 fz-delta--${dirOf(quote?.change)}`}>
          {fmtNet(quote?.change, 'index')}
        </span>
      </div>
      <div className="fz-tile__spark">
        <IntradaySpark prices={spark?.prices} height={cal.curve} />
      </div>
    </div>
  );
}

function IndicesBlock({ quotes, intraday, futServed, cal }) {
  return (
    <div className="fz-b fz-indices">
      <div className="fz-title">INDICES US</div>
      <div className="fz-tiles">
        {US.map(({ sym, label }) => (
          <IndexTile key={sym} label={label} quote={quotes[sym]} spark={intraday[sym]} cal={cal} />
        ))}
      </div>
      <div className="fz-fut">
        <div className="fz-fut__label">
          FUT <span className="fz-fut__label-sub">· RANGE O/N</span>
        </div>
        {futServed ? (
          FUTURES.map(({ sym, label }) => {
            const q = quotes[sym];
            const range =
              Number.isFinite(q?.low) && Number.isFinite(q?.high)
                ? `${fmtVal(q.low, 'index')}–${fmtVal(q.high, 'index')}`
                : '—';
            return (
              <div className="fz-row fz-fut__row" key={sym}>
                <span className="fz-row__sym">{label}</span>
                <span className="fz-row__val">{fmtVal(q?.price, 'index')}</span>
                <DeltaText v={q?.changePercent} />
                <span className="fz-fut__range">{range}</span>
              </div>
            );
          })
        ) : (
          <div className="fz-row fz-fut__row">
            <span className="fz-row__empty">en attente du 1er train…</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ B3 · VOLATILITÉ ════════════════════════════════════════════
const REGIMES = [
  { to: 15, label: 'CALME' },
  { to: 20, label: 'NORMAL' },
  { to: 27, label: 'NERVEUX' },
  { to: 40, label: 'STRESS' },
];
const REGIME_GRADS = [10, 15, 20, 27, 40];

function regimeOf(vix) {
  if (!Number.isFinite(vix)) return null;
  if (vix < 15) return 0;
  if (vix < 20) return 1;
  if (vix < 27) return 2;
  return 3;
}

function RegimeScale({ vix }) {
  if (!Number.isFinite(vix)) return null;
  const clamped = Math.max(10, Math.min(40, vix));
  const idx = regimeOf(clamped);
  const from = REGIME_GRADS[idx];
  const to = REGIME_GRADS[idx + 1];
  const pct = idx * 25 + ((clamped - from) / (to - from)) * 25;
  const hot = vix >= 20;
  return (
    <div className="fz-scale" aria-label={`Régime VIX : ${REGIMES[idx].label}`}>
      <div className="fz-scale__track">
        {REGIMES.map((r, i) => (
          <span className={`fz-scale__seg${i === idx ? ' is-active' : ''}`} key={r.label} title={r.label} />
        ))}
        <span className={`fz-scale__cursor${hot ? ' is-hot' : ''}`} style={{ left: `${pct}%` }} />
      </div>
      <div className="fz-scale__grads">
        {REGIME_GRADS.map((g, i) => (
          <span key={g} style={{ left: `${i * 25}%` }}>{g}</span>
        ))}
      </div>
    </div>
  );
}

function VolBlock({ quotes, d5, cal }) {
  const vix = quotes['^VIX'];
  const idx = regimeOf(vix?.price);
  const hot = idx != null && idx >= 2;
  return (
    <div className="fz-b fz-vol">
      <div className="fz-title">VOLATILITÉ</div>
      <div className="fz-vol__hero">
        <span className="fz-vol__val">{fmtVal(vix?.price, 'vix')}</span>
        <Pastille pct={vix?.changePercent} size={cal.pill} />
      </div>
      <RegimeScale vix={vix?.price} />
      <div className="fz-vol__meta">
        {idx != null && <Chip tone={hot ? 'amber' : 'ink'}>{REGIMES[idx].label}</Chip>}
        <span className="fz-vol__hl">
          H <b>{fmtVal(vix?.high, 'vix')}</b> · L <b>{fmtVal(vix?.low, 'vix')}</b>
        </span>
      </div>
      {d5 != null && (
        <div className="fz-vol__d5">
          Δ5J <b>~{d5 >= 0 ? '+' : '−'}{Math.abs(d5).toFixed(1)}%</b>
        </div>
      )}
    </div>
  );
}

// ═══ B4 · FX & TAUX ═════════════════════════════════════════════
function FxBlock({ quotes, rate, fxBadge }) {
  return (
    <div className="fz-b fz-fx">
      <div className="fz-title">
        FX &amp; TAUX <Chip tone="ink">{fxBadge}</Chip>
      </div>
      <div className="fz-fx__hero">
        <span className="fz-fx__herosym">USD/CHF</span>
        <span className="fz-fx__heroval">{Number.isFinite(rate) ? rate.toFixed(4) : '—'}</span>
      </div>
      <div className="fz-fx__applied">APPLIQUÉ AU PORTEFEUILLE</div>
      {[
        { label: 'EUR/USD', q: quotes['EURUSD=X'], cls: 'fx' },
        { label: 'US10Y', q: quotes['^TNX'], cls: 'rate' },
        { label: 'DXY', q: quotes['DX-Y.NYB'], cls: 'rate' },
      ].map(({ label, q, cls }) => (
        <div className="fz-row" key={label}>
          <span className="fz-row__sym">{label}</span>
          <span className="fz-row__val">{fmtVal(q?.price, cls)}</span>
          <DeltaText v={q?.changePercent} />
        </div>
      ))}
    </div>
  );
}

// ═══ B5 · MONDE ═════════════════════════════════════════════════
const WORLD_COLS = [
  [
    { sym: '^GDAXI', label: 'DAX', cls: 'index' },
    { sym: '^FTSE', label: 'FTSE', cls: 'index' },
    { sym: '^N225', label: 'NIKKEI', cls: 'index' },
  ],
  [
    { sym: 'GC=F', label: 'GOLD', cls: 'cmdty' },
    { sym: 'CL=F', label: 'CRUDE', cls: 'cmdty' },
    { sym: 'BTC-USD', label: 'BTC', cls: 'btc' },
  ],
];

function WorldBlock({ quotes }) {
  return (
    <div className="fz-b fz-world">
      <div className="fz-title">MONDE</div>
      <div className="fz-world__cols">
        {WORLD_COLS.map((col, ci) => (
          <div className="fz-world__col" key={ci}>
            {col.map(({ sym, label, cls }) => (
              <div className="fz-row" key={sym}>
                <span className="fz-row__sym">{label}</span>
                <span className="fz-row__val">{fmtVal(quotes[sym]?.price, cls)}</span>
                <DeltaText v={quotes[sym]?.changePercent} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ B6 · AGENDA 14 J ═══════════════════════════════════════════
function AgendaBlock({ macros, earnings }) {
  const rows = [
    ...macros.slice(0, 3).map((m) => ({ k: 'M', ...m })),
    ...(earnings.length
      ? earnings.slice(0, 1).map((e) => ({ k: 'E', armed: true, ...e }))
      : [{ k: 'E', empty: true }]),
  ];
  // La timeline ne pointe que la fenêtre 14 j ; les rangées, elles,
  // listent les 3 prochains macro même au-delà (eta J-n l'indique).
  const dots = [
    ...macros.slice(0, 3).map((m) => ({ ...m, kind: 'M' })),
    ...earnings.slice(0, 2).map((e) => ({ ...e, kind: 'E' })),
  ].filter((ev) => daysUntil(ev.date) <= WINDOW_DAYS);
  return (
    <div className="fz-b fz-agenda">
      <div className="fz-title">AGENDA 14 J</div>
      {rows.map((row, i) => {
        if (row.empty) {
          return (
            <div className="fz-row fz-agenda__row" key={i}>
              <Chip tone="ink">E</Chip>
              <span className="fz-row__empty fz-agenda__empty">— sous {WINDOW_DAYS} j</span>
            </div>
          );
        }
        const d = daysUntil(row.date);
        const hot = d <= 2;
        return (
          <div className="fz-row fz-agenda__row" key={i}>
            <Chip tone="ink">{row.k}</Chip>
            <span className="fz-agenda__name" title={row.name}>{compactName(row.name)}</span>
            <span className="fz-agenda__date">{shortDate(row.date)}</span>
            <span className={`fz-agenda__eta${hot ? ' is-hot' : ''}`}>{etaLabel(d)}</span>
          </div>
        );
      })}
      <div className="fz-timeline">
        <div className="fz-timeline__track">
          {Array.from({ length: 15 }, (_, i) => (
            <span className="fz-timeline__tick" key={i} style={{ left: `${(i / 14) * 100}%` }} />
          ))}
          {dots.map((ev, i) => {
            const d = daysUntil(ev.date);
            const hot = d <= 2;
            const pct = Math.max(2, Math.min(98, (d / 14) * 100));
            return (
              <span
                key={i}
                className={`fz-timeline__dot fz-timeline__dot--${ev.kind}${hot ? ' is-hot' : ''}`}
                style={{ left: `${pct}%` }}
                title={`${ev.name} · ${etaLabel(d)}`}
              />
            );
          })}
        </div>
        <div className="fz-timeline__labels">
          {dots.map((ev, i) => {
            const d = daysUntil(ev.date);
            const pct = Math.max(8, Math.min(86, (d / 14) * 100));
            return (
              <span className="fz-timeline__label" key={i} style={{ left: `${pct}%` }}>
                {compactName(ev.name)}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══ L'ÉTAGE FUSION (un langage, calibré par variables) ═════════
function FusionDeck({ cal, quotes, intraday, rate, fxBadge, macros, earnings, d5, futServed }) {
  return (
    <section
      className="fz"
      style={{ '--fz-h': `${cal.height}px`, '--fz-price': `${cal.price}px`, '--fz-vix': `${cal.vix}px` }}
      aria-label={`Calibration ${cal.key}`}
    >
      <CommandBlock />
      <IndicesBlock quotes={quotes} intraday={intraday} futServed={futServed} cal={cal} />
      <VolBlock quotes={quotes} d5={d5} cal={cal} />
      <FxBlock quotes={quotes} rate={rate} fxBadge={fxBadge} />
      <WorldBlock quotes={quotes} />
      <AgendaBlock macros={macros} earnings={earnings} />
    </section>
  );
}

const CALS = [
  { key: 'F1', label: 'F1 · FUSION SERRÉE — courbes 28, un cran plus tabulaire', height: 240, curve: 28, price: 26, vix: 32, pill: 16 },
  { key: 'F2', label: 'F2 · FUSION ÉQUILIBRE — courbes 42', height: 256, curve: 42, price: 26, vix: 33, pill: 16 },
  { key: 'F3', label: 'F3 · FUSION VIVANTE — courbes 56 dominantes, VIX 36', height: 276, curve: 56, price: 28, vix: 36, pill: 18 },
];

// ═══ Page ═══════════════════════════════════════════════════════
export default function MarketLab() {
  const { quotes } = useMarketQuotes(STATIC_FETCH_SYMBOLS);
  useQuoteBatchExtras(STATIC_FETCH_SYMBOLS, FUTURES_SYMBOLS);
  // Série 7 j du tape (partagée) — sert le Δ5J VIX.
  const { sparklines: spark7d } = useMarketSparklines(STATIC_FETCH_SYMBOLS);
  // Série INTRADAY des 4 indices (1d/5m, sonde : 79 pts) — poller
  // partagé distinct, cadence 5 min, bucket chart 90/min.
  const { sparklines: intraday } = useMarketSparklines(US_SYMBOLS, '1d', '5m');
  const openPositions = useOpenPositions();
  const { rate, mode, source } = useFx();
  const [forceFut, setForceFut] = useState(false);

  const fxBadge =
    mode === 'manual' ? 'MANUEL' : String(source || '').startsWith('live') ? 'LIVE' : 'AUTO';

  const myTickers = useMemo(
    () => [...new Set((openPositions || []).map((p) => p.tk).filter(Boolean))],
    [openPositions]
  );
  const today = isoToday();
  const horizon = isoPlusDays(WINDOW_DAYS);
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

  // ─── Agenda enrichi (1.C.5 §3.3) : UNION Finnhub ∪ local, dédup,
  // tri → les 3 PROCHAINS macro (sans borne haute — le fichier local
  // garantit ainsi ≥3 rangées ; la timeline, elle, reste bornée 14 j).
  const agendaStats = useRef({ feed: 0, local: 0 });
  const farHorizon = isoPlusDays(60);
  const macros = useMemo(() => {
    const feed = (macro || [])
      .map((e) => ({ date: e.time || e.date, name: e.event }))
      .filter((e) => e.date && e.name && e.date >= today && e.date <= farHorizon);
    const local = macroEventsInRange(today, farHorizon).map((e) => ({
      date: e.time,
      name: e.event,
    }));
    const seen = new Set();
    const union = [...feed, ...local].filter((e) => {
      const k = `${e.date}|${compactName(e.name).toUpperCase()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    agendaStats.current = { feed: feed.length, local: local.length };
    return union.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  }, [macro, today, farHorizon]);

  const earningsItems = useMemo(() => {
    const rows = (earnings || [])
      .map((e) => ({ date: e.date || e.time, name: String(e.symbol || '').toUpperCase() }))
      .filter((e) => e.date && e.name && e.date >= today && e.date <= horizon);
    return rows.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 2);
  }, [earnings, today, horizon]);

  // Δ5j VIX (série 7 j partagée, marqué ~).
  const d5 = useMemo(() => {
    const p = spark7d['^VIX']?.prices;
    if (!p || p.length < 6) return null;
    const ref = p[p.length - 6];
    const last = p[p.length - 1];
    if (!Number.isFinite(ref) || !Number.isFinite(last) || ref === 0) return null;
    return ((last - ref) / ref) * 100;
  }, [spark7d]);

  // Sonde FUT sticky (verdict SERVIS ratifié 1.C.5 §3.2).
  const futLiveNow = FUTURES_SYMBOLS.every((s) => Number.isFinite(quotes[s]?.price));
  const futSeenRef = useRef(false);
  if (futLiveNow) futSeenRef.current = true;
  const futServed = futSeenRef.current || forceFut;

  // Sonde densité intraday (loi §2.5 : largeur max = pts × 6).
  const intradayPts = intraday['^SPX']?.prices?.length || 0;

  const common = {
    quotes,
    intraday,
    rate,
    fxBadge,
    macros,
    earnings: earningsItems,
    d5,
    futServed,
  };

  return (
    <div className="lm-page">
      <header className="lm-head">
        <h1 className="lm-title">LAB · MARKET III — FUSION, calibration finale (1.C.5)</h1>
        <p className="lm-sub">
          A = témoin. Puis UN langage (tuiles vivantes × organes × discipline tabulaire) en trois
          réglages : F1 serré · F2 équilibre · F3 courbes dominantes. Mêmes données vives partout.
        </p>
        <div className="lm-probes">
          <span className={`lm-probe${futServed ? ' is-ok' : ' is-ko'}`}>
            FUT : {futServed ? 'SERVIS (verdict ratifié, sticky)' : 'en attente du 1er train…'}
          </span>
          <span className={`lm-probe${intradayPts >= 20 ? ' is-ok' : ' is-ko'}`}>
            Intraday 1d/5m : {intradayPts ? `${intradayPts} pts (largeur max ${intradayPts * 6} px)` : 'en attente…'}
          </span>
          <span className={`lm-probe${d5 != null ? ' is-ok' : ' is-ko'}`}>
            Δ5j VIX : {d5 != null ? 'dérivable (~)' : 'indérivable — omis'}
          </span>
          <span className="lm-probe is-ok">
            Agenda : union {agendaStats.current.feed} Finnhub ∪ {agendaStats.current.local} local → {macros.length} macro + {earningsItems.length} earnings
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
        <div className="lm-variant__label">A · Témoin v2 (étage actuel, composant réel)</div>
        <div className="lm-witness">
          <MarketDeck />
        </div>
      </section>

      {CALS.map((cal) => (
        <section className="lm-variant" key={cal.key}>
          <div className="lm-variant__label">{cal.label}</div>
          <FusionDeck cal={cal} {...common} />
        </section>
      ))}
    </div>
  );
}
