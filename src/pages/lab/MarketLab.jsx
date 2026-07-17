// ═══════════════════════════════════════════════════════════════
//  MARKET LAB V — /lab/market (1.C.7) · DEV-ONLY, ÉPHÉMÈRE
//
//  REPRODUCTION AU PIXEL du croquis architecte validé par Rafael
//  (docs/croquis/croquis-market-etage.html — LA vérité anatomique).
//  Interdiction de réinterpréter. Deux calibrations :
//    C1 · CROQUIS (262 px, tailles du fichier)
//    C2 · CROQUIS AMPLIFIÉ (286 px, mêmes largeurs, un cran de force)
//  Données vives via les flux existants (mapping 1.C.7 §3).
//
//  Classes .k-* calquées 1:1 sur les classes du croquis (sstate,
//  scd, sbar, ahero, tile/vsep, amp, futg, vscale, fxr, mr…) pour
//  une boucle de fidélité diffable. Couleurs → tokens canoniques
//  (#EF4444→--pnl-down · #10B981→--pnl-up · #8A8A92→--ink-mute ·
//  #9A9AA2→--ink-soft · #FAFAFA→--ink-pure · #FFA028→--accent).
//  Écarts tolérés : longueurs de chiffres réels uniquement.
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

// MONDE ×10 — table unique du croquis (5 actions·crypto ‖ 5 matières).
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

// ─── Décimales par classe (loi, croquis conforme) ───────────────
const CHF = new Intl.NumberFormat('de-CH');
const CHF2 = new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// H/L à 0 = non servi (indices avant l'ouverture) — jamais « 0 ».
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

// ─── Atomes du croquis ──────────────────────────────────────────
// Pastille (pill) : mix 16 %, radius 4, PlexC 700, flèche + espace.
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

// Δ% texte coloré avec flèche (croquis : signé en FX, non signé en
// MONDE/FUT ; 0.00 % = NEUTRE mute SANS flèche).
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

// Chip reverse-video (croquis .chip : Plex 700, ls .06, radius 2).
function KChip({ children }) {
  return <span className="k-chip">{children}</span>;
}

// ─── Courbe intraday 79 pts — monotone, aire 12 %→0, stroke 1.5 ─
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
// Géométrie du croquis : x de 1 à 129, y de 3 à H−1, marge basse à H.
function KCurve({ prices, height }) {
  const idRef = useRef(null);
  if (idRef.current == null) {
    gradSeq += 1;
    idRef.current = `kgrad${gradSeq}`;
  }
  const W = 130;
  if (!prices || prices.length < 2) {
    return <div className="k-curve--empty" style={{ width: W, height }} />;
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const xs = prices.map((_, i) => 1 + (i / (prices.length - 1)) * 128);
  const ys = prices.map((p) => height - 1 - ((p - min) / range) * (height - 4));
  const line = monotonePath(xs, ys);
  const area = `${line} L 129,${height} L 1,${height} Z`;
  const up = prices[prices.length - 1] >= prices[0];
  const color = up ? 'var(--pnl-up)' : 'var(--pnl-down)';
  return (
    <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={idRef.current} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.12" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${idRef.current})`} stroke="none" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Jauge d'amplitude du croquis : L [track 94×5, cur 2×9] H.
function Amp({ low, high, price }) {
  const ok = Number.isFinite(low) && Number.isFinite(high) && Number.isFinite(price) && high > low;
  const pct = ok ? Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100)) : null;
  return (
    <div className="k-amp" role="img" aria-label={ok ? `Prix à ${Math.round(pct)} % du range` : 'Range indisponible'}>
      <span className="k-ampl">L</span>
      <span className="k-track">{pct != null && <span className="k-cur" style={{ left: `${pct}%` }} />}</span>
      <span className="k-ampl">H</span>
    </div>
  );
}

// Échelle VIX du croquis : SVG 188×33, LINÉAIRE x = 4 + (v−10)×6,
// marques 10/15/20/27/40, curseur triangle ink (--accent si ≥20).
const VIX_TICKS = [[4, '10'], [34, '15'], [64, '20'], [106, '27'], [184, '40']];
function KScale({ vix }) {
  if (!Number.isFinite(vix)) return null;
  const x = Math.max(4, Math.min(184, 4 + (vix - 10) * 6));
  const hot = vix >= 20;
  return (
    <div className="k-vscale">
      <svg width="188" height="33" viewBox="0 0 188 33" aria-label={`VIX ${vix.toFixed(2)} sur l'échelle 10–40`}>
        <rect x="4" y="11" width="180" height="7" rx="1" fill="rgba(255,255,255,.07)" />
        {VIX_TICKS.map(([tx, label]) => (
          <g key={label}>
            <line x1={tx} y1="8" x2={tx} y2="20" stroke="rgba(255,255,255,.12)" strokeWidth="1" />
            <text x={tx} y="31" fill="var(--ink-mute)" fontSize="10.5" textAnchor="middle" fontFamily="var(--qc-font-num)">
              {label}
            </text>
          </g>
        ))}
        <path d={`M${x.toFixed(1)},9 l-5,-7 l10,0 Z`} fill={hot ? 'var(--accent)' : 'var(--ink-pure)'} />
      </svg>
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

// ═══ B1 · COMMANDEMENT (206) — session + agenda du croquis ══════
function KSession({ macros, earnings }) {
  const now = useSessionNow();
  const { phase, targetKind, targetMs, phaseStartMs, nyLabel } = computeMarketPhase(now);
  const nowMs = now.getTime();
  const pct =
    phaseStartMs != null && targetMs != null && targetMs > phaseStartMs
      ? Math.max(0, Math.min(100, ((nowMs - phaseStartMs) / (targetMs - phaseStartMs)) * 100))
      : null;

  const all = [
    ...macros.map((m) => ({ ...m, k: 'M' })),
    ...earnings.map((e) => ({ ...e, k: 'E' })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const hero = all[0] || null;
  const rest = all.slice(1, 4);
  const hasE = earnings.length > 0;
  const heroD = hero ? daysUntil(hero.date) : null;
  const heroHot = heroD != null && heroD <= 2;
  const heroDetail = hero ? detailOf(hero.name) : null;

  return (
    <div className="k-blk" style={{ width: 206 }}>
      <div className="k-ztitle">SESSION</div>
      <div className="k-sesrow">
        <span className={`k-sdot${phase === 'open' ? ' is-live' : ''}`} aria-hidden="true" />
        <span className="k-sstate">{PHASE_LABELS[phase]}</span>
      </div>
      <div className="k-slbl">{targetKind === 'close' ? 'CLÔTURE DANS' : 'OUVERTURE DANS'}</div>
      <div className="k-scd">{formatCountdown(targetMs != null ? targetMs - nowMs : null)}</div>
      <div className="k-sbar">
        {pct != null && <span className="k-sfill" style={{ width: `${pct}%` }} />}
      </div>
      <div className="k-spct">
        {pct != null && <><span className="k-spct__n">{Math.round(pct)} %</span> · </>}
        NEW YORK <span className="k-spct__n">{nyLabel}</span>
      </div>
      <div className="k-hr" style={{ margin: '6px 0 5px' }} />
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
    </div>
  );
}

// ═══ B2 · INDICES US (622) — 4 tuiles 130 + vseps 24 + FUT ══════
function KTile({ label, quote, spark, cal }) {
  return (
    <span className="k-tile" style={{ width: 130 }}>
      <span className="k-trow">
        <span className="k-tisym">{label}</span>
        <Pill pct={quote?.changePercent} size={cal.pillT} />
      </span>
      <span className="k-tipx" style={{ fontSize: cal.px }}>{fmtVal(quote?.price, 'index')}</span>
      <span className={`k-tidd k-da--${dirOf(quote?.change)}`} style={{ fontSize: cal.dd }}>
        {fmtNet(quote?.change, 'index')}
      </span>
      <span className="k-ticurve">
        <KCurve prices={spark?.prices} height={cal.curve} />
      </span>
      <Amp
        low={validHL(quote?.low) ? quote.low : null}
        high={validHL(quote?.high) ? quote.high : null}
        price={quote?.price}
      />
      <span className="k-tihl">
        H {validHL(quote?.high) ? fmtVal(quote.high, 'index') : '—'} · L{' '}
        {validHL(quote?.low) ? fmtVal(quote.low, 'index') : '—'}
      </span>
    </span>
  );
}

function KIndices({ quotes, intraday, futServed, cal }) {
  return (
    <div className="k-blk k-bl" style={{ width: 622 }}>
      <div className="k-ztitle">INDICES US</div>
      <div className="k-tilerow">
        {US.map(({ sym, label }, i) => (
          <span key={sym} style={{ display: 'contents' }}>
            {i > 0 && <span className="k-vsep" style={{ width: 24, height: cal.vsepH }} />}
            <KTile label={label} quote={quotes[sym]} spark={intraday[sym]} cal={cal} />
          </span>
        ))}
      </div>
      <div className="k-hr" style={{ margin: '8px 0 7px' }} />
      <div className="k-futrow">
        <span className="k-futlbl">FUT · O/N</span>
        {FUTURES.map(({ sym, label }) => {
          const q = quotes[sym];
          const range =
            futServed && validHL(q?.low) && validHL(q?.high)
              ? `${fmtVal(q.low, 'index')}–${fmtVal(q.high, 'index')}`
              : '—';
          return (
            <span className="k-futg" key={sym}>
              <span className="k-fsym">{label}</span>
              <span className="k-fval" style={{ fontSize: cal.fval - 1 }}>
                {futServed ? fmtVal(q?.price, 'index') : '—'}
              </span>
              <DeltaArrow pct={futServed ? q?.changePercent : null} size={12.5} />
              <span className="k-frng">{range}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ═══ B3 · VOL + FX (216) ════════════════════════════════════════
const REGIME_LABELS = ['CALME', 'NORMAL', 'NERVEUX', 'STRESS'];
function regimeOf(vix) {
  if (!Number.isFinite(vix)) return null;
  if (vix < 15) return 0;
  if (vix < 20) return 1;
  if (vix < 27) return 2;
  return 3;
}

function KVolFx({ quotes, rate, fxBadge, d5, cal }) {
  const vix = quotes['^VIX'];
  const idx = regimeOf(vix?.price);
  return (
    <div className="k-blk k-bl" style={{ width: 216 }}>
      <div className="k-ztitle">VOLATILITÉ</div>
      <div className="k-vrow">
        <span className="k-vval" style={{ fontSize: cal.vix }}>{fmtVal(vix?.price, 'vix')}</span>
        <Pill pct={vix?.changePercent} size={cal.pillV} />
        {idx != null && <KChip>{REGIME_LABELS[idx]}</KChip>}
      </div>
      <KScale vix={vix?.price} />
      <div className="k-vhl">
        H {fmtVal(vix?.high, 'vix')} · L {fmtVal(vix?.low, 'vix')}
        {d5 != null && <> · Δ5J ~{d5 >= 0 ? '+' : '−'}{Math.abs(d5).toFixed(1)}%</>}
      </div>
      <div className="k-hr" style={{ margin: '6px 0 5px' }} />
      <div className="k-ztitle">FX &amp; TAUX</div>
      <div className="k-fxhero">
        <span className="k-fxsym2">USD/CHF</span>
        <span className="k-fxval" style={{ fontSize: cal.fxval }}>
          {Number.isFinite(rate) ? rate.toFixed(4) : '—'}
        </span>
        <KChip>{fxBadge}</KChip>
      </div>
      <div className="k-fxap">APPLIQUÉ AU PORTEFEUILLE</div>
      {[
        { label: 'EUR/USD', q: quotes['EURUSD=X'], cls: 'fx' },
        { label: 'US10Y', q: quotes['^TNX'], cls: 'rate' },
        { label: 'DXY', q: quotes['DX-Y.NYB'], cls: 'rate' },
      ].map(({ label, q, cls }) => (
        <div className="k-fxr" key={label} style={{ height: cal.fxr, lineHeight: `${cal.fxr}px` }}>
          <span className="k-fxsym">{label}</span>
          <span className="k-fxv">{fmtVal(q?.price, cls)}</span>
          <DeltaArrow pct={q?.changePercent} size={13.5} signed />
        </div>
      ))}
    </div>
  );
}

// ═══ B4 · MONDE (315) — table unique 10 rangées ═════════════════
function KMonde({ quotes, cal }) {
  return (
    <div className="k-blk k-bl" style={{ width: 315 }}>
      <div className="k-ztitle">
        MONDE <span className="k-zsub">ACTIONS · CRYPTO · MATIÈRES</span>
      </div>
      {WORLD.map(({ sym, label, cls, sep }) => {
        const q = quotes[sym];
        return (
          <div
            className={`k-mr${sep ? ' k-mrh' : ''}`}
            key={sym}
            style={{ height: (sep ? 4 : 0) + cal.mr, lineHeight: `${cal.mr}px` }}
          >
            <span className="k-msym">{label}</span>
            <span className="k-mv" style={{ fontSize: cal.mv }}>{fmtVal(q?.price, cls)}</span>
            <span className="k-mpct">
              <DeltaArrow pct={q?.changePercent} size={13.5} />
            </span>
            <span className={`k-mdd k-da--${dirOf(q?.change)}`}>
              {fmtNet(q?.change, cls)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ═══ L'ÉTAGE (croquis, @1359) ═══════════════════════════════════
function KEtage({ cal, quotes, intraday, rate, fxBadge, macros, earnings, d5, futServed }) {
  return (
    <div className="k-cockpit">
      <section
        className="k-etage"
        style={{ height: cal.h, '--k-state': `${cal.state}px`, '--k-cd': `${cal.cd}px` }}
        aria-label={`Calibration ${cal.key}`}
      >
        <KSession macros={macros} earnings={earnings} />
        <KIndices quotes={quotes} intraday={intraday} futServed={futServed} cal={cal} />
        <KVolFx quotes={quotes} rate={rate} fxBadge={fxBadge} d5={d5} cal={cal} />
        <KMonde quotes={quotes} cal={cal} />
      </section>
    </div>
  );
}

// C1 = tailles EXACTES du croquis · C2 = un cran d'amplitude (§2).
const CALS = [
  // Hauteurs +20 vs ~262/~286 (adaptation déclarée : le contenu B1 du
  // croquis mesure 319 px dans une boîte de 262 — défaut de la spec
  // statique ; interlignes compressés, tailles de police intactes).
  {
    key: 'C1', label: 'C1 · CROQUIS — reproduction fidèle 1:1',
    h: 274, state: 20, cd: 33, px: 28, dd: 14, curve: 44, pillT: 14, pillV: 15,
    fval: 15, vix: 30, fxval: 23, fxr: 24, mv: 15, mr: 21, vsepH: 176,
  },
  {
    key: 'C2', label: 'C2 · CROQUIS AMPLIFIÉ — un cran de force, mêmes largeurs',
    h: 284, state: 22, cd: 36, px: 30, dd: 15, curve: 50, pillT: 15, pillV: 16,
    fval: 16, vix: 34, fxval: 25, fxr: 25, mv: 16, mr: 23, vsepH: 190,
  },
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
    // héros + 3 rangées (croquis : PROCHAIN + 3 agrow).
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
        <h1 className="lm-title">LAB · MARKET V — le croquis de l'architecte, vivant (1.C.7)</h1>
        <p className="lm-sub">
          A = témoin. Puis le croquis validé (docs/croquis/) reproduit au pixel avec les données
          vives, en deux forces : C1 fidèle · C2 amplifié. Largeur d'étage = 1359 px (cockpit réel,
          sidebar déployée).
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

      {CALS.map((cal) => (
        <section className="lm-variant" key={cal.key}>
          <div className="lm-variant__label">{cal.label}</div>
          <KEtage cal={cal} {...common} />
        </section>
      ))}
    </div>
  );
}
