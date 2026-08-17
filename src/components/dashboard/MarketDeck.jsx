// ═══════════════════════════════════════════════════════════════
//  MARKET DECK — D2-FINALE (v1.0 · 1.C.10)
//
//  Étage MARCHÉ du cockpit (conteneur .cockpit, sous la hairline du
//  tape ; les KPI portefeuille vivent dans Héros 1 depuis 1.D).
//  Composition D2 « double étage » choisie par Rafael aux labs I-VI,
//  amendée : AGENDA au rail du temps (gauche), FUT·O/N au rail des
//  entrailles (droite). ADN du croquis (atomes portés du lab, gelés).
//
//  Macro-grille FLUIDE (loi de fluidité 1.C.8 — fr/minmax, zéro px
//  de largeur totale en dur), 3 colonnes traversantes × 2 rangées,
//  hairlines de rails CONTINUES R1→R2 (signature d'harmonie) :
//    R1 · SESSION      — état + countdown 33 + progression 8 px
//       · INDICES US   — 4 tuiles héros (prix 30, courbes intraday
//                        1d/5m fluides, jauges d'amplitude 8 px)
//       · VOLATILITÉ   — VIX 32 + courbe intraday VIX + échelle
//                        graduée 10/15/20/27/40 + Δ5J
//    R2 · AGENDA       — héros (nom 17.5, J-x 16, ARMED ≤J-2) +
//                        3 rangées serrées, colonnes fixes
//       · FX & TAUX    — USD/CHF appliqué 23.5 + EUR/USD·US10Y·DXY
//       · MONDE ×10    — ACTIONS·CRYPTO/MATIÈRES, 2 rangées × 5
//       · FUT · O/N    — ES/NQ/YM permanents, range O/N conservé
//
//  Données : pollers partagés du tape (quotes 60 s, sparks 7d/1d)
//  + FUT injectés au MÊME batch (permanents, 1.C.10) + série
//  intraday 1d/5m dédiée (5 symboles / 5 min — ratifié architecte).
//  Gardes 1.C.7 : « — » jamais 0, H—/L—, curseurs masqués sans
//  range, 0.00 % neutre mute sans flèche, zéro NaN.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react';
import useMarketQuotes, { useQuoteBatchExtras } from '../../hooks/useMarketQuotes';
import { useMarketSparklines } from '../../hooks/useMarketSparklines';
import useCalendarFeeds from '../../hooks/useCalendarFeeds';
import { useFx } from '../../hooks/useFx';
import { useOpenPositions } from '../../store/useStore';
import { computeMarketPhase, formatCountdown } from '../../utils/marketPhase';
import { macroEventsInRange } from '../../data/macroEvents2026';

const PHASE_LABELS = { open: 'OUVERT', pre: 'PRÉ-MARCHÉ', after: 'AFTER', closed: 'FERMÉ' };
const EVENT_WINDOW_DAYS = 14;

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

// Série intraday 1d/5m : 4 indices + VIX. Liste et ordre UNIQUES
// (la clé du poller partagé est le join ordonné — ne pas dupliquer).
const INTRADAY_SYMBOLS = ['^SPX', '^NDX', '^DJI', '^RUT', '^VIX'];

// 1.G-c · D4 — MONDE. Européennes recentrées sur la zone de Rafael :
// DAX→CAC 40, FTSE→EURONEXT 100 (label court « EN 100 » — le nom complet
// débordait la cellule au plancher 1591) ; COPPER→**SMI**, indice suisse
// donc RANGÉE 1 avec les indices actions (un indice sous un en-tête
// « MATIÈRES » entre GOLD et CRUDE était une incohérence — GO 17.08).
//   Rangée 1 (ACTIONS · CRYPTO) : CAC 40 · EN 100 · NIKKEI · SMI · BTC · ETH
//   Rangée 2 (MATIÈRES) se referme sur : GOLD · SILVER · CRUDE · NATGAS
const WORLD_ROW1 = [
  { sym: '^FCHI', label: 'CAC 40', cls: 'index' },
  { sym: '^N100', label: 'EN 100', cls: 'index' },
  { sym: '^N225', label: 'NIKKEI', cls: 'index' },
  { sym: '^SSMI', label: 'SMI', cls: 'index' },
  { sym: 'BTC-USD', label: 'BTC', cls: 'index' },
  { sym: 'ETH-USD', label: 'ETH', cls: 'index' },
];
const WORLD_ROW2 = [
  { sym: 'GC=F', label: 'GOLD', cls: 'cmdty' },
  { sym: 'SI=F', label: 'SILVER', cls: 'cmdty' },
  { sym: 'CL=F', label: 'CRUDE', cls: 'cmdty' },
  { sym: 'NG=F', label: 'NATGAS', cls: 'cmdty' },
];

// 1.G-c · D2 — le cockpit ne partage plus la liste du bandeau (qui porte
// désormais Mag 7 / positions / secteurs). Il requête SA propre liste :
// tout ce qu'il rend (indices US, VIX, ligne FX & taux, MONDE). Les FUT
// sont injectés au même batch via useQuoteBatchExtras. ~18 symboles.
const COCKPIT_SYMBOLS = [
  '^SPX',
  '^NDX',
  '^DJI',
  '^RUT',
  '^VIX',
  'EURUSD=X',
  '^TNX',
  'DX-Y.NYB',
  ...WORLD_ROW1.map((w) => w.sym),
  ...WORLD_ROW2.map((w) => w.sym),
];

// Δ5J VIX : série 7d/1d dédiée (le bandeau ne porte plus ^VIX, donc plus
// de poller partagé — un seul symbole, cadence 5 min).
const VIX_DAILY = ['^VIX'];

// ─── Formatage (décimales par classe, gardes ratifiées 1.C.5) ────
const CHF = new Intl.NumberFormat('de-CH');
const CHF2 = new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function validHL(v) {
  return Number.isFinite(v) && v > 0; // H/L=0 en pré-marché → « — », jamais 0
}
function fmtVal(v, cls) {
  if (v == null || !Number.isFinite(v)) return '—';
  switch (cls) {
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
  if (cls === 'fx') return `${sign}${abs.toFixed(4)}`;
  if (cls === 'cmdty' || cls === 'rate' || cls === 'vix') return `${sign}${abs.toFixed(2)}`;
  return `${sign}${CHF.format(Math.round(abs))}`;
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

// 1.G-c · D3 — âge du taux FX affiché en clair (« il y a 32 s »). Au-delà
// de ce seuil, le taux est « en retard » (ambre = fraîcheur, JAMAIS une
// perte) : même si live (60 s) et Frankfurter (5 min) sont tous deux muets,
// on montre le DERNIER taux connu + son âge — jamais figé passé pour vif.
const FX_STALE_AGE_MS = 10 * 60 * 1000; // 10 min
function formatAge(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `il y a ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}
function detailOf(name) {
  const s = String(name || '');
  const dash = s.split(' — ')[1];
  if (dash) return dash.split(' (')[0];
  const paren = s.match(/\(([^)]+)\)/);
  return paren ? paren[1] : null;
}

// ─── Atomes ADN (croquis, gelés — anatomies UNIQUES) ────────────
// Pastille Δ% : mix 16 %, radius 4, flèche systématique (0.00 % → —).
function Pill({ pct, size }) {
  if (pct == null || !Number.isFinite(pct)) {
    return <span className="mk-pill mk-pill--flat" style={{ fontSize: size }}>—</span>;
  }
  const dir = dirOf(pct);
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '';
  return (
    <span className={`mk-pill mk-pill--${dir}`} style={{ fontSize: size }}>
      {arrow ? `${arrow} ` : ''}{Math.abs(pct).toFixed(2)}%
    </span>
  );
}

// Δ% texte à flèche : signé (FX), non signé (MONDE/FUT — 1.C.7),
// 0.00 % = mute sans flèche. Taille pilotée par CSS (.mk-da) — R2 seul —
// pour que le palier @≥2000 scale l'ensemble (alignement de densité R1↔R2).
function DeltaArrow({ pct, signed = false }) {
  if (pct == null || !Number.isFinite(pct)) {
    return <span className="mk-da mk-da--flat">—</span>;
  }
  if (pct === 0) {
    return <span className="mk-da mk-da--flat">0.00%</span>;
  }
  const dir = dirOf(pct);
  const arrow = pct > 0 ? '▲' : '▼';
  const sign = signed ? (pct > 0 ? '+' : '−') : '';
  return (
    <span className={`mk-da mk-da--${dir}`}>
      {arrow} {sign}{Math.abs(pct).toFixed(2)}%
    </span>
  );
}

// Chip reverse-video (régime VIX, mode FX).
function Chip({ children }) {
  return <span className="mk-chip">{children}</span>;
}

// Interpolation monotone Fritsch-Carlson (1.C.5) — jamais d'overshoot.
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
// Courbe FLUIDE : 100 % du conteneur, cap ≤ pts×6 (jamais étirée
// au-delà de sa densité), stroke non-scalé, aire 12 %→0 par direction.
function Curve({ prices, height, maxPts = 79 }) {
  const idRef = useRef(null);
  if (idRef.current == null) {
    gradSeq += 1;
    idRef.current = `mkgrad${gradSeq}`;
  }
  const cap = (prices?.length || maxPts) * 6;
  if (!prices || prices.length < 2) {
    return <div className="mk-curve--empty" style={{ height, maxWidth: cap }} />;
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
      className="mk-curve"
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

// Jauge d'amplitude FLUIDE : piste flex 8 px, curseur (prix−L)/(H−L),
// masquée (piste vide) sans range valide.
function Amp({ low, high, price, thick = 8 }) {
  const ok = Number.isFinite(low) && Number.isFinite(high) && Number.isFinite(price) && high > low;
  const pct = ok ? Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100)) : null;
  return (
    <div className="mk-amp" role="img" aria-label={ok ? `Prix à ${Math.round(pct)} % du range du jour` : 'Range indisponible'}>
      <span className="mk-ampl">L</span>
      <span className="mk-track" style={{ height: thick }}>
        {pct != null && <span className="mk-ampcur" style={{ left: `${pct}%`, top: -2, height: thick + 4 }} />}
      </span>
      <span className="mk-ampl">H</span>
    </div>
  );
}

// Largeur réelle d'un conteneur (ResizeObserver) — l'échelle VIX se
// retrace à toute largeur, le texte n'est JAMAIS étiré (1.C.8).
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

// Échelle VIX LINÉAIRE du croquis : x = pad + (v−10)/30 × utile,
// marques 10/15/20/27/40, curseur triangle (--accent si ≥ 20).
const VIX_MARKS = [10, 15, 20, 27, 40];
function VixScale({ vix }) {
  const [ref, w] = useWidth();
  const width = Math.max(120, Math.floor(w));
  const pad = 4;
  const x = (v) => pad + ((Math.max(10, Math.min(40, v)) - 10) / 30) * (width - 2 * pad);
  const hot = Number.isFinite(vix) && vix >= 20;
  return (
    <div className="mk-vscale" ref={ref}>
      {w > 0 && Number.isFinite(vix) && (
        <svg width={width} height="33" viewBox={`0 0 ${width} 33`} aria-label={`VIX ${vix.toFixed(2)} sur l'échelle 10–40`}>
          <rect className="mk-vtrack" x={pad} y="11" width={width - 2 * pad} height="7" rx="1" />
          {VIX_MARKS.map((v) => (
            <g key={v}>
              <line className="mk-vmark" x1={x(v)} y1="8" x2={x(v)} y2="20" strokeWidth="1" />
              <text className="mk-vnum" x={x(v)} y="31" fontSize="10.5" textAnchor={v === 10 ? 'start' : v === 40 ? 'end' : 'middle'}>
                {v}
              </text>
            </g>
          ))}
          <path className={`mk-vcur${hot ? ' is-hot' : ''}`} d={`M${x(vix).toFixed(1)},9 l-5,-7 l10,0 Z`} />
        </svg>
      )}
    </div>
  );
}

// ─── R1 · SESSION — tick 1 s ISOLÉ (ne re-rend pas le deck) ─────
function useSession() {
  const [now, setNow] = useState(() => new Date());
  const reduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );
  useEffect(() => {
    if (reduced) return undefined; // countdown statique sous reduced-motion
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [reduced]);
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

function SessionCell() {
  const s = useSession();
  return (
    <div className="mk-cell mk-session">
      <div className="mk-title">SESSION</div>
      <div className="mk-sesrow">
        <span className={`mk-sdot${s.phase === 'open' ? ' is-live' : ''}`} aria-hidden="true" />
        <span className="mk-sstate">{s.label}</span>
      </div>
      <div className="mk-slbl">{s.cdLabel}</div>
      <div className="mk-scd">{s.countdown}</div>
      <div className="mk-sesline">
        <span className="mk-sbar">
          {s.pct != null && <span className="mk-sfill" style={{ width: `${s.pct}%` }} />}
        </span>
        {s.pct != null && <span className="mk-spct"><span className="mk-num">{Math.round(s.pct)} %</span></span>}
      </div>
      <div className="mk-ny">NEW YORK <span className="mk-num">{s.nyLabel}</span></div>
    </div>
  );
}

// ─── R1 · INDICES US — tuile héros (anatomie D2×D4) ─────────────
function IndexTile({ label, quote, spark }) {
  return (
    <div className="mk-tile">
      <div className="mk-thead">
        <span className="mk-tsym">{label}</span>
        <Pill pct={quote?.changePercent} size={15} />
      </div>
      <div className="mk-tpxrow">
        <span className="mk-tpx">{fmtVal(quote?.price, 'index')}</span>
        <span className={`mk-tdd mk-da--${dirOf(quote?.change)}`}>{fmtNet(quote?.change, 'index')}</span>
      </div>
      <div className="mk-tcurve">
        <Curve prices={spark?.prices} height={56} />
      </div>
      <Amp
        low={validHL(quote?.low) ? quote.low : null}
        high={validHL(quote?.high) ? quote.high : null}
        price={quote?.price}
      />
      <span className="mk-thl">
        H {validHL(quote?.high) ? fmtVal(quote.high, 'index') : '—'} · L{' '}
        {validHL(quote?.low) ? fmtVal(quote.low, 'index') : '—'}
      </span>
    </div>
  );
}

// ─── R1 · VOLATILITÉ (enrichie de la courbe intraday VIX) ───────
function VolCell({ quotes, vixSpark, d5 }) {
  const vix = quotes['^VIX'];
  const v = vix?.price;
  const regime = !Number.isFinite(v) ? null : v < 15 ? 'CALME' : v < 20 ? 'NORMAL' : v < 27 ? 'NERVEUX' : 'STRESS';
  return (
    <div className="mk-cell mk-vol">
      <div className="mk-title">VOLATILITÉ</div>
      <div className="mk-vrow">
        <span className="mk-vval">{fmtVal(v, 'vix')}</span>
        <Pill pct={vix?.changePercent} size={16} />
        {regime && <Chip>{regime}</Chip>}
      </div>
      <div className="mk-vcurve">
        <Curve prices={vixSpark?.prices} height={36} />
      </div>
      <VixScale vix={v} />
      <div className="mk-vhl">
        H {fmtVal(vix?.high, 'vix')} · L {fmtVal(vix?.low, 'vix')}
        {d5 != null && <> · Δ5J ~{d5 >= 0 ? '+' : '−'}{Math.abs(d5).toFixed(1)}%</>}
      </div>
    </div>
  );
}

// ─── R2 · AGENDA — héros + 3 rangées serrées (rail du temps) ────
function AgendaCell({ hero, rows, showEmptyE, localOnly }) {
  const heroD = hero ? daysUntil(hero.date) : null;
  const heroHot = heroD != null && heroD <= 2; // ARMED ≤ J-2 (accent)
  const heroDetail = hero ? detailOf(hero.name) : null;
  return (
    <div className="mk-cell mk-agenda">
      <div className="mk-title">
        AGENDA
        {localOnly ? <span className="mk-tbadge">LOCAL</span> : null}
      </div>
      {hero ? (
        <>
          <div className="mk-ahero">
            <span className="mk-ak">{hero.k}</span>
            <span className="mk-ahname" title={hero.name}>{compactName(hero.name)}</span>
            <span className={`mk-ahj${heroHot ? ' is-hot' : ''}`}>{etaLabel(heroD)}</span>
          </div>
          <div className="mk-ahsub">
            {heroDetail ? <>{heroDetail} · </> : null}
            <span className="mk-num">{shortDate(hero.date)}</span>
          </div>
        </>
      ) : (
        <div className="mk-ahsub mk-ahsub--none">— aucun événement</div>
      )}
      {rows.map((ev, i) => {
        const d = daysUntil(ev.date);
        return (
          <div className="mk-arow" key={`${ev.name}-${ev.date}-${i}`}>
            <span className="mk-ak mk-ak--row">{ev.k}</span>
            <span className="mk-aname" title={ev.name}>{compactName(ev.name)}</span>
            <span className="mk-adate">{shortDate(ev.date)}</span>
            <span className={`mk-aj${d <= 2 ? ' is-hot' : ''}`}>{etaLabel(d)}</span>
          </div>
        );
      })}
      {showEmptyE && (
        <div className="mk-arow">
          <span className="mk-ak mk-ak--row mk-ak--empty">E</span>
          <span className="mk-aempty">— sous {EVENT_WINDOW_DAYS} j</span>
        </div>
      )}
    </div>
  );
}

// ─── R2 · FX & TAUX — USD/CHF automatique (D3) ──────────────────
// Le badge MANUEL est MORT : le taux se rafraîchit avec le deck et
// affiche son ÂGE (« il y a 32 s ») à la place. Tick 1 s ISOLÉ à la
// cellule (ne re-rend pas le deck), gelé sous reduced-motion.
function FxCell({ quotes, rate, lastUpdated }) {
  const reduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (reduced) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [reduced]);

  const ageMs = lastUpdated ? nowMs - new Date(lastUpdated).getTime() : null;
  const ageText = formatAge(ageMs);
  const ageStale = ageMs == null || ageMs > FX_STALE_AGE_MS;

  const groups = [
    { label: 'EUR/USD', q: quotes['EURUSD=X'], cls: 'fx' },
    { label: 'US10Y', q: quotes['^TNX'], cls: 'rate' },
    { label: 'DXY', q: quotes['DX-Y.NYB'], cls: 'rate' },
  ];
  return (
    <div className="mk-cell mk-fx">
      <div className="mk-title">FX &amp; TAUX</div>
      <div className="mk-fxhero">
        <span className="mk-fxsym">USD/CHF</span>
        <span className="mk-fxval">{Number.isFinite(rate) ? rate.toFixed(4) : '—'}</span>
        <span className={`mk-fxage${ageStale ? ' is-stale' : ''}`}>
          {ageText || 'taux indisponible'}
        </span>
      </div>
      <div className="mk-fxap">APPLIQUÉ AU PORTEFEUILLE</div>
      <div className="mk-fxline">
        {groups.map(({ label, q, cls }) => (
          <span className="mk-fxg" key={label}>
            <span className="mk-fxgsym">{label}</span>
            <span className="mk-fxgval">{fmtVal(q?.price, cls)}</span>
            <DeltaArrow pct={q?.changePercent} signed />
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── R2 · MONDE ×10 — 2 rangées × 5, colonnes réglées ───────────
function WorldCell({ sym, label, cls, quotes }) {
  const q = quotes[sym];
  return (
    <span className="mk-wcell">
      <span className="mk-wtop">
        <span className="mk-wsym">{label}</span>
        <span className="mk-wval">{fmtVal(q?.price, cls)}</span>
      </span>
      <span className="mk-wbot">
        <DeltaArrow pct={q?.changePercent} />
        <span className={`mk-wdd mk-da mk-da--${dirOf(q?.change)}`}>{fmtNet(q?.change, cls)}</span>
      </span>
    </span>
  );
}

function MondeCell({ quotes }) {
  return (
    <div className="mk-cell mk-monde">
      <div className="mk-title">
        MONDE <span className="mk-tsub">ACTIONS · CRYPTO · MATIÈRES</span>
      </div>
      <div className="mk-wgrid">
        <div className="mk-wrow mk-wrow--top">
          {WORLD_ROW1.map((w) => (
            <WorldCell key={w.sym} {...w} quotes={quotes} />
          ))}
        </div>
        <div className="mk-wrow mk-wrow--bot">
          {WORLD_ROW2.map((w) => (
            <WorldCell key={w.sym} {...w} quotes={quotes} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── R2 · FUT · O/N — slot permanent (rail des entrailles) ──────
// É3.2 « zéro fantôme » — le feed est branché et sert même le week-end
// (clôture de vendredi, prouvé /api/quote/ES=F 200 un samedi) : trois
// rangées de tirets nus = premier train de quotes pas encore arrivé
// (cache froid / 429 transitoire), PAS une session fermée. Tant que
// rien n'a servi → UN état explicite (pattern « — aucun événement »
// de l'AGENDA) ; dès le premier train complet, rangées permanentes.
function FutCell({ quotes, futServed }) {
  return (
    <div className="mk-cell mk-fut">
      <div className="mk-title">FUT · O/N</div>
      {futServed ? (
        FUTURES.map(({ sym, label }) => {
          const q = quotes[sym];
          const served = Number.isFinite(q?.price);
          return (
            <div className="mk-futr" key={sym}>
              <span className="mk-fsym">{label}</span>
              <span className="mk-fval">{served ? fmtVal(q.price, 'index') : '—'}</span>
              <DeltaArrow pct={served ? q?.changePercent : null} />
              <span className="mk-frng">
                {served && validHL(q?.low) && validHL(q?.high)
                  ? `${fmtVal(q.low, 'index')}–${fmtVal(q.high, 'index')}`
                  : '—'}
              </span>
            </div>
          );
        })
      ) : (
        <div className="mk-ahsub mk-ahsub--none">— en attente du flux quotes</div>
      )}
    </div>
  );
}

// ═══ Deck ═══════════════════════════════════════════════════════
export default function MarketDeck() {
  const { quotes } = useMarketQuotes(COCKPIT_SYMBOLS);
  // FUT : MÊME batch de quotes, PERMANENTS (1.C.10 — en RTH les
  // valeurs restent vives, le range O/N est conservé).
  useQuoteBatchExtras(COCKPIT_SYMBOLS, FUTURES_SYMBOLS);
  // Série intraday 1d/5m (poller dédié, 5 appels / 5 min — ratifié).
  const { sparklines: intraday } = useMarketSparklines(INTRADAY_SYMBOLS, '1d', '5m');
  // Série 7d/1d dédiée au Δ5J VIX (un seul symbole depuis 1.G-c — le
  // bandeau ne porte plus ^VIX). Ne jamais merger avec `intraday`.
  const { sparklines: daily } = useMarketSparklines(VIX_DAILY);
  const openPositions = useOpenPositions();
  // 1.G-c · D3 — source FX UNIQUE (settings.liveRate) + horodatage. Le
  // mode/badge MANUEL est mort ; l'âge remplace le badge dans FxCell.
  const { rate, lastUpdated: fxLastUpdated } = useFx();

  const myTickers = useMemo(
    () => [...new Set((openPositions || []).map((p) => p.tk).filter(Boolean))],
    [openPositions]
  );
  const today = isoToday();
  const horizon = isoPlusDays(EVENT_WINDOW_DAYS);
  const farHorizon = isoPlusDays(60); // macro sans borne haute (fenêtre large)
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

  // MACRO : union Finnhub ∪ local dédupliquée (1.C.5), 3 prochains
  // + héros. Le fallback local garantit un agenda JAMAIS vide.
  const agendaFeedCount = useRef(0);
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
    agendaFeedCount.current = feed.length;
    return union.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  }, [macro, today, farHorizon]);

  // EARNINGS : positions ouvertes, fenêtre 14 j.
  const earningsItems = useMemo(() => {
    const rows = (earnings || [])
      .map((e) => ({ date: e.date || e.time, name: String(e.symbol || '').toUpperCase() }))
      .filter((e) => e.date && e.name && e.date >= today && e.date <= horizon);
    return rows.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 2);
  }, [earnings, today, horizon]);

  // Agenda : héros = le plus proche (M ou E), puis 3 rangées serrées.
  // Sans earnings sous 14 j, la 3e rangée est l'état E designé.
  const agenda = useMemo(() => {
    const all = [
      ...macros.map((m) => ({ ...m, k: 'M' })),
      ...earningsItems.map((e) => ({ ...e, k: 'E' })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    const hasE = earningsItems.length > 0;
    const rows = hasE ? all.slice(1, 4) : all.slice(1, 3);
    return { hero: all[0] || null, rows, showEmptyE: !hasE };
  }, [macros, earningsItems]);

  // Δ5J VIX (série 7d/1d du tape) — omis si indérivable.
  const d5 = useMemo(() => {
    const p = daily['^VIX']?.prices;
    if (!p || p.length < 6) return null;
    const ref = p[p.length - 6];
    const last = p[p.length - 1];
    if (!Number.isFinite(ref) || !Number.isFinite(last) || ref === 0) return null;
    return ((last - ref) / ref) * 100;
  }, [daily]);

  // FUT servis : badge STICKY session (1.C.4 — le 1er train peut
  // arriver après le mount ; un 429 transitoire ne vide pas le slot).
  const futLiveNow = FUTURES_SYMBOLS.every((s) => Number.isFinite(quotes[s]?.price));
  const futSeenRef = useRef(false);
  if (futLiveNow) futSeenRef.current = true;
  const futServed = futSeenRef.current;

  return (
    <section className="market-deck" aria-label="Marché en un coup d'œil">
      <SessionCell />
      <div className="mk-cell mk-indices">
        <div className="mk-tiles">
          {US.map(({ sym, label }) => (
            <IndexTile key={sym} label={label} quote={quotes[sym]} spark={intraday[sym]} />
          ))}
        </div>
      </div>
      <VolCell quotes={quotes} vixSpark={intraday['^VIX']} d5={d5} />
      <div className="mk-hr" aria-hidden="true" />
      <AgendaCell
        hero={agenda.hero}
        rows={agenda.rows}
        showEmptyE={agenda.showEmptyE}
        localOnly={Boolean(calError) && agendaFeedCount.current === 0}
      />
      <FxCell quotes={quotes} rate={rate} lastUpdated={fxLastUpdated} />
      <MondeCell quotes={quotes} />
      <FutCell quotes={quotes} futServed={futServed} />
    </section>
  );
}
