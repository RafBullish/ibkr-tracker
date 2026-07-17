// ═══════════════════════════════════════════════════════════════
//  MARKET LAB VI — /lab/market (1.C.8) · DEV-ONLY, ÉPHÉMÈRE
//
//  « LES 4 DU PROPRIÉTAIRE » — quatre COMPOSITIONS pleine largeur
//  du MÊME langage (ADN du croquis validé, gelé — atomes .k-*).
//  LOI DE FLUIDITÉ (1.C.8, gravée) : l'étage épouse 100 % de la
//  largeur à toute largeur (grid fr+minmax, zéro px de largeur
//  totale en dur) ; l'excédent se dépense dans les organes
//  extensibles (courbes ≤ pts×6, échelle VIX, jauges, colonnes
//  +40 %), jamais en gap mort >32 px.
//
//    D1 · CROQUIS FLUIDE   — l'ordre validé, élastique
//    D2 · DOUBLE ÉTAGE     — deux rangées pleine largeur
//    D3 · MONITEUR         — 1 instrument = 1 rangée réglée + spark
//    D4 · HÉROS D'INDICES  — les grandes courbes dominent
//
//  Inventaire COMPLET identique dans les 4 (session, 4 indices,
//  FUT, VIX+échelle, FX & taux, MONDE ×10 Δ%+Δ$, agenda héros).
//  Données vives : flux existants uniquement, gardes C1 ratifiées.
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

const WORLD = [
  { sym: '^GDAXI', label: 'DAX', cls: 'index' },
  { sym: '^FTSE', label: 'FTSE', cls: 'index' },
  { sym: '^N225', label: 'NIKKEI', cls: 'index' },
  { sym: 'BTC-USD', label: 'BTC', cls: 'btc' },
  { sym: 'ETH-USD', label: 'ETH', cls: 'btc' },
  { sym: 'GC=F', label: 'GOLD', cls: 'cmdty', sep: true },
  { sym: 'SI=F', label: 'SILVER', cls: 'cmdty' },
  { sym: 'HG=F', label: 'COPPER', cls: 'cmdty' },
  { sym: 'CL=F', label: 'CRUDE', cls: 'cmdty' },
  { sym: 'NG=F', label: 'NATGAS', cls: 'cmdty' },
];

// ─── Formatage (décimales par classe, gardes ratifiées) ─────────
const CHF = new Intl.NumberFormat('de-CH');
const CHF2 = new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function validHL(v) {
  return Number.isFinite(v) && v > 0;
}
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
  if (cls === 'fx') return `${sign}${abs.toFixed(4)}`;
  return `${sign}${abs.toFixed(2)}`;
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

// ─── Atomes ADN (croquis, gelés) ────────────────────────────────
function Pill({ pct, size }) {
  if (pct == null || !Number.isFinite(pct)) {
    return <span className="k-pill k-pill--flat" style={{ fontSize: size }}>—</span>;
  }
  const dir = dirOf(pct);
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '';
  return (
    <span className={`k-pill k-pill--${dir}`} style={{ fontSize: size }}>
      {arrow ? `${arrow} ` : ''}{Math.abs(pct).toFixed(2)}%
    </span>
  );
}

function DeltaArrow({ pct, size = 13.5, signed = false }) {
  if (pct == null || !Number.isFinite(pct)) {
    return <span className="k-da k-da--flat" style={{ fontSize: size }}>—</span>;
  }
  if (pct === 0) {
    return <span className="k-da k-da--flat" style={{ fontSize: size }}>0.00%</span>;
  }
  const dir = dirOf(pct);
  const arrow = pct > 0 ? '▲' : '▼';
  const sign = signed ? (pct > 0 ? '+' : '−') : '';
  return (
    <span className={`k-da k-da--${dir}`} style={{ fontSize: size }}>
      {arrow} {sign}{Math.abs(pct).toFixed(2)}%
    </span>
  );
}

function KChip({ children }) {
  return <span className="k-chip">{children}</span>;
}

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
// Courbe FLUIDE : largeur 100 % du conteneur (cap ≤ pts×6 via
// max-width), stroke non-scalé, géométrie du croquis.
function KCurve({ prices, height, maxPts = 79 }) {
  const idRef = useRef(null);
  if (idRef.current == null) {
    gradSeq += 1;
    idRef.current = `kgrad${gradSeq}`;
  }
  const cap = (prices?.length || maxPts) * 6;
  if (!prices || prices.length < 2) {
    return <div className="k-curve--empty" style={{ height, maxWidth: cap }} />;
  }
  const W = 130;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const xs = prices.map((_, i) => 1 + (i / (prices.length - 1)) * (W - 2));
  const ys = prices.map((p) => height - 1 - ((p - min) / range) * (height - 4));
  const line = monotonePath(xs, ys);
  const area = `${line} L ${W - 1},${height} L 1,${height} Z`;
  const up = prices[prices.length - 1] >= prices[0];
  const color = up ? 'var(--pnl-up)' : 'var(--pnl-down)';
  return (
    <svg
      className="k-fluidcurve"
      style={{ height, maxWidth: cap }}
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={idRef.current} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.12" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${idRef.current})`} stroke="none" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Spark inline du MONITEUR (D3) — série 7 j (7 pts) cap 42 px.
function InlineSpark({ prices, width = 40, height = 16 }) {
  const idRef = useRef(null);
  if (idRef.current == null) {
    gradSeq += 1;
    idRef.current = `kgrad${gradSeq}`;
  }
  if (!prices || prices.length < 2) return <span className="k-ispark" style={{ width, height }} />;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const xs = prices.map((_, i) => 1 + (i / (prices.length - 1)) * (width - 2));
  const ys = prices.map((p) => height - 1 - ((p - min) / range) * (height - 3));
  const line = monotonePath(xs, ys);
  const up = prices[prices.length - 1] >= prices[0];
  const color = up ? 'var(--pnl-up)' : 'var(--pnl-down)';
  return (
    <svg className="k-ispark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={line} fill="none" stroke={color} strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Jauge d'amplitude FLUIDE (piste flex, curseur position %).
function Amp({ low, high, price, thick = 5 }) {
  const ok = Number.isFinite(low) && Number.isFinite(high) && Number.isFinite(price) && high > low;
  const pct = ok ? Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100)) : null;
  return (
    <div className="k-amp" role="img" aria-label={ok ? `Prix à ${Math.round(pct)} % du range` : 'Range indisponible'}>
      <span className="k-ampl">L</span>
      <span className="k-track" style={{ height: thick }}>
        {pct != null && <span className="k-cur" style={{ left: `${pct}%`, top: -2, height: thick + 4 }} />}
      </span>
      <span className="k-ampl">H</span>
    </div>
  );
}

// Largeur réelle d'un conteneur (ResizeObserver) — pour retracer
// l'échelle VIX à toute largeur sans étirer le texte.
function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// Échelle VIX LINÉAIRE du croquis, FLUIDE : x = pad + (v−10)/30 ×
// (largeur − 2×pad), marques 10/15/20/27/40.
const VIX_MARKS = [10, 15, 20, 27, 40];
function KScale({ vix }) {
  const [ref, w] = useWidth();
  const width = Math.max(120, Math.round(w));
  const pad = 4;
  const x = (v) => pad + ((Math.max(10, Math.min(40, v)) - 10) / 30) * (width - 2 * pad);
  const hot = Number.isFinite(vix) && vix >= 20;
  return (
    <div className="k-vscale" ref={ref}>
      {w > 0 && Number.isFinite(vix) && (
        <svg width={width} height="33" viewBox={`0 0 ${width} 33`} aria-label={`VIX ${vix.toFixed(2)} sur l'échelle 10–40`}>
          <rect x={pad} y="11" width={width - 2 * pad} height="7" rx="1" fill="rgba(255,255,255,.07)" />
          {VIX_MARKS.map((v) => (
            <g key={v}>
              <line x1={x(v)} y1="8" x2={x(v)} y2="20" stroke="rgba(255,255,255,.12)" strokeWidth="1" />
              <text x={x(v)} y="31" fill="var(--ink-mute)" fontSize="10.5" textAnchor={v === 10 ? 'start' : v === 40 ? 'end' : 'middle'} fontFamily="var(--qc-font-num)">
                {v}
              </text>
            </g>
          ))}
          <path d={`M${x(vix).toFixed(1)},9 l-5,-7 l10,0 Z`} fill={hot ? 'var(--accent)' : 'var(--ink-pure)'} />
        </svg>
      )}
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

function useSession() {
  const now = useSessionNow();
  const { phase, targetKind, targetMs, phaseStartMs, nyLabel } = computeMarketPhase(now);
  const nowMs = now.getTime();
  const pct =
    phaseStartMs != null && targetMs != null && targetMs > phaseStartMs
      ? Math.max(0, Math.min(100, ((nowMs - phaseStartMs) / (targetMs - phaseStartMs)) * 100))
      : null;
  return {
    phase,
    label: PHASE_LABELS[phase],
    cdLabel: targetKind === 'close' ? 'CLÔTURE DANS' : 'OUVERTURE DANS',
    countdown: formatCountdown(targetMs != null ? targetMs - nowMs : null),
    pct,
    nyLabel,
  };
}

// ─── Pièces partagées (ADN B1 du croquis) ───────────────────────
function SessionRail() {
  const s = useSession();
  return (
    <>
      <div className="k-ztitle">SESSION</div>
      <div className="k-sesrow">
        <span className={`k-sdot${s.phase === 'open' ? ' is-live' : ''}`} aria-hidden="true" />
        <span className="k-sstate">{s.label}</span>
      </div>
      <div className="k-slbl">{s.cdLabel}</div>
      <div className="k-scd">{s.countdown}</div>
      <div className="k-sbar">
        {s.pct != null && <span className="k-sfill" style={{ width: `${s.pct}%` }} />}
      </div>
      <div className="k-spct">
        {s.pct != null && <><span className="k-spct__n">{Math.round(s.pct)} %</span> · </>}
        NEW YORK <span className="k-spct__n">{s.nyLabel}</span>
      </div>
    </>
  );
}

function agendaModel(macros, earnings) {
  const all = [
    ...macros.map((m) => ({ ...m, k: 'M' })),
    ...earnings.map((e) => ({ ...e, k: 'E' })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return { hero: all[0] || null, rest: all.slice(1, 4), hasE: earnings.length > 0 };
}

function ProchainList({ macros, earnings }) {
  const { hero, rest, hasE } = agendaModel(macros, earnings);
  const heroD = hero ? daysUntil(hero.date) : null;
  const heroHot = heroD != null && heroD <= 2;
  const heroDetail = hero ? detailOf(hero.name) : null;
  return (
    <>
      <div className="k-ztitle">PROCHAIN</div>
      {hero ? (
        <>
          <div className="k-ahero">
            <span className="k-am">{hero.k}</span>
            <span className="k-ahname" title={hero.name}>{compactName(hero.name)}</span>
            <span className={`k-ahj${heroHot ? ' is-hot' : ''}`}>{etaLabel(heroD)}</span>
          </div>
          <div className="k-ahsub">
            {heroDetail ? <>{heroDetail} · </> : null}
            <span className="k-num">{shortDate(hero.date)}</span>
          </div>
        </>
      ) : (
        <div className="k-ahsub" style={{ marginLeft: 0 }}>— aucun événement</div>
      )}
      {rest.map((ev, i) => {
        const d = daysUntil(ev.date);
        const hot = d <= 2;
        return (
          <div className="k-agrow" key={i}>
            <span className="k-am">{ev.k}</span>
            <span className="k-aname" title={ev.name}>{compactName(ev.name)}</span>
            <span className="k-adate">{shortDate(ev.date)}</span>
            <span className={`k-aj${hot ? ' is-hot' : ''}`}>{etaLabel(d)}</span>
          </div>
        );
      })}
      {!hasE && (
        <div className="k-agrow">
          <span className="k-am k-am--empty">E</span>
          <span className="k-aempty">— sous {WINDOW_DAYS} j</span>
        </div>
      )}
    </>
  );
}

function Tile({ label, quote, spark, px, curve, ampThick = 5, inlineDd = false }) {
  return (
    <div className="k-tile2">
      <div className="k-trow">
        <span className="k-tisym">{label}</span>
        <Pill pct={quote?.changePercent} size={14} />
      </div>
      {inlineDd ? (
        <div className="k-tipxrow">
          <span className="k-tipx" style={{ fontSize: px, display: 'inline' }}>{fmtVal(quote?.price, 'index')}</span>
          <span className={`k-tidd k-da--${dirOf(quote?.change)}`} style={{ display: 'inline', marginLeft: 6 }}>
            {fmtNet(quote?.change, 'index')}
          </span>
        </div>
      ) : (
        <>
          <span className="k-tipx" style={{ fontSize: px }}>{fmtVal(quote?.price, 'index')}</span>
          <span className={`k-tidd k-da--${dirOf(quote?.change)}`}>{fmtNet(quote?.change, 'index')}</span>
        </>
      )}
      <div className="k-ticurve">
        <KCurve prices={spark?.prices} height={curve} />
      </div>
      <Amp
        low={validHL(quote?.low) ? quote.low : null}
        high={validHL(quote?.high) ? quote.high : null}
        price={quote?.price}
        thick={ampThick}
      />
      <span className="k-tihl">
        H {validHL(quote?.high) ? fmtVal(quote.high, 'index') : '—'} · L{' '}
        {validHL(quote?.low) ? fmtVal(quote.low, 'index') : '—'}
      </span>
    </div>
  );
}

function futModel(quotes, futServed) {
  return FUTURES.map(({ sym, label }) => {
    const q = quotes[sym];
    return {
      label,
      val: futServed ? fmtVal(q?.price, 'index') : '—',
      pct: futServed ? q?.changePercent : null,
      range:
        futServed && validHL(q?.low) && validHL(q?.high)
          ? `${fmtVal(q.low, 'index')}–${fmtVal(q.high, 'index')}`
          : '—',
    };
  });
}

function FutInline({ quotes, futServed }) {
  return (
    <div className="k-futrow">
      <span className="k-futlbl">FUT · O/N</span>
      {futModel(quotes, futServed).map((f) => (
        <span className="k-futg" key={f.label}>
          <span className="k-fsym">{f.label}</span>
          <span className="k-fval" style={{ fontSize: 14 }}>{f.val}</span>
          <DeltaArrow pct={f.pct} size={12.5} />
          <span className="k-frng">{f.range}</span>
        </span>
      ))}
    </div>
  );
}

function VolCore({ quotes, d5, vixSize = 30 }) {
  const vix = quotes['^VIX'];
  const v = vix?.price;
  const regime = !Number.isFinite(v) ? null : v < 15 ? 'CALME' : v < 20 ? 'NORMAL' : v < 27 ? 'NERVEUX' : 'STRESS';
  return (
    <>
      <div className="k-ztitle">VOLATILITÉ</div>
      <div className="k-vrow">
        <span className="k-vval" style={{ fontSize: vixSize }}>{fmtVal(v, 'vix')}</span>
        <Pill pct={vix?.changePercent} size={15} />
        {regime && <KChip>{regime}</KChip>}
      </div>
      <KScale vix={v} />
      <div className="k-vhl">
        H {fmtVal(vix?.high, 'vix')} · L {fmtVal(vix?.low, 'vix')}
        {d5 != null && <> · Δ5J ~{d5 >= 0 ? '+' : '−'}{Math.abs(d5).toFixed(1)}%</>}
      </div>
    </>
  );
}

function FxRows({ quotes }) {
  return [
    { label: 'EUR/USD', q: quotes['EURUSD=X'], cls: 'fx' },
    { label: 'US10Y', q: quotes['^TNX'], cls: 'rate' },
    { label: 'DXY', q: quotes['DX-Y.NYB'], cls: 'rate' },
  ];
}

function FxCore({ quotes, rate, fxBadge }) {
  return (
    <>
      <div className="k-ztitle">FX &amp; TAUX</div>
      <div className="k-fxhero">
        <span className="k-fxsym2">USD/CHF</span>
        <span className="k-fxval" style={{ fontSize: 23 }}>
          {Number.isFinite(rate) ? rate.toFixed(4) : '—'}
        </span>
        <KChip>{fxBadge}</KChip>
      </div>
      <div className="k-fxap">APPLIQUÉ AU PORTEFEUILLE</div>
      {FxRows({ quotes }).map(({ label, q, cls }) => (
        <div className="k-fxr" key={label} style={{ height: 24, lineHeight: '24px' }}>
          <span className="k-fxsym">{label}</span>
          <span className="k-fxv">{fmtVal(q?.price, cls)}</span>
          <DeltaArrow pct={q?.changePercent} size={13.5} signed />
        </div>
      ))}
    </>
  );
}

// Table MONDE 10×4 (Δ% + Δ$) — colonnes du croquis, respirantes.
function MondeTable({ quotes, breathe = false }) {
  return (
    <>
      {WORLD.map(({ sym, label, cls, sep }) => {
        const q = quotes[sym];
        return (
          <div className={`k-mr2${sep ? ' k-mrh' : ''}${breathe ? ' k-mr2--breathe' : ''}`} key={sym}>
            <span className="k-msym">{label}</span>
            <span className="k-mv2">{fmtVal(q?.price, cls)}</span>
            <span className="k-mpct"><DeltaArrow pct={q?.changePercent} size={13.5} /></span>
            <span className={`k-mdd k-da--${dirOf(q?.change)}`}>{fmtNet(q?.change, cls)}</span>
          </div>
        );
      })}
    </>
  );
}

// ═══ D1 · CROQUIS FLUIDE ════════════════════════════════════════
function D1({ quotes, intraday, rate, fxBadge, macros, earnings, d5, futServed }) {
  return (
    <section className="k-fluid d1" aria-label="D1 Croquis fluide">
      <div className="k-b">
        <SessionRail />
        <div className="k-hr" style={{ margin: '6px 0 5px' }} />
        <ProchainList macros={macros} earnings={earnings} />
      </div>
      <div className="k-b k-b--emph">
        <div className="k-ztitle">INDICES US</div>
        <div className="d1-tiles">
          {US.map(({ sym, label }) => (
            <Tile key={sym} label={label} quote={quotes[sym]} spark={intraday[sym]} px={28} curve={50} />
          ))}
        </div>
        <div className="k-hr" style={{ margin: '7px 0 6px' }} />
        <FutInline quotes={quotes} futServed={futServed} />
      </div>
      <div className="k-b k-b--emph">
        <VolCore quotes={quotes} d5={d5} />
        <div className="k-hr" style={{ margin: '6px 0 5px' }} />
        <FxCore quotes={quotes} rate={rate} fxBadge={fxBadge} />
      </div>
      <div className="k-b k-b--emph">
        <div className="k-ztitle">
          MONDE <span className="k-zsub">ACTIONS · CRYPTO · MATIÈRES</span>
        </div>
        <MondeTable quotes={quotes} breathe />
      </div>
    </section>
  );
}

// ═══ D2 · DOUBLE ÉTAGE ══════════════════════════════════════════
function D2({ quotes, intraday, rate, fxBadge, macros, earnings, d5, futServed }) {
  const s = useSession();
  const { hero, rest, hasE } = agendaModel(macros, earnings);
  const heroD = hero ? daysUntil(hero.date) : null;
  const heroHot = heroD != null && heroD <= 2;
  return (
    <section className="k-fluid d2" aria-label="D2 Double étage">
      <div className="d2-r1">
        <div className="k-b">
          <div className="k-ztitle">SESSION</div>
          <div className="k-sesrow">
            <span className={`k-sdot${s.phase === 'open' ? ' is-live' : ''}`} aria-hidden="true" />
            <span className="k-sstate">{s.label}</span>
          </div>
          <div className="k-slbl">{s.cdLabel}</div>
          <div className="k-scd" style={{ fontSize: 30 }}>{s.countdown}</div>
          <div className="d2-sesline">
            <span className="k-sbar" style={{ width: 'auto', flex: 1 }}>
              {s.pct != null && <span className="k-sfill" style={{ width: `${s.pct}%` }} />}
            </span>
            <span className="k-spct" style={{ whiteSpace: 'nowrap' }}>
              {s.pct != null && <><span className="k-spct__n">{Math.round(s.pct)} %</span> · </>}
              NY <span className="k-spct__n">{s.nyLabel}</span>
            </span>
          </div>
        </div>
        <div className="k-b k-b--emph d2-indices">
          <div className="d2-tiles">
            {US.map(({ sym, label }) => (
              <Tile key={sym} label={label} quote={quotes[sym]} spark={intraday[sym]} px={26} curve={56} inlineDd />
            ))}
          </div>
        </div>
        <div className="k-b k-b--emph">
          <VolCore quotes={quotes} d5={d5} />
        </div>
      </div>
      <div className="k-hr" />
      <div className="d2-r2">
        <div className="k-b">
          <div className="k-ztitle">FUT · O/N</div>
          {futModel(quotes, futServed).map((f) => (
            <div className="d2-futr" key={f.label}>
              <span className="k-fsym">{f.label}</span>
              <span className="k-fval" style={{ fontSize: 15 }}>{f.val}</span>
              <DeltaArrow pct={f.pct} size={13} />
              <span className="k-frng">{f.range}</span>
            </div>
          ))}
        </div>
        <div className="k-b k-b--emph">
          <div className="k-ztitle">FX &amp; TAUX</div>
          <div className="k-fxhero">
            <span className="k-fxsym2">USD/CHF</span>
            <span className="k-fxval" style={{ fontSize: 23 }}>
              {Number.isFinite(rate) ? rate.toFixed(4) : '—'}
            </span>
            <KChip>{fxBadge}</KChip>
            <span className="k-fxap" style={{ display: 'inline', margin: '0 0 0 8px' }}>APPLIQUÉ</span>
          </div>
          <div className="d2-fxline">
            {FxRows({ quotes }).map(({ label, q, cls }) => (
              <span className="d2-fxcell" key={label}>
                <span className="k-fxsym" style={{ width: 'auto', marginRight: 5 }}>{label}</span>
                <span className="k-fxv" style={{ width: 'auto', marginRight: 5 }}>{fmtVal(q?.price, cls)}</span>
                <DeltaArrow pct={q?.changePercent} size={13} signed />
              </span>
            ))}
          </div>
        </div>
        <div className="k-b k-b--emph">
          <div className="k-ztitle">
            MONDE <span className="k-zsub">ACTIONS · CRYPTO · MATIÈRES</span>
          </div>
          <div className="d2-world">
            {WORLD.map(({ sym, label, cls }) => {
              const q = quotes[sym];
              return (
                <span className="d2-wcell" key={sym}>
                  <span className="d2-wtop">
                    <span className="k-msym" style={{ width: 'auto', marginRight: 5 }}>{label}</span>
                    <span className="k-mv2" style={{ textAlign: 'left' }}>{fmtVal(q?.price, cls)}</span>
                  </span>
                  <span className="d2-wbot">
                    <DeltaArrow pct={q?.changePercent} size={12} />
                    <span className={`k-da k-da--${dirOf(q?.change)}`} style={{ fontSize: 11.5, opacity: 0.85, marginLeft: 5 }}>
                      {fmtNet(q?.change, cls)}
                    </span>
                  </span>
                </span>
              );
            })}
          </div>
        </div>
        <div className="k-b k-b--emph">
          <div className="k-ztitle">AGENDA</div>
          {hero && (
            <div className="k-ahero" style={{ marginTop: 0 }}>
              <span className="k-am">{hero.k}</span>
              <span className="k-ahname" title={hero.name}>{compactName(hero.name)}</span>
              <span className={`k-ahj${heroHot ? ' is-hot' : ''}`}>{etaLabel(heroD)}</span>
              <span className="k-adate" style={{ width: 'auto', marginLeft: 8 }}>{shortDate(hero.date)}</span>
            </div>
          )}
          <div className="d2-agline">
            {rest.map((ev, i) => {
              const d = daysUntil(ev.date);
              return (
                <span className="d2-agcell" key={i} title={ev.name}>
                  <span className="k-aname" style={{ width: 'auto', marginRight: 4 }}>{compactName(ev.name)}</span>
                  <span className="k-adate" style={{ width: 'auto', marginRight: 4 }}>{shortDate(ev.date)}</span>
                  <span className={`k-aj${d <= 2 ? ' is-hot' : ''}`}>{etaLabel(d)}</span>
                </span>
              );
            })}
          </div>
          <div className="k-agrow">
            {hasE ? null : (
              <>
                <span className="k-am k-am--empty">E</span>
                <span className="k-aempty">— sous {WINDOW_DAYS} j</span>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══ D3 · MONITEUR ══════════════════════════════════════════════
function MonitorRow({ label, quote, cls, spark, sparkW, hl }) {
  return (
    <div className="d3-row">
      <span className="k-msym d3-sym">{label}</span>
      <span className="d3-val">{fmtVal(quote?.price, cls)}</span>
      <span className="d3-pct"><DeltaArrow pct={quote?.changePercent} size={13} /></span>
      <span className={`k-da k-da--${dirOf(quote?.change)} d3-dd`}>{fmtNet(quote?.change, cls)}</span>
      <span className="d3-spark">
        {spark ? <InlineSpark prices={spark} width={sparkW} /> : null}
      </span>
      <span className="d3-hl">{hl}</span>
    </div>
  );
}

function D3({ quotes, intraday, spark7d, rate, fxBadge, macros, earnings, d5, futServed }) {
  const fut = futModel(quotes, futServed);
  return (
    <section className="k-fluid d3" aria-label="D3 Moniteur">
      <div className="k-b">
        <SessionRail />
        <div className="k-hr" style={{ margin: '6px 0 5px' }} />
        <ProchainList macros={macros} earnings={earnings} />
      </div>
      <div className="k-b k-b--emph d3-b--usfut">
        <div className="k-ztitle">US &amp; FUT</div>
        {US.map(({ sym, label }) => {
          const q = quotes[sym];
          const hl =
            validHL(q?.high) && validHL(q?.low)
              ? `H ${fmtVal(q.high, 'index')} · L ${fmtVal(q.low, 'index')}`
              : 'H — · L —';
          return (
            <MonitorRow
              key={sym}
              label={label}
              quote={q}
              cls="index"
              spark={intraday[sym]?.prices}
              sparkW={64}
              hl={hl}
            />
          );
        })}
        <div className="k-hr" style={{ margin: '4px 0 3px' }} />
        {fut.map((f, i) => (
          <div className="d3-row" key={f.label}>
            <span className="k-msym d3-sym">{f.label}</span>
            <span className="d3-val">{f.val}</span>
            <span className="d3-pct"><DeltaArrow pct={f.pct} size={13} /></span>
            <span className="d3-dd k-da k-da--flat" style={{ fontSize: 11 }}>{i === 0 ? 'O/N' : ''}</span>
            <span className="d3-spark" />
            <span className="d3-hl">{f.range}</span>
          </div>
        ))}
      </div>
      <div className="k-b k-b--emph">
        <div className="k-ztitle">
          MONDE <span className="k-zsub">ACTIONS · CRYPTO · MATIÈRES</span>
        </div>
        {WORLD.map(({ sym, label, cls, sep }) => (
          <div key={sym} className={sep ? 'k-mrh' : undefined} style={sep ? { marginTop: 2 } : undefined}>
            <MonitorRow
              label={label}
              quote={quotes[sym]}
              cls={cls}
              spark={spark7d[sym]?.prices}
              sparkW={40}
              hl=""
            />
          </div>
        ))}
      </div>
      <div className="k-b k-b--emph">
        <VolCore quotes={quotes} d5={d5} />
        <div className="k-hr" style={{ margin: '6px 0 5px' }} />
        <FxCore quotes={quotes} rate={rate} fxBadge={fxBadge} />
      </div>
    </section>
  );
}

// ═══ D4 · HÉROS D'INDICES ═══════════════════════════════════════
function D4({ quotes, intraday, rate, fxBadge, macros, earnings, d5, futServed }) {
  return (
    <section className="k-fluid d4" aria-label="D4 Héros d'indices">
      <div className="k-b">
        <SessionRail />
        <div className="k-hr" style={{ margin: '6px 0 5px' }} />
        <ProchainList macros={macros} earnings={earnings} />
      </div>
      <div className="k-b k-b--emph">
        <div className="k-ztitle">INDICES US</div>
        <div className="d4-tiles">
          {US.map(({ sym, label }) => (
            <Tile key={sym} label={label} quote={quotes[sym]} spark={intraday[sym]} px={30} curve={64} ampThick={8} />
          ))}
        </div>
        <div className="k-hr" style={{ margin: '6px 0 5px' }} />
        <FutInline quotes={quotes} futServed={futServed} />
      </div>
      <div className="k-b k-b--emph">
        <VolCore quotes={quotes} d5={d5} />
        <div className="k-hr" style={{ margin: '6px 0 5px' }} />
        <FxCore quotes={quotes} rate={rate} fxBadge={fxBadge} />
      </div>
      <div className="k-b k-b--emph">
        <div className="k-ztitle">
          MONDE <span className="k-zsub">ACTIONS · CRYPTO · MATIÈRES</span>
        </div>
        <MondeTable quotes={quotes} breathe />
      </div>
    </section>
  );
}

// ═══ Page ═══════════════════════════════════════════════════════
const VARIANTS = [
  { key: 'D1', label: 'D1 · CROQUIS FLUIDE — l\'ordre validé, élastique', C: D1 },
  { key: 'D2', label: 'D2 · DOUBLE ÉTAGE — deux rangées pleine largeur', C: D2 },
  { key: 'D3', label: 'D3 · MONITEUR — un instrument = une rangée réglée', C: D3 },
  { key: 'D4', label: 'D4 · HÉROS D\'INDICES — les grandes courbes dominent', C: D4 },
];

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
    spark7d,
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
        <h1 className="lm-title">LAB · MARKET VI — les 4 du propriétaire, pleine largeur (1.C.8)</h1>
        <p className="lm-sub">
          A = témoin. Puis QUATRE compositions du langage validé (ADN croquis gelé), toutes FLUIDES
          bord à bord, inventaire complet identique. Seule la composition change.
        </p>
        <div className="lm-probes">
          <span className={`lm-probe${futServed ? ' is-ok' : ' is-ko'}`}>
            FUT : {futServed ? 'SERVIS (ratifié, permanent)' : 'en attente du 1er train…'}
          </span>
          <span className={`lm-probe${intradayPts >= 20 ? ' is-ok' : ' is-ko'}`}>
            Intraday 1d/5m : {intradayPts ? `${intradayPts} pts (cap courbe ${intradayPts * 6} px)` : 'en attente…'}
          </span>
          <span className={`lm-probe${d5 != null ? ' is-ok' : ' is-ko'}`}>
            Δ5j VIX : {d5 != null ? 'dérivable (~)' : 'indérivable — omis'}
          </span>
          <span className="lm-probe is-ok">
            Agenda : {agendaStats.current.feed} Finnhub ∪ {agendaStats.current.local} local → héros + {Math.max(0, macros.length - 1)} macro + {earningsItems.length} earn
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

      {VARIANTS.map(({ key, label, C }) => (
        <section className="lm-variant" key={key}>
          <div className="lm-variant__label">{label}</div>
          <C {...common} />
        </section>
      ))}
    </div>
  );
}
