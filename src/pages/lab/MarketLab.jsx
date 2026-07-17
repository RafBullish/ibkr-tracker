// ═══════════════════════════════════════════════════════════════
//  MARKET LAB IV — /lab/market (1.C.6) · DEV-ONLY, ÉPHÉMÈRE
//
//  LA FINALE : structure VERROUILLÉE par le blueprint Rafael
//  (17.07) — 5 blocs : SESSION (anatomie témoin + progression) ·
//  INDICES US (4 colonnes-tuiles BORNÉES + rangée FUT permanente) ·
//  PILIER VOL+FX · MONDE ×10 (zéro graphe) · AGENDA héros
//  (timeline MORTE → matrice de non-perte : l'info J-x vit dans
//  les chips des rangées).
//  Seul micro-axe ouvert : le corps des tuiles d'indices —
//  Ω1 LIGNE (courbe 48) vs Ω2 INSTRUMENT (courbe 38 + barre
//  d'amplitude du jour L—●—H). Tout le reste IDENTIQUE.
//
//  Lois de craft 1.C.5 §2 inchangées. Loi anti-vide DURCIE (1.C.6) :
//  la clause « surplus en fin de zone » est abrogée — tout vide
//  résiduel est bloquant ou signalé au STOP.
//  Données : pollers partagés (tape + extras FUT) · intraday 1d/5m
//  79 pts (ratifié) · agenda = 3 prochains macro (union ∪ local).
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

// ─── Décimales par classe (loi §2.4, étendue B4 : SILVER/COPPER/
// NATGAS 2 · ETH 0) ──────────────────────────────────────────────
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
function detailOf(name) {
  const s = String(name || '');
  const dash = s.split(' — ')[1];
  if (dash) return dash.split(' (')[0];
  const paren = s.match(/\(([^)]+)\)/);
  return paren ? paren[1] : null;
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
    idRef.current = `fngrad${gradSeq}`;
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
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ─── Barre d'amplitude du jour (Ω2) : L—●—H, organe 8 px ────────
function AmpBar({ low, high, price }) {
  const ok = Number.isFinite(low) && Number.isFinite(high) && Number.isFinite(price) && high > low;
  const pct = ok ? Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100)) : null;
  return (
    <div className="fn-amp" role="img" aria-label={ok ? `Prix à ${Math.round(pct)} % du range du jour` : 'Range indisponible'}>
      <span className="fn-amp__cap">L</span>
      <span className="fn-amp__track">
        {pct != null && <span className="fn-amp__cursor" style={{ left: `${pct}%` }} />}
      </span>
      <span className="fn-amp__cap">H</span>
    </div>
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

// ═══ B1 · SESSION — anatomie du témoin + progression de séance ══
function SessionBlock() {
  const now = useSessionNow();
  const { phase, targetKind, targetMs, phaseStartMs, nyLabel } = computeMarketPhase(now);
  const nowMs = now.getTime();
  const pct =
    phaseStartMs != null && targetMs != null && targetMs > phaseStartMs
      ? Math.max(0, Math.min(100, ((nowMs - phaseStartMs) / (targetMs - phaseStartMs)) * 100))
      : null;
  return (
    <div className="fn-b fn-session">
      <div className="fn-title">SESSION</div>
      <div className="fn-session__row">
        <span className={`fz-dot${phase === 'open' ? ' fz-dot--live' : ''}`} aria-hidden="true" />
        <span className="fn-session__phase">{PHASE_LABELS[phase]}</span>
      </div>
      <div className="fn-session__cdlabel">
        {targetKind === 'close' ? 'CLÔTURE DANS' : 'OUVERTURE DANS'}
      </div>
      <div className="fn-session__cd">{formatCountdown(targetMs != null ? targetMs - nowMs : null)}</div>
      {pct != null && (
        <div className="fn-progress" role="img" aria-label={`Séance écoulée à ${Math.round(pct)} %`}>
          <div className="fn-progress__track">
            <div className="fn-progress__fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="fn-progress__pct">{Math.round(pct)} %</span>
        </div>
      )}
      <div className="fn-session__ny">NEW YORK {nyLabel}</div>
    </div>
  );
}

// ═══ B2 · INDICES US — 4 colonnes-tuiles bornées + FUT ══════════
function IndexTile({ label, quote, spark, fin }) {
  return (
    <div className="fn-tile">
      <div className="fn-tile__head">
        <span className="fn-tile__sym">{label}</span>
        <Pastille pct={quote?.changePercent} size={16} />
      </div>
      <div className="fn-tile__pricerow">
        <span className="fn-tile__price">{fmtVal(quote?.price, 'index')}</span>
        <span className={`fz-delta fz-delta--15 fz-delta--${dirOf(quote?.change)}`}>
          {fmtNet(quote?.change, 'index')}
        </span>
      </div>
      <div className="fn-tile__body">
        <IntradaySpark prices={spark?.prices} height={fin.curve} />
        {fin.body === 'instrument' && (
          <AmpBar low={quote?.low} high={quote?.high} price={quote?.price} />
        )}
      </div>
      <div className="fn-tile__hl">
        H <b>{fmtVal(quote?.high, 'index')}</b> · L <b>{fmtVal(quote?.low, 'index')}</b>
      </div>
    </div>
  );
}

function IndicesBlock({ quotes, intraday, futServed, fin }) {
  return (
    <div className="fn-b fn-indices">
      <div className="fn-title">INDICES US</div>
      <div className="fn-tiles">
        {US.map(({ sym, label }) => (
          <IndexTile key={sym} label={label} quote={quotes[sym]} spark={intraday[sym]} fin={fin} />
        ))}
      </div>
      {/* Rangée FUT permanente — colonnes ALIGNÉES sous les tuiles
          (les hairlines continuent : zéro vide, structure tenue). */}
      <div className="fn-fut">
        <div className="fn-fut__cell fn-fut__cell--label">
          <span className="fn-fut__tag">FUT</span>
          <span className="fn-fut__sub">RANGE O/N</span>
        </div>
        {FUTURES.map(({ sym, label }) => {
          const q = quotes[sym];
          const range =
            futServed && Number.isFinite(q?.low) && Number.isFinite(q?.high)
              ? `${fmtVal(q.low, 'index')}–${fmtVal(q.high, 'index')}`
              : '—';
          return (
            <div className="fn-fut__cell" key={sym}>
              <div className="fn-fut__line">
                <span className="fn-fut__sym">{label}</span>
                <span className="fn-fut__val">{futServed ? fmtVal(q?.price, 'index') : '—'}</span>
                {futServed ? <DeltaText v={q?.changePercent} /> : <span className="fz-delta fz-delta--15 fz-delta--flat">—</span>}
              </div>
              <div className="fn-fut__range">{range}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══ B3 · PILIER VOL + FX ═══════════════════════════════════════
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

// Anatomie RATIFIÉE (1.C.5, reconduite §1) : graduations numériques
// 10/15/20/27/40 + chip de régime (les 4 noms à 11-12 px chevauchent
// dans ~212 px : fallback chip du blueprint).
function RegimeScale({ vix }) {
  if (!Number.isFinite(vix)) return null;
  const clamped = Math.max(10, Math.min(40, vix));
  const idx = regimeOf(clamped);
  const from = REGIME_GRADS[idx];
  const to = REGIME_GRADS[idx + 1];
  const pct = idx * 25 + ((clamped - from) / (to - from)) * 25;
  const hot = vix >= 20;
  return (
    <div className="fn-scale" aria-label={`Régime VIX : ${REGIMES[idx].label}`}>
      <div className="fn-scale__track">
        {REGIMES.map((r, i) => (
          <span className={`fn-scale__seg${i === idx ? ' is-active' : ''}`} key={r.label} title={r.label} />
        ))}
        <span className={`fn-scale__cursor${hot ? ' is-hot' : ''}`} style={{ left: `${pct}%` }} />
      </div>
      <div className="fn-scale__grads">
        {REGIME_GRADS.map((g, i) => (
          <span key={g} style={{ left: `${i * 25}%` }}>{g}</span>
        ))}
      </div>
    </div>
  );
}

function PilierBlock({ quotes, rate, fxBadge, d5 }) {
  const vix = quotes['^VIX'];
  const idx = regimeOf(vix?.price);
  const hot = idx != null && idx >= 2;
  return (
    <div className="fn-b fn-pilier">
      <div className="fn-title">VOLATILITÉ</div>
      <div className="fn-vol__hero">
        <span className="fn-vol__val">{fmtVal(vix?.price, 'vix')}</span>
        <Pastille pct={vix?.changePercent} size={18} />
        {idx != null && <Chip tone={hot ? 'amber' : 'ink'}>{REGIMES[idx].label}</Chip>}
      </div>
      <RegimeScale vix={vix?.price} />
      <div className="fn-vol__hl">
        H <b>{fmtVal(vix?.high, 'vix')}</b> · L <b>{fmtVal(vix?.low, 'vix')}</b>
        {d5 != null && (
          <>
            {' '}· Δ5J <b>~{d5 >= 0 ? '+' : '−'}{Math.abs(d5).toFixed(1)}%</b>
          </>
        )}
      </div>
      <div className="fn-pilier__divider" />
      <div className="fn-title fn-title--fx">
        FX &amp; TAUX <Chip tone="ink">{fxBadge}</Chip>
      </div>
      <div className="fn-fx__hero">
        <span className="fn-fx__herosym">USD/CHF</span>
        <span className="fn-fx__heroval">{Number.isFinite(rate) ? rate.toFixed(4) : '—'}</span>
      </div>
      <div className="fn-fx__applied">APPLIQUÉ AU PORTEFEUILLE</div>
      {[
        { label: 'EUR/USD', q: quotes['EURUSD=X'], cls: 'fx' },
        { label: 'US10Y', q: quotes['^TNX'], cls: 'rate' },
        { label: 'DXY', q: quotes['DX-Y.NYB'], cls: 'rate' },
      ].map(({ label, q, cls }) => (
        <div className="fn-row" key={label}>
          <span className="fn-row__sym">{label}</span>
          <span className="fn-row__val">{fmtVal(q?.price, cls)}</span>
          <DeltaText v={q?.changePercent} size={15} />
        </div>
      ))}
    </div>
  );
}

// ═══ B4 · MONDE ×10 (zéro graphe) ═══════════════════════════════
const WORLD_COLS = [
  {
    header: 'ACTIONS · CRYPTO',
    items: [
      { sym: '^GDAXI', label: 'DAX', cls: 'index' },
      { sym: '^FTSE', label: 'FTSE', cls: 'index' },
      { sym: '^N225', label: 'NIKKEI', cls: 'index' },
      { sym: 'BTC-USD', label: 'BTC', cls: 'btc' },
      { sym: 'ETH-USD', label: 'ETH', cls: 'btc' },
    ],
  },
  {
    header: 'MATIÈRES',
    items: [
      { sym: 'GC=F', label: 'GOLD', cls: 'cmdty' },
      { sym: 'SI=F', label: 'SILVER', cls: 'cmdty' },
      { sym: 'HG=F', label: 'COPPER', cls: 'cmdty' },
      { sym: 'CL=F', label: 'CRUDE', cls: 'cmdty' },
      { sym: 'NG=F', label: 'NATGAS', cls: 'cmdty' },
    ],
  },
];

function MondeBlock({ quotes }) {
  return (
    <div className="fn-b fn-monde">
      <div className="fn-title">MONDE</div>
      <div className="fn-monde__cols">
        {WORLD_COLS.map((col) => (
          <div className="fn-monde__col" key={col.header}>
            <div className="fn-microhead">{col.header}</div>
            {col.items.map(({ sym, label, cls }) => (
              <div className="fn-row" key={sym}>
                <span className="fn-row__sym">{label}</span>
                <span className="fn-row__val">{fmtVal(quotes[sym]?.price, cls)}</span>
                <DeltaText v={quotes[sym]?.changePercent} size={14} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ B5 · AGENDA — héros + rangées, SANS timeline ═══════════════
// Matrice de non-perte : la timeline horizontale (lab III) est MORTE
// (trou structurel : 3 événements / 27 j) ; l'information de distance
// survit intégralement dans les chips J-x de chaque rangée.
function AgendaBlock({ macros, earnings }) {
  const all = [
    ...macros.map((m) => ({ ...m, k: 'M' })),
    ...earnings.map((e) => ({ ...e, k: 'E', armed: true })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const hero = all[0] || null;
  const rest = all.slice(1, 4);
  const hasE = earnings.length > 0;
  const heroD = hero ? daysUntil(hero.date) : null;
  const heroHot = heroD != null && heroD <= 2;
  const heroDetail = hero ? detailOf(hero.name) : null;
  return (
    <div className="fn-b fn-agenda">
      <div className="fn-title">AGENDA</div>
      {hero ? (
        <div className="fn-hero">
          <div className="fn-hero__row">
            <Chip tone="ink">{hero.k}</Chip>
            <span className="fn-hero__name" title={hero.name}>{compactName(hero.name)}</span>
          </div>
          <div className="fn-hero__eta-row">
            <span className={`fn-hero__eta${heroHot ? ' is-hot' : ''}`}>{etaLabel(heroD)}</span>
            <span className="fn-hero__date">· {shortDate(hero.date)}</span>
            {hero.k === 'E' && heroHot && <Chip tone="amber">ARMED</Chip>}
          </div>
          {heroDetail && <div className="fn-hero__detail">{heroDetail}</div>}
        </div>
      ) : (
        <div className="fn-hero">
          <div className="fn-hero__detail">— aucun événement sous {WINDOW_DAYS} j</div>
        </div>
      )}
      <div className="fn-agenda__divider" />
      {rest.map((ev, i) => {
        const d = daysUntil(ev.date);
        const hot = d <= 2;
        return (
          <div className="fn-row fn-agenda__row" key={i}>
            <Chip tone="ink">{ev.k}</Chip>
            <span className="fn-agenda__name" title={ev.name}>{compactName(ev.name)}</span>
            <span className="fn-agenda__date">{shortDate(ev.date)}</span>
            <span className={`fn-agenda__eta${hot ? ' is-hot' : ''}`}>{etaLabel(d)}</span>
          </div>
        );
      })}
      {!hasE && (
        <div className="fn-row fn-agenda__row">
          <Chip tone="ink">E</Chip>
          <span className="fn-agenda__empty">— sous {WINDOW_DAYS} j</span>
        </div>
      )}
    </div>
  );
}

// ═══ L'ÉTAGE FINALE (structure verrouillée, finition par props) ══
function FinaleDeck({ fin, quotes, intraday, rate, fxBadge, macros, earnings, d5, futServed }) {
  return (
    <section className="fn" aria-label={`Finition ${fin.key}`}>
      <SessionBlock />
      <IndicesBlock quotes={quotes} intraday={intraday} futServed={futServed} fin={fin} />
      <PilierBlock quotes={quotes} rate={rate} fxBadge={fxBadge} d5={d5} />
      <MondeBlock quotes={quotes} />
      <AgendaBlock macros={macros} earnings={earnings} />
    </section>
  );
}

const FINS = [
  { key: 'Ω1', label: 'Ω1 · LIGNE — la vie par la courbe (48 px, rien d\'autre)', body: 'line', curve: 48 },
  { key: 'Ω2', label: 'Ω2 · INSTRUMENT — courbe 38 px + barre d\'amplitude du jour (L—●—H)', body: 'instrument', curve: 38 },
];

// ═══ Page ═══════════════════════════════════════════════════════
export default function MarketLab() {
  const { quotes } = useMarketQuotes(STATIC_FETCH_SYMBOLS);
  useQuoteBatchExtras(STATIC_FETCH_SYMBOLS, FUTURES_SYMBOLS);
  const { sparklines: spark7d } = useMarketSparklines(STATIC_FETCH_SYMBOLS);
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
  const farHorizon = isoPlusDays(60);
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

  // Agenda : UNION Finnhub ∪ local dédupliquée → 3 PROCHAINS macro
  // (ratifié — sans borne haute) ; earnings de positions sous 14 j.
  const agendaStats = useRef({ feed: 0, local: 0 });
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
    // 4 = héros + 3 rangées macro restantes (blueprint B5 : 3-4 rangées).
    return union.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  }, [macro, today, farHorizon]);

  const earningsItems = useMemo(() => {
    const rows = (earnings || [])
      .map((e) => ({ date: e.date || e.time, name: String(e.symbol || '').toUpperCase() }))
      .filter((e) => e.date && e.name && e.date >= today && e.date <= horizon);
    return rows.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 2);
  }, [earnings, today, horizon]);

  const d5 = useMemo(() => {
    const p = spark7d['^VIX']?.prices;
    if (!p || p.length < 6) return null;
    const ref = p[p.length - 6];
    const last = p[p.length - 1];
    if (!Number.isFinite(ref) || !Number.isFinite(last) || ref === 0) return null;
    return ((last - ref) / ref) * 100;
  }, [spark7d]);

  const futLiveNow = FUTURES_SYMBOLS.every((s) => Number.isFinite(quotes[s]?.price));
  const futSeenRef = useRef(false);
  if (futLiveNow) futSeenRef.current = true;
  const futServed = futSeenRef.current || forceFut;

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
        <h1 className="lm-title">LAB · MARKET IV — LA FINALE, deux finitions (1.C.6)</h1>
        <p className="lm-sub">
          A = témoin. Puis le dessin FINAL (blueprint Rafael 17.07) en deux finitions — seule
          différence : le corps des tuiles d'indices. Ω1 = courbe seule · Ω2 = courbe + jauge de
          range du jour.
        </p>
        <div className="lm-probes">
          <span className={`lm-probe${futServed ? ' is-ok' : ' is-ko'}`}>
            FUT : {futServed ? 'SERVIS (ratifié, permanent)' : 'en attente du 1er train…'}
          </span>
          <span className={`lm-probe${intradayPts >= 20 ? ' is-ok' : ' is-ko'}`}>
            Intraday 1d/5m : {intradayPts ? `${intradayPts} pts` : 'en attente…'}
          </span>
          <span className={`lm-probe${d5 != null ? ' is-ok' : ' is-ko'}`}>
            Δ5j VIX : {d5 != null ? 'dérivable (~)' : 'indérivable — omis'}
          </span>
          <span className="lm-probe is-ok">
            Agenda : {agendaStats.current.feed} Finnhub ∪ {agendaStats.current.local} local → {macros.length} macro (héros + rangées) + {earningsItems.length} earn · timeline MORTE → chips J-x
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

      {FINS.map((fin) => (
        <section className="lm-variant" key={fin.key}>
          <div className="lm-variant__label">{fin.label}</div>
          <FinaleDeck fin={fin} {...common} />
        </section>
      ))}
    </div>
  );
}
