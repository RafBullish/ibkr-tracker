// ═══════════════════════════════════════════════════════════════
//  MARKET LAB II — /lab/market (1.C.4) · DEV-ONLY, ÉPHÉMÈRE
//
//  CONCEPTION DÉLÉGUÉE : trois LANGAGES de dessin (pas trois tailles),
//  construits sous boucle d'autocritique (checklist de la claque) :
//    A  · Témoin v2 (réel)
//    V1 · TERMINAL   — mur de nombres réglé Bloomberg (variations =
//                      gros chiffres colorés, chips reverse-video,
//                      rail SESSION pleine hauteur)
//    V2 · DATA-VIZ   — tuiles TradingView (sparklines HAUTES en
//                      dégradé, prix massifs, pastilles du tape)
//    V3 · COCKPIT    — instrument asymétrique (commandement | mur
//                      central | intelligence : échelle VIX graduée
//                      ~220×14 + timeline d'agenda VERTICALE)
//
//  LOIS : hiérarchie (primaires ≥26, héros 32-40, étage 240-300) ·
//  anti-vide durcie (contenu → grille, gap max 32) · couleur marché
//  sur les VARIATIONS (chiffres colorés autorisés à toute taille),
//  prix en --ink-pure · ambre = vivant/décision only.
//  Données : partage 1.C (une instanciation), zéro polling nouveau.
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
const INTL = [
  { sym: '^GDAXI', label: 'DAX' },
  { sym: '^FTSE', label: 'FTSE' },
  { sym: '^N225', label: 'NIKKEI' },
];
const MONDE = [
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
function compactName(name) {
  return String(name || '').split(' — ')[0].split(' (')[0];
}

// Variation en NOMBRE COLORÉ (sémantique marché, sanctionnée à toute taille).
function Delta({ v, kind = 'pct', className = '' }) {
  const dir = dirOf(v);
  const txt = kind === 'pct' ? fmtPct(v) : fmtNet(v);
  return <span className={`lm2-delta lm2-delta--${dir} ${className}`.trim()}>{txt}</span>;
}

// Pastille (anatomie tape — langage V2).
function Pill({ pct, size = 'lg' }) {
  if (pct == null || !Number.isFinite(pct)) {
    return <span className={`lm2-pill lm2-pill--${size} lm2-pill--flat`}>—</span>;
  }
  const dir = dirOf(pct);
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '';
  return (
    <span className={`lm2-pill lm2-pill--${size} lm2-pill--${dir}`}>
      {arrow && <span className="lm2-pill__arrow">{arrow}</span>}
      {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

// Chip reverse-video (langage V1 — états Bloomberg).
function Reverse({ children, tone = 'ink' }) {
  return <span className={`lm2-rev lm2-rev--${tone}`}>{children}</span>;
}

// Sparkline AIRE haute (langage V2) — dégradé 12 % → 0, stroke 1.5.
let gradSeq = 0;
function AreaSpark({ prices, height = 64, width = 150, fill = false }) {
  const idRef = useRef(null);
  if (idRef.current == null) {
    gradSeq += 1;
    idRef.current = `lm2grad${gradSeq}`;
  }
  if (!prices || prices.length < 2) return <div style={fill ? undefined : { height }} />;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const stepX = width / (prices.length - 1);
  const pts = prices.map((p, i) => `${(i * stepX).toFixed(2)},${(height - 6 - ((p - min) / range) * (height - 12)).toFixed(2)}`);
  const line = `M ${pts.join(' L ')}`;
  const area = `${line} L ${width},${height} L 0,${height} Z`;
  const up = prices[prices.length - 1] >= prices[0];
  const color = up ? 'var(--pnl-up)' : 'var(--pnl-down)';
  return (
    <svg
      className={`lm2-areaspark${fill ? ' lm2-areaspark--fill' : ''}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={fill ? undefined : { height }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={idRef.current} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${idRef.current})`} stroke="none" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Session vivante (tick 1 s isolé par instance).
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

// ═══ V1 · TERMINAL — le mur réglé ═══════════════════════════════
function V1RailSession() {
  const now = useSessionNow();
  const { phase, targetKind, targetMs, nyLabel } = computeMarketPhase(now);
  return (
    <div className="lmv1-rail">
      <div className="lmv1-rail__phase">
        <span className={`lm2-dot${phase === 'open' ? ' lm2-dot--live' : ''}`} aria-hidden="true" />
        <Reverse tone={phase === 'open' ? 'amber' : 'ink'}>{PHASE_LABELS[phase]}</Reverse>
      </div>
      <div className="lmv1-rail__cd-label">{targetKind === 'close' ? 'CLÔTURE DANS' : 'OUVERTURE DANS'}</div>
      <div className="lmv1-rail__cd">{formatCountdown(targetMs != null ? targetMs - now.getTime() : null)}</div>
      <div className="lmv1-rail__ny">NEW YORK {nyLabel}</div>
      <div className="lmv1-rail__rule" />
      <div className="lmv1-rail__rth">RTH 09:30–16:00 NY</div>
    </div>
  );
}

function V1Row({ label, quote }) {
  const range =
    Number.isFinite(quote?.low) && Number.isFinite(quote?.high)
      ? `${fmtPrice(quote.low)}–${fmtPrice(quote.high)}`
      : '—';
  return (
    <div className="lmv1-tr">
      <span className="lmv1-td lmv1-td--sym">{label}</span>
      <span className="lmv1-td lmv1-td--last">{fmtPrice(quote?.price)}</span>
      <Delta v={quote?.changePercent} className="lmv1-td lmv1-td--pct" />
      <Delta v={quote?.change} kind="net" className="lmv1-td lmv1-td--net" />
      <span className="lmv1-td lmv1-td--range">{range}</span>
    </div>
  );
}

function V1Terminal({ quotes, rate, fxBadge, macros, earnings, d5, futServed, showFut }) {
  const vix = quotes['^VIX'];
  const regime =
    Number.isFinite(vix?.price)
      ? vix.price < 15 ? 'CALME' : vix.price < 20 ? 'NORMAL' : vix.price < 27 ? 'NERVEUX' : 'STRESS'
      : '—';
  const regimeHot = Number.isFinite(vix?.price) && vix.price >= 20;
  // Rangées RÉELLES uniquement (anti-vide : pas de tirets empilés) ;
  // les absences se disent en UNE ligne récap par type.
  const agendaEvents = [
    ...macros.map((m) => ({ k: 'M', ...m })),
    ...earnings.map((e) => ({ k: 'E', armed: true, ...e })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section className="lmv1" aria-label="V1 Terminal">
      <V1RailSession />

      {/* Mur de nombres réglé — deux tables jumelles (hauteur ≤ loi) */}
      <div className="lmv1-wall">
        <div className="lmv1-tr lmv1-tr--head">
          <span className="lmv1-td lmv1-td--sym">USA</span>
          <span className="lmv1-td lmv1-td--last">LAST</span>
          <span className="lmv1-td lmv1-td--pct">VAR %</span>
          <span className="lmv1-td lmv1-td--net">VAR $</span>
          <span className="lmv1-td lmv1-td--range">RANGE JOUR</span>
        </div>
        {US.map(({ sym, label }) => (
          <V1Row key={sym} label={label} quote={quotes[sym]} />
        ))}
        {/* Décision de variante : FUT PERMANENT dans le mur (cotation ~24 h,
            range overnight informatif) — équilibre 7/7 avec la table MONDE. */}
        {futServed && (
          <>
            <div className="lmv1-groupline" />
            {FUTURES.map(({ sym, label }) => (
              <V1Row key={sym} label={label} quote={quotes[sym]} />
            ))}
          </>
        )}
      </div>
      <div className="lmv1-wall">
        <div className="lmv1-tr lmv1-tr--head">
          <span className="lmv1-td lmv1-td--sym">MONDE</span>
          <span className="lmv1-td lmv1-td--last">LAST</span>
          <span className="lmv1-td lmv1-td--pct">VAR %</span>
          <span className="lmv1-td lmv1-td--net">VAR $</span>
          <span className="lmv1-td lmv1-td--range">RANGE JOUR</span>
        </div>
        {INTL.map(({ sym, label }) => (
          <V1Row key={sym} label={label} quote={quotes[sym]} />
        ))}
        <div className="lmv1-groupline" />
        {MONDE.map(({ sym, label }) => (
          <V1Row key={sym} label={label} quote={quotes[sym]} />
        ))}
      </div>

      {/* Colonne VOL & FX */}
      <div className="lmv1-volfx">
        <div className="lmv1-sect">VOLATILITÉ</div>
        <div className="lmv1-vix">
          <span className="lmv1-vix__value">{Number.isFinite(vix?.price) ? vix.price.toFixed(2) : '—'}</span>
          <Delta v={vix?.changePercent} className="lmv1-vix__pct" />
          {d5 != null && (
            <span className="lmv1-vix__d5">
              Δ5J ~{d5 >= 0 ? '+' : '−'}{Math.abs(d5).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="lmv1-hl">
          <Reverse tone={regimeHot ? 'amber' : 'ink'}>{regime}</Reverse>{' '}
          H <b>{Number.isFinite(vix?.high) ? vix.high.toFixed(2) : '—'}</b> · L{' '}
          <b>{Number.isFinite(vix?.low) ? vix.low.toFixed(2) : '—'}</b>
        </div>
        <div className="lmv1-rule" />
        <div className="lmv1-sect">FX &amp; TAUX</div>
        <div className="lmv1-fxmain">
          <span className="lmv1-fxmain__sym">USD/CHF</span>
          <span className="lmv1-fxmain__val">{Number.isFinite(rate) ? rate.toFixed(4) : '—'}</span>
          <Reverse tone="ink">{fxBadge}</Reverse>
        </div>
        {[
          { label: 'EUR/USD', q: quotes['EURUSD=X'], d: 4 },
          { label: 'US10Y', q: quotes['^TNX'], d: 2 },
          { label: 'DXY', q: quotes['DX-Y.NYB'], d: 2 },
        ].map(({ label, q, d }) => (
          <div className="lmv1-fxrow" key={label}>
            <span className="lmv1-fxrow__sym">{label}</span>
            <span className="lmv1-fxrow__val">
              {Number.isFinite(q?.price) ? q.price.toFixed(d) : '—'}
            </span>
            <Delta v={q?.changePercent} className="lmv1-fxrow__pct" />
          </div>
        ))}
      </div>

      {/* Agenda réglé */}
      <div className="lmv1-agenda">
        <div className="lmv1-sect">AGENDA 14 J</div>
        {agendaEvents.map((ev, i) => {
          const d = daysUntil(ev.date);
          const hot = d <= 2;
          return (
            <div className="lmv1-agrow" key={i}>
              <Reverse tone="ink">{ev.k}</Reverse>
              <span className="lmv1-agrow__name" title={ev.name}>
                {compactName(ev.name)}
              </span>
              <span className="lmv1-agrow__date">
                {ev.date.slice(8, 10)}.{ev.date.slice(5, 7)}
              </span>
              <span className={`lmv1-agrow__eta${hot ? ' is-hot' : ''}`}>{etaLabel(d)}</span>
              {ev.armed && hot && <Reverse tone="amber">ARMED</Reverse>}
            </div>
          );
        })}
        {macros.length === 0 && (
          <div className="lmv1-agrow">
            <Reverse tone="ink">M</Reverse>
            <span className="lmv1-agrow__empty">macro — rien sous {EVENT_WINDOW_DAYS} j</span>
          </div>
        )}
        {earnings.length === 0 && (
          <div className="lmv1-agrow">
            <Reverse tone="ink">E</Reverse>
            <span className="lmv1-agrow__empty">earnings — rien sous {EVENT_WINDOW_DAYS} j</span>
          </div>
        )}
      </div>
    </section>
  );
}

// ═══ V2 · DATA-VIZ — les tuiles TradingView ═════════════════════
function V2SessionTile() {
  const now = useSessionNow();
  const { phase, targetKind, targetMs, nyLabel } = computeMarketPhase(now);
  return (
    <div className="lmv2-tile lmv2-tile--session">
      <div className="lmv2-tile__head">
        <span className={`lm2-dot${phase === 'open' ? ' lm2-dot--live' : ''}`} aria-hidden="true" />
        <span className="lmv2-session-phase">{PHASE_LABELS[phase]}</span>
      </div>
      <div className="lmv2-session-cdlabel">
        {targetKind === 'close' ? 'CLÔTURE DANS' : 'OUVERTURE DANS'}
      </div>
      <div className="lmv2-session-cd">
        {formatCountdown(targetMs != null ? targetMs - now.getTime() : null)}
      </div>
      <div className="lmv2-session-ny">NEW YORK {nyLabel}</div>
    </div>
  );
}

function V2IndexTile({ label, quote, spark }) {
  return (
    <div className="lmv2-tile">
      <div className="lmv2-tile__head">
        <span className="lmv2-sym">{label}</span>
        <Pill pct={quote?.changePercent} size="lg" />
      </div>
      <div className="lmv2-price">{fmtPrice(quote?.price)}</div>
      <Delta v={quote?.change} kind="net" className="lmv2-net" />
      <div className="lmv2-chart lmv2-chart--fill">
        <AreaSpark prices={spark?.prices} fill />
      </div>
    </div>
  );
}

function V2DataViz({ quotes, sparklines, rate, fxBadge, macros, earnings, d5 }) {
  const vix = quotes['^VIX'];
  const regime =
    Number.isFinite(vix?.price)
      ? vix.price < 15 ? 'CALME' : vix.price < 20 ? 'NORMAL' : vix.price < 27 ? 'NERVEUX' : 'STRESS'
      : '—';
  const regimeHot = Number.isFinite(vix?.price) && vix.price >= 20;
  const events = [
    ...macros.map((m) => ({ ...m, kind: 'macro' })),
    ...earnings.map((e) => ({ ...e, kind: 'earn' })),
  ].filter((e) => {
    const d = daysUntil(e.date);
    return d >= 0 && d <= EVENT_WINDOW_DAYS;
  });
  return (
    <section className="lmv2" aria-label="V2 Data-viz">
      <V2SessionTile />
      {US.map(({ sym, label }) => (
        <V2IndexTile key={sym} label={label} quote={quotes[sym]} spark={sparklines[sym]} />
      ))}

      {/* VIX — tuile large, la courbe est le héros */}
      <div className="lmv2-tile lmv2-tile--vix">
        <div className="lmv2-tile__head">
          <span className="lmv2-sym">VIX</span>
          <Pill pct={vix?.changePercent} size="lg" />
          <span className={`lmv2-regime${regimeHot ? ' is-hot' : ''}`}>{regime}</span>
        </div>
        <div className="lmv2-vix-row">
          <span className="lmv2-price lmv2-price--vix">
            {Number.isFinite(vix?.price) ? vix.price.toFixed(2) : '—'}
          </span>
          <span className="lmv2-vix-hl">
            H {Number.isFinite(vix?.high) ? vix.high.toFixed(2) : '—'} · L{' '}
            {Number.isFinite(vix?.low) ? vix.low.toFixed(2) : '—'}
            {d5 != null && ` · Δ5J ~${d5 >= 0 ? '+' : '−'}${Math.abs(d5).toFixed(1)}%`}
          </span>
        </div>
        <div className="lmv2-chart lmv2-chart--fill">
          <AreaSpark prices={sparklines['^VIX']?.prices} fill />
        </div>
      </div>

      {/* FX & TAUX */}
      <div className="lmv2-tile lmv2-tile--fx">
        <div className="lmv2-tile__head">
          <span className="lmv2-sym">USD/CHF</span>
          <span className="lmv2-fx-badge">{fxBadge}</span>
        </div>
        <div className="lmv2-price lmv2-price--fx">{Number.isFinite(rate) ? rate.toFixed(4) : '—'}</div>
        <div className="lmv2-fx-caption">TAUX APPLIQUÉ</div>
        <div className="lmv2-fx-rows">
          {[
            { label: 'EUR/USD', q: quotes['EURUSD=X'], d: 4 },
            { label: 'US10Y', q: quotes['^TNX'], d: 2 },
            { label: 'DXY', q: quotes['DX-Y.NYB'], d: 2 },
          ].map(({ label, q, d }) => (
            <div className="lmv2-fx-row" key={label}>
              <span className="lmv2-fx-sym">{label}</span>
              <span className="lmv2-fx-val">{Number.isFinite(q?.price) ? q.price.toFixed(d) : '—'}</span>
              <Pill pct={q?.changePercent} size="sm" />
            </div>
          ))}
        </div>
        <div className="lmv2-chart lmv2-chart--fill">
          <AreaSpark prices={sparklines['USDCHF=X']?.prices} fill />
        </div>
      </div>

      {/* EUROPE · ASIE */}
      <div className="lmv2-tile lmv2-tile--intl">
        <div className="lmv2-tile__head">
          <span className="lmv2-sym">EUROPE · ASIE</span>
        </div>
        <div className="lmv2-intl-rows">
          {INTL.map(({ sym, label }) => (
            <div className="lmv2-intl-row" key={sym}>
              <span className="lmv2-fx-sym">{label}</span>
              <span className="lmv2-intl-val">{fmtPrice(quotes[sym]?.price)}</span>
              <Pill pct={quotes[sym]?.changePercent} size="sm" />
            </div>
          ))}
        </div>
        <div className="lmv2-chart lmv2-chart--fill">
          <AreaSpark prices={sparklines['^GDAXI']?.prices} fill />
        </div>
      </div>

      {/* AGENDA — timeline ÉPAISSE */}
      <div className="lmv2-tile lmv2-tile--agenda">
        <div className="lmv2-tile__head">
          <span className="lmv2-sym">AGENDA 14 J</span>
        </div>
        <div className="lmv2-ag-rows">
          {events.slice(0, 4).map((ev, i) => {
            const d = daysUntil(ev.date);
            const hot = d <= 2;
            return (
              <div className="lmv2-ag-row" key={i}>
                <span className="lmv2-ag-k">{ev.kind === 'macro' ? 'M' : 'E'}</span>
                <span className="lmv2-ag-name" title={ev.name}>{compactName(ev.name)}</span>
                <span className="lmv2-ag-date">
                  {ev.date.slice(8, 10)}.{ev.date.slice(5, 7)}
                </span>
                <span className={`lmv2-ag-eta${hot ? ' is-hot' : ''}`}>{etaLabel(d)}</span>
                {ev.kind === 'earn' && hot && <span className="lmv2-armed">ARMED</span>}
              </div>
            );
          })}
          {!events.some((e) => e.kind === 'macro') && (
            <div className="lmv2-ag-row">
              <span className="lmv2-ag-k">M</span>
              <span className="lmv2-ag-empty">macro — rien sous 14 j</span>
            </div>
          )}
          {!events.some((e) => e.kind === 'earn') && (
            <div className="lmv2-ag-row">
              <span className="lmv2-ag-k">E</span>
              <span className="lmv2-ag-empty">earnings — rien sous 14 j</span>
            </div>
          )}
        </div>
        <div className="lmv2-timeline">
          <div className="lmv2-timeline__track">
            {Array.from({ length: 15 }, (_, i) => (
              <span className="lmv2-timeline__tick" key={i} style={{ left: `${(i / 14) * 100}%` }} />
            ))}
            {events.map((ev, i) => {
              const d = daysUntil(ev.date);
              const hot = d <= 2;
              const pct = Math.max(3, Math.min(97, (d / 14) * 100));
              return (
                <span
                  key={i}
                  className={`lmv2-timeline__dot lmv2-timeline__dot--${ev.kind}${hot ? ' is-hot' : ''}`}
                  style={{ left: `${pct}%` }}
                  title={`${ev.name} · ${etaLabel(d)}`}
                />
              );
            })}
          </div>
          <div className="lmv2-timeline__names">
            {events.map((ev, i) => {
              const d = daysUntil(ev.date);
              const pct = Math.max(8, Math.min(90, (d / 14) * 100));
              return (
                <span key={i} className="lmv2-timeline__name" style={{ left: `${pct}%` }}>
                  {compactName(ev.name)}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══ V3 · COCKPIT — l'instrument asymétrique ════════════════════
function V3Command({ futServed, showFut, quotes }) {
  const now = useSessionNow();
  const { phase, targetKind, targetMs, phaseStartMs, nyLabel } = computeMarketPhase(now);
  const nowMs = now.getTime();
  const pct =
    phaseStartMs != null && targetMs != null && targetMs > phaseStartMs
      ? Math.max(0, Math.min(100, ((nowMs - phaseStartMs) / (targetMs - phaseStartMs)) * 100))
      : null;
  return (
    <div className="lmv3-cmd">
      <div className="lmv3-cmd__phase">
        <span className={`lm2-dot lm2-dot--big${phase === 'open' ? ' lm2-dot--live' : ''}`} aria-hidden="true" />
        <span className="lmv3-cmd__phase-txt">{PHASE_LABELS[phase]}</span>
      </div>
      <div className="lmv3-cmd__cdlabel">
        {targetKind === 'close' ? 'CLÔTURE DANS' : 'OUVERTURE DANS'}
      </div>
      <div className="lmv3-cmd__cd">
        {formatCountdown(targetMs != null ? targetMs - nowMs : null)}
      </div>
      {pct != null && (
        <div className="lmv3-progress" role="img" aria-label={`Phase écoulée à ${Math.round(pct)} %`}>
          <div className="lmv3-progress__track">
            <div className="lmv3-progress__fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="lmv3-progress__caption">{Math.round(pct)} %</div>
        </div>
      )}
      <div className="lmv3-cmd__ny">NEW YORK {nyLabel}</div>
      {futServed && showFut && (
        <div className="lmv3-cmd__fut">
          <span className="lmv3-cmd__fut-tag">FUT</span>
          {FUTURES.map(({ sym, label }) => (
            <span className="lmv3-cmd__fut-item" key={sym}>
              {label} <Delta v={quotes[sym]?.changePercent} className="lm2-delta--15" />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function V3WallRow({ label, quote, fxDecimals = null }) {
  return (
    <div className="lmv3-wrow">
      <span className="lmv3-wrow__sym">{label}</span>
      <span className="lmv3-wrow__val">
        {fxDecimals != null
          ? Number.isFinite(quote?.price)
            ? quote.price.toFixed(fxDecimals)
            : '—'
          : fmtPrice(quote?.price)}
      </span>
      <Delta v={quote?.changePercent} className="lmv3-wrow__pct" />
    </div>
  );
}

const V3_SEGMENTS = [
  { from: 10, to: 15, label: 'CALME' },
  { from: 15, to: 20, label: 'NORMAL' },
  { from: 20, to: 27, label: 'NERVEUX' },
  { from: 27, to: 40, label: 'STRESS' },
];

function V3RegimeScale({ vix }) {
  if (!Number.isFinite(vix)) return null;
  const clamped = Math.max(10, Math.min(40, vix));
  let idx = V3_SEGMENTS.findIndex((s) => clamped >= s.from && clamped < s.to);
  if (idx === -1) idx = 3;
  const seg = V3_SEGMENTS[idx];
  const pct = idx * 25 + ((clamped - seg.from) / (seg.to - seg.from)) * 25;
  const hot = vix >= 20;
  return (
    <div className="lmv3-scale" aria-label={`Régime VIX : ${seg.label}`}>
      <div className="lmv3-scale__names">
        {V3_SEGMENTS.map((s, i) => (
          <span key={s.label} className={`lmv3-scale__name${i === idx ? ' is-active' : ''}`}>
            {s.label}
          </span>
        ))}
      </div>
      <div className="lmv3-scale__track">
        {V3_SEGMENTS.map((s) => (
          <span className="lmv3-scale__seg" key={s.label} />
        ))}
        <span
          className={`lmv3-scale__cursor${hot ? ' is-hot' : ''}`}
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="lmv3-scale__grads">
        <span style={{ left: '0%' }}>10</span>
        <span style={{ left: '25%' }}>15</span>
        <span style={{ left: '50%' }}>20</span>
        <span style={{ left: '75%' }}>27</span>
        <span style={{ left: '100%' }}>40</span>
      </div>
    </div>
  );
}

function V3Cockpit({ quotes, rate, fxBadge, macros, earnings, d5, futServed, showFut }) {
  const vix = quotes['^VIX'];
  const events = [
    ...macros.map((m) => ({ ...m, kind: 'M' })),
    ...earnings.map((e) => ({ ...e, kind: 'E', armed: true })),
  ]
    .filter((e) => {
      const d = daysUntil(e.date);
      return d >= 0 && d <= EVENT_WINDOW_DAYS;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section className="lmv3" aria-label="V3 Cockpit">
      <V3Command futServed={futServed} showFut={showFut} quotes={quotes} />

      {/* Mur central — deux colonnes serrées */}
      <div className="lmv3-wall">
        <div className="lmv3-wcol">
          <div className="lmv3-wsect">ÉTATS-UNIS</div>
          {US.map(({ sym, label }) => (
            <V3WallRow key={sym} label={label} quote={quotes[sym]} />
          ))}
          <div className="lmv3-wsect">EUROPE · ASIE</div>
          {INTL.map(({ sym, label }) => (
            <V3WallRow key={sym} label={label} quote={quotes[sym]} />
          ))}
        </div>
        <div className="lmv3-wcol">
          <div className="lmv3-wsect">
            FX &amp; TAUX <span className="lmv3-wbadge">{fxBadge}</span>
          </div>
          <div className="lmv3-wrow">
            <span className="lmv3-wrow__sym">USD/CHF</span>
            <span className="lmv3-wrow__val">{Number.isFinite(rate) ? rate.toFixed(4) : '—'}</span>
            <span className="lmv3-wrow__applied">APPLIQUÉ</span>
          </div>
          <V3WallRow label="EUR/USD" quote={quotes['EURUSD=X']} fxDecimals={4} />
          <V3WallRow label="US10Y" quote={quotes['^TNX']} fxDecimals={2} />
          <V3WallRow label="DXY" quote={quotes['DX-Y.NYB']} fxDecimals={2} />
          <div className="lmv3-wsect">MONDE</div>
          {MONDE.map(({ sym, label }) => (
            <V3WallRow key={sym} label={label} quote={quotes[sym]} />
          ))}
        </div>
      </div>

      {/* Intelligence — VIX instrument + timeline verticale */}
      <div className="lmv3-intel">
        <div className="lmv3-vix">
          <div className="lmv3-wsect">VOLATILITÉ</div>
          <div className="lmv3-vix__row">
            <span className="lmv3-vix__val">
              {Number.isFinite(vix?.price) ? vix.price.toFixed(2) : '—'}
            </span>
            <Delta v={vix?.changePercent} className="lmv3-vix__pct" />
          </div>
          <V3RegimeScale vix={vix?.price} />
          <div className="lmv3-vix__hl">
            H <b>{Number.isFinite(vix?.high) ? vix.high.toFixed(2) : '—'}</b> · L{' '}
            <b>{Number.isFinite(vix?.low) ? vix.low.toFixed(2) : '—'}</b>
            {d5 != null && (
              <>
                {' '}· Δ5J <b>~{d5 >= 0 ? '+' : '−'}{Math.abs(d5).toFixed(1)}%</b>
              </>
            )}
          </div>
        </div>
        <div className="lmv3-tl">
          <div className="lmv3-wsect">AGENDA 14 J</div>
          <div className="lmv3-tl__body">
            <div className="lmv3-tl__axis">
              {Array.from({ length: 15 }, (_, i) => (
                <span className="lmv3-tl__tick" key={i} style={{ top: `${(i / 14) * 100}%` }} />
              ))}
              {/* graduations de lecture : AUJ. (ambre = aujourd'hui) · J+7 · J+14 */}
              <span className="lmv3-tl__today" style={{ top: '0%' }} />
              <span className="lmv3-tl__grad lmv3-tl__grad--today" style={{ top: '0%' }}>AUJ.</span>
              <span className="lmv3-tl__grad" style={{ top: '50%' }}>J+7</span>
              <span className="lmv3-tl__grad" style={{ top: '100%' }}>J+14</span>
              {events.map((ev, i) => {
                const d = daysUntil(ev.date);
                const hot = d <= 2;
                const pct = Math.max(2, Math.min(98, (d / 14) * 100));
                return (
                  <span
                    key={i}
                    className={`lmv3-tl__dot lmv3-tl__dot--${ev.kind}${hot ? ' is-hot' : ''}`}
                    style={{ top: `${pct}%` }}
                  />
                );
              })}
            </div>
            <div className="lmv3-tl__items">
              {(() => {
                // anti-chevauchement : espacement mini 14 % entre items
                let lastPct = -20;
                return events.map((ev, i) => {
                  const d = daysUntil(ev.date);
                  const hot = d <= 2;
                  let pct = Math.max(2, Math.min(90, (d / 14) * 100));
                  if (pct < lastPct + 14) pct = Math.min(90, lastPct + 14);
                  lastPct = pct;
                  return (
                    <span className="lmv3-tl__item" key={i} style={{ top: `${pct}%` }}>
                      <span className="lmv3-tl__k">{ev.kind}</span>
                      <span className="lmv3-tl__name" title={ev.name}>{compactName(ev.name)}</span>
                      <span className={`lmv3-tl__eta${hot ? ' is-hot' : ''}`}>{etaLabel(d)}</span>
                      {ev.armed && hot && <span className="lmv3-armed">ARMED</span>}
                    </span>
                  );
                });
              })()}
            </div>
          </div>
          {!events.some((e) => e.kind === 'M') && (
            <div className="lmv3-tl__recap">M · macro — rien sous 14 j</div>
          )}
          {!events.some((e) => e.kind === 'E') && (
            <div className="lmv3-tl__recap">E · earnings — rien sous 14 j</div>
          )}
        </div>
      </div>
    </section>
  );
}

// ═══ Page ═══════════════════════════════════════════════════════
export default function MarketLab() {
  const { quotes } = useMarketQuotes(STATIC_FETCH_SYMBOLS);
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

  // Δ5j VIX (dérivé de la série 7 j en cache, marqué ~).
  const d5 = useMemo(() => {
    const p = sparklines['^VIX']?.prices;
    if (!p || p.length < 6) return null;
    const ref = p[p.length - 6];
    const last = p[p.length - 1];
    if (!Number.isFinite(ref) || !Number.isFinite(last) || ref === 0) return null;
    return ((last - ref) / ref) * 100;
  }, [sparklines]);

  // Sonde FUT STICKY (1.C.4) : une fois les 3 futures vus servis dans
  // cette session, le verdict reste SERVIS (un slot qui clignote est
  // pire qu'absent — la fiabilité de l'API est tranchée par la sonde
  // longue au rapport ; ceci ne gouverne que l'affichage lab).
  const futLiveNow = FUTURES_SYMBOLS.every((s) => Number.isFinite(quotes[s]?.price));
  const futSeenRef = useRef(false);
  if (futLiveNow) futSeenRef.current = true;
  const futServed = futSeenRef.current;

  const showFut = forceFut || !isRTH;

  const common = {
    quotes,
    rate,
    fxBadge,
    macros,
    earnings: earningsItems,
    d5,
    futServed,
    showFut,
  };

  return (
    <div className="lm-page">
      <header className="lm-head">
        <h1 className="lm-title">LAB · MARKET II — trois langages (1.C.4)</h1>
        <p className="lm-sub">
          A = témoin. V1 TERMINAL (mur réglé Bloomberg) · V2 DATA-VIZ (tuiles TradingView) ·
          V3 COCKPIT (instrument asymétrique). Mêmes données vives partout.
        </p>
        <div className="lm-probes">
          <span className={`lm-probe${futServed ? ' is-ok' : ' is-ko'}`}>
            FUT (ES/NQ/YM) : {futServed ? 'SERVIS (verdict sticky session)' : 'en attente du 1er train…'}
          </span>
          <span className="lm-probe is-ok">
            H/L : {['^SPX', '^NDX', '^DJI', '^RUT', '^VIX']
              .filter((s) => Number.isFinite(quotes[s]?.high))
              .map((s) => s.replace('^', ''))
              .join(' ') || 'en attente…'}
          </span>
          <span className={`lm-probe${d5 != null ? ' is-ok' : ' is-ko'}`}>
            Δ5j VIX : {d5 != null ? 'dérivable (~)' : 'indérivable — omis'}
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

      <section className="lm-variant">
        <div className="lm-variant__label">V1 · TERMINAL — le mur réglé Bloomberg</div>
        <V1Terminal {...common} />
      </section>

      <section className="lm-variant">
        <div className="lm-variant__label">V2 · DATA-VIZ — les tuiles TradingView</div>
        <V2DataViz {...common} sparklines={sparklines} />
      </section>

      <section className="lm-variant">
        <div className="lm-variant__label">V3 · COCKPIT — l'instrument asymétrique</div>
        <V3Cockpit {...common} />
      </section>
    </div>
  );
}
