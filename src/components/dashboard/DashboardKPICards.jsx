// ═══════════════════════════════════════════════════════════════
//  DASHBOARD KPI CARDS v6 — 4K refonte Phase B.4 (polish final)
//
//  Sept cards en grid 1.85fr · 1fr × 6, hauteur 240 px chacune.
//  Pattern 4 zones unifié (justify-content: space-between) :
//
//    Zone 1 (top)    : label + pill/hint top-right (accent/amber/mute)
//    Zone 2          : valeur USD (30 / 44 px) + ligne CHF (12 / 14 px)
//    Zone 3          : visuel adaptatif — sparkline / fill bar / donut /
//                      info-blocks contextuels (Day P&L, Tier, Streak)
//    Zone 4 (footer) : 2 / 3 / 4 cells avec border-right + top-border
//                      var(--text-primary) 7 % opacity
//
//  Changes Phase B.4 :
//    - Card 1 NLV   : 6-segment range avec ALL · footer 4 cells
//                     (HIGH / LOW / PEAK / ALL-TIME)
//    - Card 2 Avail : mini-sparkline trend 28 px entre value et bar
//    - Card 3-4     : sparkline 50 px, gridlines=3, overlay pill 14J / X TR
//    - Card 5 Day   : conditionnel — sparkline si activité, info-blocks
//                     MARKET / NEXT OPEN si flat market closed
//    - Card 6 Expo  : marker + label CAP au-dessus + bloc TIER ACTIF
//    - Card 7 WR    : donut 74×74, bloc STREAK, AVG W signé explicite
//
//  Brique 13 (Phase C résolu) : CASH FLR / MAX % NLV / TIER ACTIF
//    dérivés de settings.activeSniperTier via utils/sniperMeta
//    tierParams() ; RISK $ = Σ effectiveSlDollar (utils/risk, SL35).
// ═══════════════════════════════════════════════════════════════

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ruler } from 'lucide-react';
import { usePortfolioMetrics, useKPIs } from '../../hooks/usePortfolioMetrics';
import useAvailableCapital from '../../hooks/useAvailableCapital';
import useEquityHistory from '../../hooks/useEquityHistory';
import useDailyPnL from '../../hooks/useDailyPnL';
import useDailySnapshot from '../../hooks/useDailySnapshot';
import useGreeksAggregate from '../../hooks/useGreeksAggregate';
import useMarketSession from '../../hooks/useMarketSession';
import useLiveTheme from '../../hooks/useLiveTheme';
import { useClosedTrades, useOpenPositions, useSettings } from '../../store/useStore';
import { tradePnlUsd, calculateOpenPositionPnl } from '../../utils/calculations';
import { currentDrawdownPct, totalSlDollar } from '../../utils/risk';
import { tierParams } from '../../utils/sniperMeta';
import Sparkline from './Sparkline';

// Recharts est déjà code-splitté ailleurs (EquityChart, DailyPnLChart) :
// même `lazy(import('recharts'))` réutilise le même chunk côté Rollup.
const LazyRecharts = lazy(() =>
  import('recharts').then((mod) => ({ default: ({ children }) => children(mod) }))
);

// Fix racine brique 5 — marges des charts hero, partagées entre la
// config Recharts (margin / YAxis.width) et le calcul géométrique x→index
// fait dans KpiCardHero. CRITIQUE : toute divergence entre ces valeurs
// et celles passées aux composants Recharts fausse l'index calculé.
// Les YAxis sont orientées à droite → la zone plot est rognée à droite
// par MARGIN_RIGHT + YAXIS_WIDTH, à gauche par MARGIN_LEFT.
const HERO_CHART_MARGIN_LEFT = 4;
const HERO_CHART_MARGIN_RIGHT = 8;
const HERO_CHART_MARGIN_TOP = 14;
const HERO_CHART_MARGIN_BOTTOM = 4;
const HERO_CHART_YAXIS_WIDTH = 88;
const HERO_CHART_MARGINS = {
  top: HERO_CHART_MARGIN_TOP,
  right: HERO_CHART_MARGIN_RIGHT,
  bottom: HERO_CHART_MARGIN_BOTTOM,
  left: HERO_CHART_MARGIN_LEFT,
};
const HERO_CHART_PLOT_OFFSET_LEFT = HERO_CHART_MARGIN_LEFT;
const HERO_CHART_PLOT_OFFSET_RIGHT =
  HERO_CHART_MARGIN_RIGHT + HERO_CHART_YAXIS_WIDTH;

// ─── Range selector ─────────────────────────────────────────────

const RANGES = [
  { key: '5J', days: 5 },
  { key: '1M', days: 22 },
  { key: '30J', days: 30 },
  { key: '3M', days: 63 },
  { key: '1A', days: 252 },
  { key: 'ALL', days: null }, // null → toute la série
];

function RangeSelector({ value, onChange }) {
  return (
    <div className="dash-kpi-card__range" role="tablist" aria-label="Fenêtre temporelle NLV">
      {RANGES.map((r) => {
        const active = r.key === value;
        return (
          <button
            key={r.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`dash-kpi-card__range-btn${active ? ' is-active' : ''}`}
            onClick={() => onChange(r.key)}
          >
            {r.key}
          </button>
        );
      })}
    </div>
  );
}

// Brique 3 — segmented control [Équité | Drawdown], NLV uniquement.
// Réutilise volontairement les classes .dash-kpi-card__range / __range-btn :
// même langage visuel que le RangeSelector (brief). Pas de nouveau CSS.
function ViewToggle({ value, onChange, options, ariaLabel = 'Vue affichée' }) {
  return (
    <div
      className="dash-kpi-card__range dash-kpi-card__view"
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`dash-kpi-card__range-btn${active ? ' is-active' : ''}`}
            onClick={() => onChange(opt.key)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const NLV_VIEWS = [
  { key: 'equity', label: 'Équité' },
  { key: 'drawdown', label: 'Drawdown' },
];

// Brique 4 — toggle Realized.
const REALIZED_VIEWS = [
  { key: 'cumulative', label: 'Cumulé' },
  { key: 'daily', label: 'Quotidien' },
  { key: 'distribution', label: 'Distribution' },
];

// ─── Formatters ──────────────────────────────────────────────────

const fmtUsdCompact = (v) => {
  if (v == null || !Number.isFinite(v)) return '——';
  if (Math.abs(v) >= 1_000_000) {
    return `$${(v / 1_000_000).toLocaleString('de-CH', { maximumFractionDigits: 2 })}M`;
  }
  return `$${Math.round(v).toLocaleString('de-CH')}`;
};

const fmtUsdSigned = (v) => {
  if (v == null || !Number.isFinite(v)) return '——';
  if (v === 0) return '$0';
  const sign = v > 0 ? '+' : '−';
  return `${sign}$${Math.round(Math.abs(v)).toLocaleString('de-CH')}`;
};

const fmtChfLine = (chf, { signed = false } = {}) => {
  if (chf == null || !Number.isFinite(chf)) return null;
  const abs = Math.abs(chf);
  const body = abs >= 100 ? Math.round(abs).toLocaleString('de-CH') : abs.toFixed(2);
  if (chf === 0) return signed ? 'CHF +0' : 'CHF 0';
  const sign = chf < 0 ? '-' : signed ? '+' : '';
  return `CHF ${sign}${body}`;
};

const fmtPctSigned = (v, fractionDigits = 1) => {
  if (v == null || !Number.isFinite(v)) return null;
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(fractionDigits)}%`;
};

const fmtPctPlain = (v, fractionDigits = 1) => {
  if (v == null || !Number.isFinite(v)) return '——';
  return `${v.toFixed(fractionDigits)}%`;
};

const toneSign = (v) => {
  if (v == null || !Number.isFinite(v) || v === 0) return 'mute';
  return v > 0 ? 'profit' : 'loss';
};

const arrow = (v) => {
  if (v == null || !Number.isFinite(v) || v === 0) return '·';
  return v > 0 ? '▲' : '▼';
};

const clamp01Pct = (v) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));

// ─── Formatters readout / chart axes (locale de-CH, brique 2) ───
// Apostrophe milliers (de-CH) + signe moins typographique − (U+2212).
// Volontairement séparés des formatters du grand chiffre value (en-US)
// pour éviter de toucher au rendu existant du hero text.

const fmtUsdDeCH = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v < 0 ? '−' : '';
  return `${sign}$${Math.round(Math.abs(v)).toLocaleString('de-CH')}`;
};

const fmtUsdSignedDeCH = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return '$0';
  const sign = v > 0 ? '+' : '−';
  return `${sign}$${Math.round(Math.abs(v)).toLocaleString('de-CH')}`;
};

const fmtPctSignedDeCH = (v, frac = 1) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return '0.0%';
  const sign = v > 0 ? '+' : '−';
  return `${sign}${Math.abs(v).toFixed(frac)}%`;
};

const fmtDateDeCH = (iso) => {
  if (!iso || typeof iso !== 'string') return '—';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

const fmtAxisDateDeCH = (iso) => {
  if (!iso || typeof iso !== 'string') return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}.${parts[1]}`;
};

// Brique 3 — formatter axe Y vue Drawdown (toujours négatif ou 0).
const fmtAxisPctDeCH = (v) => {
  if (!Number.isFinite(v)) return '';
  if (v === 0) return '0%';
  const sign = v < 0 ? '−' : '+';
  return `${sign}${Math.abs(v).toFixed(1)}%`;
};

// Brique 5 — formatter "points" pour Δ drawdown (pas de signe %, on
// ajoute "pt" en label dans le readout).
const fmtPpSignedDeCH = (v, frac = 1) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return '0.0';
  const sign = v > 0 ? '+' : '−';
  return `${sign}${Math.abs(v).toFixed(frac)}`;
};

// Brique 5 — écart calendaire entre 2 dates ISO (YYYY-MM-DD), en jours
// entiers signés (positif si b > a). Robuste aux fuseaux (utilise UTC).
function diffDays(a, b) {
  if (!a?.date || !b?.date) return null;
  const da = new Date(`${a.date}T00:00:00Z`).getTime();
  const db = new Date(`${b.date}T00:00:00Z`).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return null;
  return Math.round((db - da) / 86400000);
}

// Brique 4 — formatter axe Y Distribution (entiers de trades).
const fmtAxisCountDeCH = (v) => {
  if (!Number.isFinite(v)) return '';
  return Math.round(v).toLocaleString('de-CH');
};

// Brique 4 — daily P&L par jour à partir de la série cumulée RANGÉE.
// daily[0] = cum[0] (cf. brief, première valeur du range = cumul brut) ;
// daily[i] = cum[i] − cum[i−1]. Conserve `cumulative` pour le readout.
function computeRealizedDailySeries(rangedCumSeries) {
  if (!Array.isArray(rangedCumSeries) || rangedCumSeries.length === 0) return [];
  return rangedCumSeries.map((p, i, arr) => ({
    date: p.date,
    value: i === 0 ? p.value : p.value - arr[i - 1].value,
    cumulative: p.value,
  }));
}

// Brique 4 — histogramme des P&L par trade clôturé.
// Bins alignés sur 0 (une borne tombe sur 0 → aucun bin ne chevauche 0).
// Largeur 150 $ par défaut (brief). Renvoie [{lo, hi, mid, count, sign}, …]
// dont mid = (lo+hi)/2, sign = 'up' si lo >= 0 sinon 'down'.
function computeDistributionBins(trades, liveRate, binWidth = 150) {
  if (!Array.isArray(trades) || trades.length === 0) return [];
  const pnls = trades
    .map((t) => tradePnlUsd(t, liveRate))
    .filter((v) => Number.isFinite(v));
  if (pnls.length === 0) return [];
  const minPnl = Math.min(...pnls);
  const maxPnl = Math.max(...pnls);
  const minBinIdx = Math.floor(minPnl / binWidth);
  // Math.floor(maxPnl/binWidth) + 1 pour couvrir le max strictement
  // (intervalle [lo, hi), maxPnl appartient au bin floor(max/bw)).
  const maxBinIdx = Math.floor(maxPnl / binWidth) + 1;
  const bins = [];
  for (let i = minBinIdx; i < maxBinIdx; i++) {
    const lo = i * binWidth;
    const hi = (i + 1) * binWidth;
    bins.push({
      lo,
      hi,
      mid: (lo + hi) / 2,
      count: 0,
      sign: lo >= 0 ? 'up' : 'down',
    });
  }
  for (const p of pnls) {
    const idx = Math.floor(p / binWidth) - minBinIdx;
    if (idx >= 0 && idx < bins.length) bins[idx].count++;
  }
  return bins;
}

// Brique 3 — drawdown underwater calculé depuis la série affichée.
// peak[i] = max(série[0..i]) ; dd[i] = (val[i] / peak[i] − 1) × 100.
// Renvoie {date, value, peak} pour que le readout puisse afficher le pic.
function computeDrawdownSeries(series) {
  if (!Array.isArray(series) || series.length === 0) return [];
  const out = new Array(series.length);
  let peak = -Infinity;
  for (let i = 0; i < series.length; i++) {
    const p = series[i];
    const v = Number(p?.value);
    if (Number.isFinite(v) && v > peak) peak = v;
    const safePeak = peak === -Infinity ? 0 : peak;
    const dd =
      safePeak !== 0 && Number.isFinite(v)
        ? (v / Math.abs(safePeak) - 1) * 100
        : 0;
    out[i] = { date: p?.date, value: dd, peak: safePeak };
  }
  return out;
}

// ─── Sub-primitives ─────────────────────────────────────────────

function KpiFooter({ cells }) {
  const cn =
    cells.length === 6
      ? 'dash-kpi-card__footer--6'
      : cells.length === 4
        ? 'dash-kpi-card__footer--4'
        : cells.length === 3
          ? 'dash-kpi-card__footer--3'
          : 'dash-kpi-card__footer--2';
  return (
    <footer className={`dash-kpi-card__footer ${cn}`}>
      {cells.map((c, i) => (
        <div key={c.label || i} className="dash-kpi-card__cell">
          <span className="dash-kpi-card__cell-label">{c.label}</span>
          <span
            className={`dash-kpi-card__cell-value${c.tone ? ` dash-kpi-card__cell-value--${c.tone}` : ''}`}
            title={c.title || undefined}
          >
            {c.value}
          </span>
        </div>
      ))}
    </footer>
  );
}

function Pill({ tone = 'mute', children }) {
  return (
    <span className={`dash-kpi-card__pill dash-kpi-card__pill--${tone}`}>{children}</span>
  );
}

function InfoBlock({ tone = 'mute', label, value, valueTone }) {
  return (
    <div className={`dash-kpi-card__info-block dash-kpi-card__info-block--${tone}`}>
      <span className="dash-kpi-card__info-label">{label}</span>
      <span
        className={`dash-kpi-card__info-value${valueTone ? ` dash-kpi-card__info-value--${valueTone}` : ''}`}
      >
        {value}
      </span>
    </div>
  );
}

function FillBar({ pct, color = 'accent', restColor }) {
  const width = clamp01Pct(pct);
  return (
    <div className="dash-kpi-card__bar">
      <div
        className={`dash-kpi-card__bar-fill dash-kpi-card__bar-fill--${color}`}
        style={{ width: `${width}%` }}
        aria-hidden="true"
      />
      {restColor ? <div className="dash-kpi-card__bar-rest" aria-hidden="true" /> : null}
    </div>
  );
}

function FillBarWithMarker({ pct, color = 'amber', markerPct }) {
  const width = clamp01Pct(pct);
  const markerPos = clamp01Pct(markerPct);
  return (
    <div className="dash-kpi-card__bar dash-kpi-card__bar--with-marker">
      <span
        className="dash-kpi-card__bar-cap-label"
        style={{ left: `${markerPos}%` }}
        aria-hidden="true"
      >
        CAP
      </span>
      <div
        className={`dash-kpi-card__bar-fill dash-kpi-card__bar-fill--${color}`}
        style={{ width: `${width}%` }}
        aria-hidden="true"
      />
      <span
        className="dash-kpi-card__bar-marker"
        style={{ left: `${markerPos}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

function WinRateDonut({ winRate, profitFactor }) {
  const r = 28;
  const C = 2 * Math.PI * r;
  const wrFraction = clamp01Pct(winRate ?? 0) / 100;
  const winPortion = C * wrFraction;
  const pfLabel =
    profitFactor === Infinity
      ? '∞'
      : Number.isFinite(profitFactor)
        ? profitFactor.toFixed(2)
        : '——';
  return (
    <svg
      className="dash-kpi-donut"
      width="74"
      height="74"
      viewBox="0 0 74 74"
      role="img"
      aria-label={`Win rate ${Number.isFinite(winRate) ? `${winRate.toFixed(1)} pourcent` : 'inconnu'}, profit factor ${pfLabel}`}
    >
      <circle className="dash-kpi-donut__bg" cx="37" cy="37" r={r} fill="none" strokeWidth="7" />
      <circle
        className="dash-kpi-donut__fg"
        cx="37"
        cy="37"
        r={r}
        fill="none"
        strokeWidth="7"
        strokeDasharray={`${winPortion.toFixed(2)} ${C.toFixed(2)}`}
        strokeLinecap="butt"
        transform="rotate(-90 37 37)"
      />
      <text className="dash-kpi-donut__label" x="37" y="35" textAnchor="middle">
        PF
      </text>
      <text className="dash-kpi-donut__value" x="37" y="49" textAnchor="middle">
        {pfLabel}
      </text>
    </svg>
  );
}

// ─── Brique 6 — éléments de densité hero (gauge + bande forme) ──
//
// Posés dans __hero-mid, entre __hero-text et __hero-readout. Statique :
// pas de hover Recharts, pas d'index. Empile en pleine largeur, fin.
// Sources strictement déjà présentes côté composant (cf. brief brique 6).

function HeroExposureGauge({
  exposureUsd,
  exposurePctNlv,
  availableUsd,
  capPct,
}) {
  const fillPct = clamp01Pct(exposurePctNlv);
  const capPos = clamp01Pct(capPct);
  const hasFill = Number.isFinite(exposurePctNlv);
  const hasCap = Number.isFinite(capPct);
  return (
    <div className="dash-kpi-card__hero-density">
      <div className="dash-kpi-card__hero-density-head">
        <span className="dash-kpi-card__hero-density-title">EXPOSITION</span>
        <span className="dash-kpi-card__hero-density-detail">
          <span className="dash-kpi-card__hero-density-label">Déployé</span>
          <span className="dash-kpi-card__hero-density-value">
            {fmtUsdDeCH(exposureUsd)}
          </span>
          <span className="dash-kpi-card__hero-density-sep">·</span>
          <span className="dash-kpi-card__hero-density-value dash-kpi-card__hero-density-value--accent">
            {hasFill ? `${exposurePctNlv.toFixed(1)}%` : '——'}
          </span>
          <span className="dash-kpi-card__hero-density-label">NLV</span>
          <span className="dash-kpi-card__hero-density-sep">·</span>
          <span className="dash-kpi-card__hero-density-label">disponible</span>
          <span className="dash-kpi-card__hero-density-value">
            {fmtUsdDeCH(availableUsd)}
          </span>
        </span>
      </div>
      <div className="dash-kpi-card__hero-gauge">
        <div className="dash-kpi-card__hero-gauge-track" aria-hidden="true">
          <div
            className="dash-kpi-card__hero-gauge-fill"
            style={{ width: `${fillPct}%` }}
          />
          {hasCap ? (
            <span
              className="dash-kpi-card__hero-gauge-marker"
              style={{ left: `${capPos}%` }}
            />
          ) : null}
          {hasCap ? (
            <span
              className="dash-kpi-card__hero-gauge-cap"
              style={{ left: `${capPos}%` }}
            >
              MAX {Math.round(capPos)}%
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function HeroFormBand({ trades, liveRate, currentStreak, max = 18 }) {
  const recent = useMemo(() => {
    if (!Array.isArray(trades) || trades.length === 0) return [];
    const sorted = trades
      .slice()
      .filter((t) => t.do || t.di)
      .sort((a, b) => (a.do || a.di || '').localeCompare(b.do || b.di || ''));
    return sorted.slice(-max).map((t) => {
      const pnl = tradePnlUsd(t, liveRate || 1);
      return {
        date: t.do || t.di,
        pnl,
        sign: pnl >= 0 ? 'up' : 'down',
      };
    });
  }, [trades, liveRate, max]);

  const n = recent.length;
  const nbG = recent.filter((r) => r.pnl >= 0).length;
  const nbP = n - nbG;

  // Streak trailing : on privilégie la métrique globale (`currentStreak`)
  // — c'est la même par construction tant que le streak ≤ n. Fallback
  // dérivé du sous-ensemble visible si la métrique manque.
  const fallbackStreak = useMemo(() => {
    if (n === 0) return 0;
    const lastSign = recent[n - 1].sign;
    let k = 0;
    for (let i = n - 1; i >= 0; i--) {
      if (recent[i].sign === lastSign) k++;
      else break;
    }
    return lastSign === 'up' ? k : -k;
  }, [recent, n]);
  const streak = Number.isFinite(currentStreak) ? currentStreak : fallbackStreak;

  // Longueur de la série courante VISIBLE dans la bande (peut être < |streak|
  // si le streak global déborde le sous-ensemble n). Sert au surlignage.
  const streakInWindow = useMemo(() => {
    if (n === 0) return 0;
    const lastSign = recent[n - 1].sign;
    let k = 0;
    for (let i = n - 1; i >= 0; i--) {
      if (recent[i].sign === lastSign) k++;
      else break;
    }
    return k;
  }, [recent, n]);

  const arrowChar = streak > 0 ? '▲' : streak < 0 ? '▼' : '·';
  const streakTone = streak > 0 ? 'profit' : streak < 0 ? 'loss' : 'mute';

  return (
    <div className="dash-kpi-card__hero-density">
      <div className="dash-kpi-card__hero-density-head">
        <span className="dash-kpi-card__hero-density-title">
          {`FORME · ${n} ${n > 1 ? 'DERNIERS TRADES' : 'DERNIER TRADE'}`}
        </span>
        {n > 0 ? (
          <span className="dash-kpi-card__hero-density-detail">
            <span className="dash-kpi-card__hero-density-value dash-kpi-card__hero-density-value--profit">
              {nbG} G
            </span>
            <span className="dash-kpi-card__hero-density-sep">/</span>
            <span className="dash-kpi-card__hero-density-value dash-kpi-card__hero-density-value--loss">
              {nbP} P
            </span>
            <span className="dash-kpi-card__hero-density-sep">·</span>
            <span className="dash-kpi-card__hero-density-label">série</span>
            <span
              className={`dash-kpi-card__hero-density-value dash-kpi-card__hero-density-value--${streakTone}`}
            >
              {arrowChar}
              {Math.abs(streak)}
            </span>
          </span>
        ) : null}
      </div>
      {n > 0 ? (
        <div
          className="dash-kpi-card__hero-form-band"
          role="img"
          aria-label={`Forme — ${nbG} gagnants et ${nbP} perdants sur les ${n} derniers trades`}
        >
          {recent.map((t, i) => {
            const isStreak = i >= n - streakInWindow;
            return (
              <span
                key={`${t.date}-${i}`}
                className={`dash-kpi-card__hero-form-tick dash-kpi-card__hero-form-tick--${t.sign}${isStreak ? ' is-streak' : ''}`}
                title={`${fmtDateDeCH(t.date)} · ${fmtUsdSignedDeCH(t.pnl)}`}
                aria-hidden="true"
              />
            );
          })}
        </div>
      ) : (
        <div className="dash-kpi-card__hero-form-band-empty" aria-hidden="true" />
      )}
    </div>
  );
}

// ─── Derivations ────────────────────────────────────────────────

function useRealizedAllTimeSeries(closedTrades, liveRate) {
  return useMemo(() => {
    if (!closedTrades || closedTrades.length === 0) return [];
    const sorted = closedTrades
      .slice()
      .filter((t) => t.do || t.di)
      .sort((a, b) => (a.do || a.di || '').localeCompare(b.do || b.di || ''));
    const byDate = new Map();
    for (const t of sorted) {
      const d = t.do || t.di;
      const pnl = tradePnlUsd(t, liveRate);
      byDate.set(d, (byDate.get(d) || 0) + pnl);
    }
    let cum = 0;
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, pnl]) => {
        cum += pnl;
        return { date, value: cum };
      });
  }, [closedTrades, liveRate]);
}

function useOpenPositionsStats(openPositions, liveRate) {
  return useMemo(() => {
    let totalPnl = 0;
    let totalCost = 0;
    let best = null;
    let worst = null;
    for (const pos of openPositions || []) {
      const r = calculateOpenPositionPnl(pos, liveRate);
      totalPnl += r.unrealizedPnlUsd;
      totalCost += Math.abs(r.costBasisUsd);
      const entry = { ticker: pos.tk, pnl: r.unrealizedPnlUsd };
      if (!best || r.unrealizedPnlUsd > best.pnl) best = entry;
      if (!worst || r.unrealizedPnlUsd < worst.pnl) worst = entry;
    }
    const pct = totalCost > 0 ? (totalPnl / totalCost) * 100 : null;
    return { totalPnl, totalCost, pct, best, worst };
  }, [openPositions, liveRate]);
}

function useClosedExtremes(closedTrades, liveRate) {
  return useMemo(() => {
    if (!closedTrades || closedTrades.length === 0) return { best: null, worst: null };
    let best = { ticker: '', pnl: -Infinity };
    let worst = { ticker: '', pnl: Infinity };
    for (const t of closedTrades) {
      const pnl = tradePnlUsd(t, liveRate);
      if (pnl > best.pnl) best = { ticker: t.tk, pnl };
      if (pnl < worst.pnl) worst = { ticker: t.tk, pnl };
    }
    return { best, worst };
  }, [closedTrades, liveRate]);
}

function todayPnlUsd(dailyPnL) {
  if (!Array.isArray(dailyPnL) || dailyPnL.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const hit = dailyPnL.find((d) => d.date === today);
  return hit ? hit.dailyPnl : 0;
}

// ─── Readouts hero (brique 2) ─────────────────────────────────
//
// Pilote la ligne `__hero-readout` au-dessus du chart. Reçoit le point
// courant (= survolé si curseur sur graphe, sinon dernier point), la
// série complète et un flag `isHover` (pour réagir si besoin).

function ReadoutBit({ kind = 'text', tone, children }) {
  const cls = `dash-kpi-card__hero-readout-${kind}${tone ? ` dash-kpi-card__hero-readout-${kind}--${tone}` : ''}`;
  return <span className={cls}>{children}</span>;
}

function renderNlvReadout(point, all) {
  if (!point) return null;
  const first = all?.[0]?.value;
  const peak = all && all.length > 0 ? Math.max(...all.map((p) => p.value)) : null;
  const deltaStartPct =
    Number.isFinite(first) && Math.abs(first) > 0
      ? ((point.value - first) / Math.abs(first)) * 100
      : null;
  const deltaPeakPct =
    Number.isFinite(peak) && Math.abs(peak) > 0
      ? ((point.value - peak) / Math.abs(peak)) * 100
      : null;
  return (
    <>
      <ReadoutBit kind="date">{fmtDateDeCH(point.date)}</ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      <ReadoutBit kind="value">{fmtUsdDeCH(point.value)}</ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      <ReadoutBit kind="label">vs début</ReadoutBit>
      <ReadoutBit kind="delta" tone={toneSign(deltaStartPct)}>
        {fmtPctSignedDeCH(deltaStartPct)}
      </ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      <ReadoutBit kind="label">vs pic</ReadoutBit>
      <ReadoutBit kind="delta" tone={toneSign(deltaPeakPct)}>
        {fmtPctSignedDeCH(deltaPeakPct)}
      </ReadoutBit>
    </>
  );
}

// ─── Brique 5 — readouts du mode Mesure (A→B) ─────────────────
//
// Un par vue temporelle. Le signe des Δ suit l'ordre des clics (B−A) ;
// le nombre de jours et la somme Quotidien s'expriment en valeur
// absolue / sur [min(idxA,idxB), max] (cf. brief).

function renderMeasureEquityReadout(a, b) {
  if (!a || !b) return null;
  const days = diffDays(a, b);
  const absDays = days != null ? Math.abs(days) : null;
  const deltaUsd = b.value - a.value;
  const deltaPct =
    Number.isFinite(a.value) && Math.abs(a.value) > 0
      ? (deltaUsd / Math.abs(a.value)) * 100
      : null;
  const annPct =
    absDays != null && absDays > 0 && a.value > 0 && b.value > 0
      ? (Math.pow(b.value / a.value, 365 / absDays) - 1) * 100
      : null;
  return (
    <>
      <ReadoutBit kind="date">{fmtDateDeCH(a.date)}</ReadoutBit>
      <ReadoutBit kind="label">→</ReadoutBit>
      <ReadoutBit kind="date">{fmtDateDeCH(b.date)}</ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      <ReadoutBit kind="value" tone={toneSign(deltaUsd)}>
        {fmtUsdSignedDeCH(deltaUsd)}
      </ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      <ReadoutBit kind="delta" tone={toneSign(deltaPct)}>
        {fmtPctSignedDeCH(deltaPct)}
      </ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      <ReadoutBit kind="value">{absDays != null ? absDays : '—'}</ReadoutBit>
      <ReadoutBit kind="label">j</ReadoutBit>
      {annPct != null ? (
        <>
          <ReadoutBit kind="sep">·</ReadoutBit>
          <ReadoutBit kind="label">ann</ReadoutBit>
          <ReadoutBit kind="delta" tone={toneSign(annPct)}>
            {fmtPctSignedDeCH(annPct)}
          </ReadoutBit>
        </>
      ) : null}
    </>
  );
}

function renderMeasureDrawdownReadout(a, b) {
  if (!a || !b) return null;
  const days = diffDays(a, b);
  const absDays = days != null ? Math.abs(days) : null;
  const deltaPt = b.value - a.value;
  return (
    <>
      <ReadoutBit kind="date">{fmtDateDeCH(a.date)}</ReadoutBit>
      <ReadoutBit kind="label">→</ReadoutBit>
      <ReadoutBit kind="date">{fmtDateDeCH(b.date)}</ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      <ReadoutBit kind="value" tone={toneSign(deltaPt)}>
        {fmtPpSignedDeCH(deltaPt)}
      </ReadoutBit>
      <ReadoutBit kind="label">pt</ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      <ReadoutBit kind="value">{absDays != null ? absDays : '—'}</ReadoutBit>
      <ReadoutBit kind="label">j</ReadoutBit>
    </>
  );
}

function renderMeasureCumulativeReadout(a, b) {
  if (!a || !b) return null;
  const days = diffDays(a, b);
  const absDays = days != null ? Math.abs(days) : null;
  const deltaUsd = b.value - a.value;
  const perDay = absDays != null && absDays > 0 ? deltaUsd / absDays : null;
  return (
    <>
      <ReadoutBit kind="date">{fmtDateDeCH(a.date)}</ReadoutBit>
      <ReadoutBit kind="label">→</ReadoutBit>
      <ReadoutBit kind="date">{fmtDateDeCH(b.date)}</ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      <ReadoutBit kind="value" tone={toneSign(deltaUsd)}>
        {fmtUsdSignedDeCH(deltaUsd)}
      </ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      <ReadoutBit kind="value">{absDays != null ? absDays : '—'}</ReadoutBit>
      <ReadoutBit kind="label">j</ReadoutBit>
      {perDay != null ? (
        <>
          <ReadoutBit kind="sep">·</ReadoutBit>
          <ReadoutBit kind="delta" tone={toneSign(perDay)}>
            {fmtUsdSignedDeCH(perDay)}
          </ReadoutBit>
          <ReadoutBit kind="label">/j</ReadoutBit>
        </>
      ) : null}
    </>
  );
}

function renderMeasureDailyReadout(a, b, data) {
  if (!a || !b || !Array.isArray(data)) return null;
  const idxA = data.findIndex((p) => p?.date === a.date);
  const idxB = data.findIndex((p) => p?.date === b.date);
  if (idxA < 0 || idxB < 0) return null;
  const lo = Math.min(idxA, idxB);
  const hi = Math.max(idxA, idxB);
  let sum = 0;
  for (let i = lo; i <= hi; i++) {
    const v = Number(data[i]?.value);
    if (Number.isFinite(v)) sum += v;
  }
  const count = hi - lo + 1;
  const mean = count > 0 ? sum / count : null;
  return (
    <>
      <ReadoutBit kind="date">{fmtDateDeCH(a.date)}</ReadoutBit>
      <ReadoutBit kind="label">→</ReadoutBit>
      <ReadoutBit kind="date">{fmtDateDeCH(b.date)}</ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      <ReadoutBit kind="label">somme</ReadoutBit>
      <ReadoutBit kind="value" tone={toneSign(sum)}>
        {fmtUsdSignedDeCH(sum)}
      </ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      <ReadoutBit kind="value">{count}</ReadoutBit>
      <ReadoutBit kind="label">{count > 1 ? 'jours' : 'jour'}</ReadoutBit>
      {mean != null ? (
        <>
          <ReadoutBit kind="sep">·</ReadoutBit>
          <ReadoutBit kind="delta" tone={toneSign(mean)}>
            {fmtUsdSignedDeCH(mean)}
          </ReadoutBit>
          <ReadoutBit kind="label">/j</ReadoutBit>
        </>
      ) : null}
    </>
  );
}

// Brique 4 — readout vue Quotidien (Realized).
// {date} · {P&L jour $ signé, vert/rouge} ce jour · {cumulé $ signé} cumulé
function renderRealizedDailyReadout(point) {
  if (!point) return null;
  const day = point.value;
  const cum = point.cumulative;
  return (
    <>
      <ReadoutBit kind="date">{fmtDateDeCH(point.date)}</ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      <ReadoutBit kind="value" tone={toneSign(day)}>
        {fmtUsdSignedDeCH(day)}
      </ReadoutBit>
      <ReadoutBit kind="label">ce jour</ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      <ReadoutBit kind="delta" tone={toneSign(cum)}>
        {fmtUsdSignedDeCH(cum)}
      </ReadoutBit>
      <ReadoutBit kind="label">cumulé</ReadoutBit>
    </>
  );
}

// Brique 4 — readout vue Distribution (Realized).
// {lo $} à {hi $} · {n} trades · sur {total} total
// Le total all-time est rappelé en queue pour matérialiser le "N trades"
// que demande le brief (la Distribution n'est pas bornée par le range).
function renderDistributionReadout(point, bins) {
  if (!point) return null;
  const total = Array.isArray(bins)
    ? bins.reduce((s, b) => s + (b?.count || 0), 0)
    : 0;
  return (
    <>
      <ReadoutBit kind="date">{fmtUsdDeCH(point.lo)}</ReadoutBit>
      <ReadoutBit kind="label">à</ReadoutBit>
      <ReadoutBit kind="date">{fmtUsdDeCH(point.hi)}</ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      <ReadoutBit kind="value" tone={point.sign === 'up' ? 'profit' : 'loss'}>
        {fmtAxisCountDeCH(point.count)}
      </ReadoutBit>
      <ReadoutBit kind="label">{point.count > 1 ? 'trades' : 'trade'}</ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      <ReadoutBit kind="label">sur</ReadoutBit>
      <ReadoutBit kind="delta" tone="mute">
        {fmtAxisCountDeCH(total)}
      </ReadoutBit>
      <ReadoutBit kind="label">total</ReadoutBit>
    </>
  );
}

// Brique 3 — readout vue Drawdown (NLV uniquement).
// {date} · {dd% signé, rouge si <0} · sous le pic ({pic $})
function renderDrawdownReadout(point) {
  if (!point) return null;
  const dd = point.value;
  const peak = point.peak;
  return (
    <>
      <ReadoutBit kind="date">{fmtDateDeCH(point.date)}</ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      <ReadoutBit kind="value" tone={toneSign(dd)}>
        {fmtPctSignedDeCH(dd, 2)}
      </ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      <ReadoutBit kind="label">sous le pic</ReadoutBit>
      <ReadoutBit kind="delta" tone="mute">
        ({Number.isFinite(peak) ? fmtUsdDeCH(peak) : '—'})
      </ReadoutBit>
    </>
  );
}

function renderRealizedReadout(point, all) {
  if (!point) return null;
  const idx = Array.isArray(all)
    ? all.findIndex((p) => p.date === point.date)
    : -1;
  const prev = idx > 0 ? all[idx - 1].value : null;
  const dayPnl = prev != null ? point.value - prev : null;
  return (
    <>
      <ReadoutBit kind="date">{fmtDateDeCH(point.date)}</ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      <ReadoutBit kind="value" tone={toneSign(point.value)}>
        {fmtUsdSignedDeCH(point.value)}
      </ReadoutBit>
      <ReadoutBit kind="label">cumulé</ReadoutBit>
      <ReadoutBit kind="sep">·</ReadoutBit>
      {dayPnl != null ? (
        <>
          <ReadoutBit kind="delta" tone={toneSign(dayPnl)}>
            {fmtUsdSignedDeCH(dayPnl)}
          </ReadoutBit>
          <ReadoutBit kind="label">ce jour</ReadoutBit>
        </>
      ) : (
        <ReadoutBit kind="label">— ce jour</ReadoutBit>
      )}
    </>
  );
}

// ─── HeroAreaChart (brique 2) ──────────────────────────────────
//
// Recharts AreaChart pleine largeur pour la zone graphique des 2 cartes
// hero. Source de données INCHANGÉE (alimenté avec la même série que
// le Sparkline précédent). Reporte le point survolé via onActiveChange
// pour piloter __hero-readout (lecture point-par-point).
//
// Pattern Recharts idiomatique :
//   - ComposedChart.onMouseMove → state.activePayload[0].payload
//   - Tooltip content={() => null} pour avoir le cursor sans bulle
//   - Couleurs via var(--*) du theme : le SVG inline hérite des
//     CSS custom properties, donc le theme switch est instantané.

function HeroAreaChart({
  data,
  withZeroBaseline,
  chartId,
  onActiveChange,
  measureADate = null,
  measureBDate = null,
  measureLocked = false,
  tone = 'up', // brique 3 — 'up' = vert (équité), 'down' = rouge (drawdown)
  yFormatter = fmtUsdDeCH,
  showPeakLine = true,
  baseValue, // Recharts Area.baseValue ('auto' | number) — undefined = défaut Recharts
  yDomain = ['dataMin', 'dataMax'],
}) {
  const T = useLiveTheme();
  const peak = useMemo(() => {
    if (!data || data.length === 0) return null;
    return Math.max(...data.map((p) => p.value));
  }, [data]);

  if (!data || data.length < 2) {
    return <div className="dash-kpi-card__hero-chart-empty" aria-hidden="true" />;
  }

  const lineColor = tone === 'down' ? 'var(--pnl-down)' : 'var(--pnl-up)';
  const gradId = `heroGrad-${chartId || 'x'}-${tone}`;

  // Brique 14 (C) — la timeline peut porter plusieurs points le même
  // jour (trade + cash flow) ⇒ l'axe catégoriel dupliquait les ticks
  // (« 30.03 30.03 »). Ticks explicites dédupliqués par date.
  const xTicks = [...new Set(data.map((p) => p.date))];

  return (
    <Suspense
      fallback={<div className="dash-kpi-card__hero-chart-empty" aria-hidden="true" />}
    >
      <LazyRecharts>
        {(R) => (
          <R.ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <R.ComposedChart data={data} margin={HERO_CHART_MARGINS}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <R.CartesianGrid
                stroke="var(--line-hairline)"
                strokeDasharray="0"
                vertical={false}
                horizontal
              />
              <R.XAxis
                dataKey="date"
                stroke="var(--ink-mute)"
                tick={{ fontFamily: T.fonts.mono, fontSize: 15, fill: 'var(--ink-mute)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={fmtAxisDateDeCH}
                ticks={xTicks}
                minTickGap={42}
                height={28}
              />
              <R.YAxis
                orientation="right"
                stroke="var(--ink-mute)"
                tick={{ fontFamily: T.fonts.mono, fontSize: 15, fill: 'var(--ink-mute)' }}
                axisLine={false}
                tickLine={false}
                width={HERO_CHART_YAXIS_WIDTH}
                tickFormatter={yFormatter}
                tickCount={5}
                domain={yDomain}
              />
              {withZeroBaseline ? (
                <R.ReferenceLine
                  y={0}
                  stroke="var(--line-emphasis)"
                  strokeDasharray="2 3"
                />
              ) : null}
              {showPeakLine && Number.isFinite(peak) ? (
                <R.ReferenceLine
                  y={peak}
                  stroke="var(--line-emphasis)"
                  strokeDasharray="3 3"
                  ifOverflow="extendDomain"
                  label={{
                    value: `PIC ${yFormatter(peak)}`,
                    position: 'insideTopLeft',
                    fill: 'var(--ink-mute)',
                    fontFamily: T.fonts.mono,
                    fontSize: 15,
                    offset: 4,
                  }}
                />
              ) : null}
              <R.Area
                dataKey="value"
                type="monotone"
                fill={`url(#${gradId})`}
                stroke={lineColor}
                strokeWidth={2}
                baseValue={baseValue}
                isAnimationActive={false}
                activeDot={{
                  r: 4,
                  fill: lineColor,
                  stroke: 'var(--qc-bg-surface)',
                  strokeWidth: 2,
                }}
              />
              {measureADate && measureBDate ? (
                <R.ReferenceArea
                  x1={measureADate}
                  x2={measureBDate}
                  fill="var(--accent-amber)"
                  fillOpacity={0.12}
                  stroke="none"
                  ifOverflow="visible"
                />
              ) : null}
              {measureADate ? (
                <R.ReferenceLine
                  x={measureADate}
                  stroke="var(--accent-amber)"
                  strokeWidth={2}
                  ifOverflow="visible"
                />
              ) : null}
              {measureBDate ? (
                <R.ReferenceLine
                  x={measureBDate}
                  stroke="var(--accent-amber)"
                  strokeWidth={2}
                  strokeDasharray={measureLocked ? '0' : '3 3'}
                  ifOverflow="visible"
                />
              ) : null}
              <R.Tooltip
                content={() => null}
                cursor={{ stroke: 'var(--line-emphasis)', strokeDasharray: '2 3' }}
                isAnimationActive={false}
              />
            </R.ComposedChart>
          </R.ResponsiveContainer>
        )}
      </LazyRecharts>
    </Suspense>
  );
}

// ─── HeroBarChart — vue Quotidien Realized (brique 4) ──────────
//
// Barres P&L par jour, couleur par signe. Réutilise le même style
// d'axes / gridlines / cursor que HeroAreaChart pour rester cohérent
// visuellement entre les vues du toggle.

function HeroBarChart({
  data,
  chartId,
  onActiveChange,
  measureADate = null,
  measureBDate = null,
  measureLocked = false,
  xDataKey = 'date',
  yDataKey = 'value',
  xFormatter = fmtAxisDateDeCH,
  yFormatter = fmtUsdDeCH,
  positiveColor = 'var(--pnl-up)',
  negativeColor = 'var(--pnl-down)',
}) {
  const T = useLiveTheme();
  if (!data || data.length === 0) {
    return <div className="dash-kpi-card__hero-chart-empty" aria-hidden="true" />;
  }
  return (
    <Suspense
      fallback={<div className="dash-kpi-card__hero-chart-empty" aria-hidden="true" />}
    >
      <LazyRecharts>
        {(R) => (
          <R.ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <R.BarChart
              data={data}
              margin={HERO_CHART_MARGINS}
              barCategoryGap="20%"
            >
              <R.CartesianGrid
                stroke="var(--line-hairline)"
                strokeDasharray="0"
                vertical={false}
                horizontal
              />
              <R.XAxis
                dataKey={xDataKey}
                stroke="var(--ink-mute)"
                tick={{ fontFamily: T.fonts.mono, fontSize: 15, fill: 'var(--ink-mute)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={xFormatter}
                minTickGap={42}
                height={28}
              />
              <R.YAxis
                orientation="right"
                stroke="var(--ink-mute)"
                tick={{ fontFamily: T.fonts.mono, fontSize: 15, fill: 'var(--ink-mute)' }}
                axisLine={false}
                tickLine={false}
                width={HERO_CHART_YAXIS_WIDTH}
                tickFormatter={yFormatter}
                tickCount={5}
              />
              <R.ReferenceLine
                y={0}
                stroke="var(--line-emphasis)"
                strokeDasharray="2 3"
              />
              <R.Bar dataKey={yDataKey} isAnimationActive={false}>
                {data.map((d, i) => (
                  <R.Cell
                    key={`${chartId || 'b'}-${i}`}
                    fill={(d?.[yDataKey] ?? 0) >= 0 ? positiveColor : negativeColor}
                  />
                ))}
              </R.Bar>
              {measureADate && measureBDate ? (
                <R.ReferenceArea
                  x1={measureADate}
                  x2={measureBDate}
                  fill="var(--accent-amber)"
                  fillOpacity={0.12}
                  stroke="none"
                  ifOverflow="visible"
                />
              ) : null}
              {measureADate ? (
                <R.ReferenceLine
                  x={measureADate}
                  stroke="var(--accent-amber)"
                  strokeWidth={2}
                  ifOverflow="visible"
                />
              ) : null}
              {measureBDate ? (
                <R.ReferenceLine
                  x={measureBDate}
                  stroke="var(--accent-amber)"
                  strokeWidth={2}
                  strokeDasharray={measureLocked ? '0' : '3 3'}
                  ifOverflow="visible"
                />
              ) : null}
              <R.Tooltip
                content={() => null}
                cursor={{ fill: 'var(--line-hairline)' }}
                isAnimationActive={false}
              />
            </R.BarChart>
          </R.ResponsiveContainer>
        )}
      </LazyRecharts>
    </Suspense>
  );
}

// ─── HeroHistogram — vue Distribution Realized (brique 4) ──────
//
// Axe X numérique (montants $), axe Y entiers (count), bins de largeur
// fixe alignés sur 0. Marqueurs verticaux : break-even (0) + expectancy
// (amber pointillés). Le hover renvoie le bin survolé (lo/hi/count/sign).

function HeroHistogram({
  data,
  chartId,
  onActiveChange,
  expectancy,
  binWidth = 150,
}) {
  const T = useLiveTheme();
  if (!data || data.length === 0) {
    return <div className="dash-kpi-card__hero-chart-empty" aria-hidden="true" />;
  }
  const xMin = data[0].lo;
  const xMax = data[data.length - 1].hi;
  // Ticks tous les 2 bins pour ne pas saturer l'axe X.
  const tickStep = binWidth * Math.max(1, Math.ceil(data.length / 6));
  const ticks = [];
  for (let v = Math.ceil(xMin / tickStep) * tickStep; v <= xMax; v += tickStep) {
    ticks.push(v);
  }
  if (ticks[0] !== xMin) ticks.unshift(xMin);
  if (ticks[ticks.length - 1] !== xMax) ticks.push(xMax);
  return (
    <Suspense
      fallback={<div className="dash-kpi-card__hero-chart-empty" aria-hidden="true" />}
    >
      <LazyRecharts>
        {(R) => (
          <R.ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <R.BarChart
              data={data}
              margin={{ top: 14, right: 8, bottom: 4, left: 4 }}
              onMouseMove={(state) => {
                if (state?.isTooltipActive && state.activePayload?.[0]?.payload) {
                  onActiveChange?.(state.activePayload[0].payload);
                }
              }}
              onMouseLeave={() => onActiveChange?.(null)}
            >
              <R.CartesianGrid
                stroke="var(--line-hairline)"
                strokeDasharray="0"
                vertical={false}
                horizontal
              />
              <R.XAxis
                type="number"
                dataKey="mid"
                stroke="var(--ink-mute)"
                tick={{ fontFamily: T.fonts.mono, fontSize: 15, fill: 'var(--ink-mute)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={fmtUsdDeCH}
                domain={[xMin, xMax]}
                ticks={ticks}
                height={28}
                allowDataOverflow={false}
              />
              <R.YAxis
                orientation="right"
                stroke="var(--ink-mute)"
                tick={{ fontFamily: T.fonts.mono, fontSize: 15, fill: 'var(--ink-mute)' }}
                axisLine={false}
                tickLine={false}
                width={64}
                tickFormatter={fmtAxisCountDeCH}
                tickCount={4}
                allowDecimals={false}
              />
              <R.ReferenceLine
                x={0}
                stroke="var(--line-emphasis)"
                strokeDasharray="2 3"
              />
              {Number.isFinite(expectancy) ? (
                <R.ReferenceLine
                  x={expectancy}
                  stroke="var(--accent-amber)"
                  strokeDasharray="3 3"
                  label={{
                    value: `moy ${fmtUsdSignedDeCH(expectancy)}`,
                    position: 'insideTopRight',
                    fill: 'var(--accent-amber)',
                    fontFamily: T.fonts.mono,
                    fontSize: 15,
                    offset: 4,
                  }}
                />
              ) : null}
              <R.Bar dataKey="count" isAnimationActive={false}>
                {data.map((d, i) => (
                  <R.Cell
                    key={`${chartId || 'h'}-${i}`}
                    fill={d.sign === 'up' ? 'var(--pnl-up)' : 'var(--pnl-down)'}
                  />
                ))}
              </R.Bar>
              <R.Tooltip
                content={() => null}
                cursor={{ fill: 'var(--line-hairline)' }}
                isAnimationActive={false}
              />
            </R.BarChart>
          </R.ResponsiveContainer>
        )}
      </LazyRecharts>
    </Suspense>
  );
}

// Brique 4 — dispatch chart selon `kind` ('area' default, 'bar', 'histogram').
// Brique 5 — `extraProps` propage les hooks de mesure (onPointClick,
// measureADate/measureBDate/measureLocked) aux composants temporels.
// L'Histogram (Distribution, axe X numérique) reçoit aussi les
// extraProps mais ses props mesure sont ignorées (pas de mesure
// possible sur axe non temporel).
function renderHeroChart(chart, extraProps = {}) {
  if (!chart) return null;
  // eslint-disable-next-line no-unused-vars
  const { kind = 'area', renderReadout, renderMeasureReadout, ...chartProps } = chart;
  if (kind === 'bar') {
    return <HeroBarChart {...chartProps} {...extraProps} />;
  }
  if (kind === 'histogram') {
    return <HeroHistogram {...chartProps} {...extraProps} />;
  }
  return <HeroAreaChart {...chartProps} {...extraProps} />;
}

// ─── Card shells ────────────────────────────────────────────────

function KpiCardHero({
  label = 'NLV · NET LIQUIDITY VALUE',
  liveBadge = 'LIVE',
  // Brique 14 — bande de stats entre le bloc texte héro et le bloc
  // densité (variante Dense: 6 cellules, Statement: 4). Null = absent.
  statsBand = null,
  // TEMP Brique 14 — 'dense' force le nombre héro à 56px (la variante
  // Statement garde les 64px actuels). Retiré après choix de Rafael.
  sizeVariant = 'statement',
  range,
  setRange,
  topRight,
  value,
  valueTone = 'accent',
  chfLine,
  deltaUsd,
  deltaPct,
  microStats,
  // chart : { kind?, data, chartId, renderReadout, renderMeasureReadout, … }
  chart,
  // Brique 6 — bloc densité (gauge / bande forme) entre __hero-text et readout.
  densityBlock = null,
  footerCells,
}) {
  const deltaTone = toneSign(deltaUsd);
  const showRange = range != null && typeof setRange === 'function';

  // Brique 2 — point survolé propagé par HeroAreaChart.onActiveChange.
  // Brique 5 — on capture aussi l'index actif (Recharts activeTooltipIndex)
  // pour pouvoir le committer en mode Mesure au clic.
  // Fix brique 5 — l'index est aussi tenu dans un useRef pour que le
  // handler de clic le lise sans stale closure (useCallback ne peut pas
  // capturer un state qui change à chaque tick souris sans le re-créer).
  const [activePoint, setActivePoint] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);
  const activeIndexRef = useRef(null);
  // Fix racine — l'index n'est plus dérivé du onMouseMove Recharts (qui
  // ne propageait jamais activeTooltipIndex sur ces ComposedChart/BarChart),
  // mais calculé géométriquement depuis la position X du curseur sur ce
  // conteneur. Ref sur le <div .__hero-chart> pour getBoundingClientRect.
  const chartBoxRef = useRef(null);

  const handleActiveChange = useCallback((point, index) => {
    const idx = typeof index === 'number' ? index : null;
    setActivePoint(point);
    setActiveIndex(idx);
    activeIndexRef.current = idx;
  }, []);
  const fallbackPoint = useMemo(() => {
    const d = chart?.data;
    return Array.isArray(d) && d.length > 0 ? d[d.length - 1] : null;
  }, [chart?.data]);
  const currentPoint = activePoint || fallbackPoint;
  const isHovering = activePoint != null;

  // Brique 5 — mode Mesure. State local À la carte. canMeasure déduit
  // du kind (toutes les vues temporelles : area / bar). La Distribution
  // (histogram, XAxis numérique) ne le supporte pas.
  const canMeasure = chart != null && chart.kind !== 'histogram';
  const [measureMode, setMeasureMode] = useState(false);
  const [anchorA, setAnchorA] = useState(null);
  const [anchorB, setAnchorB] = useState(null);
  const [locked, setLocked] = useState(false);

  // Reset des ancres quand la série/la vue change (switch view, switch
  // range côté parent → nouvelle référence data ou nouveau chartId).
  // Le mode mesure reste actif (acceptable d'après le brief).
  useEffect(() => {
    setAnchorA(null);
    setAnchorB(null);
    setLocked(false);
  }, [chart?.chartId, chart?.data]);

  // Distribution : pas de mesure possible, on force OFF pour qu'aucune
  // bande fantôme ne traîne quand on rebascule sur une vue temporelle.
  useEffect(() => {
    if (!canMeasure) {
      setMeasureMode(false);
      setAnchorA(null);
      setAnchorB(null);
      setLocked(false);
    }
  }, [canMeasure]);

  // Fix brique 5 — le clic est désormais capturé sur le <div> wrapper du
  // chart (cf. JSX plus bas), pas sur le composant Recharts. Raison :
  //   (A) le onClick de Recharts sur ComposedChart/BarChart ne se
  //       déclenche pas de façon fiable (clic hors bar, transition de
  //       state interne, etc.) — un onClick de div toujours via bubbling.
  //   (B) l'index actif est lu depuis activeIndexRef.current, pas depuis
  //       le state `activeIndex`, pour qu'aucune stale closure n'oublie
  //       le dernier survol (useCallback avec deps incomplètes serait
  //       un piège silencieux).
  const handleChartContainerClick = useCallback(() => {
    if (!measureMode) return;
    const idx = activeIndexRef.current;
    if (idx == null) return;
    if (locked) {
      setAnchorA(null);
      setAnchorB(null);
      setLocked(false);
      return;
    }
    if (anchorA == null) {
      setAnchorA(idx);
      setAnchorB(null);
      setLocked(false);
      return;
    }
    if (idx === anchorA) return; // ignore B == A
    setAnchorB(idx);
    setLocked(true);
  }, [measureMode, anchorA, locked]);

  // Fix racine — survol par géométrie sur les vues temporelles (canMeasure).
  // Distribution garde le comportement Recharts par défaut (axe X numérique,
  // pas d'index séquentiel utilisable depuis la position X simple).
  const handleBoxMove = useCallback(
    (e) => {
      if (!canMeasure) return;
      const box = chartBoxRef.current;
      const data = chart?.data;
      if (!box || !Array.isArray(data) || data.length === 0) return;
      const rect = box.getBoundingClientRect();
      const plotLeft = rect.left + HERO_CHART_PLOT_OFFSET_LEFT;
      const plotRight = rect.right - HERO_CHART_PLOT_OFFSET_RIGHT;
      const width = plotRight - plotLeft;
      if (width <= 0) return;
      const ratio = Math.min(
        1,
        Math.max(0, (e.clientX - plotLeft) / width)
      );
      const idx = Math.min(
        data.length - 1,
        Math.max(0, Math.round(ratio * (data.length - 1)))
      );
      handleActiveChange(data[idx], idx);
    },
    [canMeasure, chart?.data, handleActiveChange]
  );

  const handleBoxLeave = useCallback(() => {
    if (!canMeasure) return;
    handleActiveChange(null, null);
  }, [canMeasure, handleActiveChange]);

  // Calcule les ancres "vivantes" (B preview = activeIndex tant que
  // non locked) et les dates correspondantes pour les ReferenceLine/Area.
  const data = chart?.data;
  const aPt =
    measureMode && anchorA != null && Array.isArray(data) ? data[anchorA] : null;
  const bPtIndex = (() => {
    if (!measureMode) return null;
    if (anchorB != null) return anchorB;
    if (anchorA != null && !locked && activeIndex != null && activeIndex !== anchorA)
      return activeIndex;
    return null;
  })();
  const bPt = bPtIndex != null && Array.isArray(data) ? data[bPtIndex] : null;
  const measureADate = aPt?.date || null;
  const measureBDate = bPt?.date || null;

  // Readout : mode mesure shunte le rendu normal.
  let readoutContent = null;
  if (chart) {
    if (measureMode && !aPt) {
      readoutContent = (
        <ReadoutBit kind="label">
          Mesure — clique le point A, puis le point B
        </ReadoutBit>
      );
    } else if (measureMode && aPt && !bPt) {
      readoutContent = (
        <>
          <ReadoutBit kind="label">Mesure — A sur</ReadoutBit>
          <ReadoutBit kind="date">{fmtDateDeCH(aPt.date)}</ReadoutBit>
          <ReadoutBit kind="sep">·</ReadoutBit>
          <ReadoutBit kind="label">survole et clique B</ReadoutBit>
        </>
      );
    } else if (measureMode && aPt && bPt && chart.renderMeasureReadout) {
      readoutContent = chart.renderMeasureReadout(aPt, bPt, chart.data, locked);
    } else if (chart.renderReadout) {
      readoutContent = chart.renderReadout(currentPoint, chart.data, isHovering);
    }
  }

  return (
    <section
      className={`dash-kpi-card dash-kpi-card--hero${sizeVariant === 'dense' ? ' dash-kpi-card--hero-dense' : ''}`}
      data-tone={valueTone}
    >
      <div className="dash-kpi-card__top">
        <span className="dash-kpi-card__top-left">
          <span className="dash-kpi-card__label">{label}</span>
          {liveBadge ? (
            <span className="dash-kpi-card__live">
              <span className="dash-kpi-card__live-dot" aria-hidden="true" />
              <span className="dash-kpi-card__live-text">{liveBadge}</span>
            </span>
          ) : null}
        </span>
        {topRight ?? (showRange ? <RangeSelector value={range} onChange={setRange} /> : null)}
      </div>
      <div className="dash-kpi-card__hero-mid">
        <div className="dash-kpi-card__hero-text">
          <div className="dash-kpi-card__value">{value}</div>
          {chfLine ? <div className="dash-kpi-card__chf">{chfLine}</div> : null}
          {Number.isFinite(deltaUsd) ? (
            <span
              className={`dash-kpi-card__pill dash-kpi-card__pill--${deltaTone} dash-kpi-card__pill--hero`}
            >
              <span aria-hidden="true">{arrow(deltaUsd)}</span>
              <span>{fmtUsdSigned(deltaUsd)}</span>
              {Number.isFinite(deltaPct) ? (
                <span className="dash-kpi-card__pill-sub">{fmtPctSigned(deltaPct, 1)}</span>
              ) : null}
            </span>
          ) : null}
          {Array.isArray(microStats) && microStats.length > 0 ? (
            <div className="dash-kpi-card__micro-stats">
              {microStats.map((s, i) => (
                <span key={s.label || i} className="dash-kpi-card__micro-stat">
                  <span className="dash-kpi-card__micro-stat-label">{s.label}</span>
                  <span
                    className={`dash-kpi-card__micro-stat-value dash-kpi-card__micro-stat-value--${s.tone || 'neutral'}`}
                    title={s.title || undefined}
                  >
                    {s.value}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {Array.isArray(statsBand) && statsBand.length > 0 ? (
          <div className="dash-kpi-card__stats-band" role="list">
            {statsBand.map((s) => (
              <span
                key={s.label}
                className="dash-kpi-card__stats-band-cell"
                role="listitem"
                title={s.title || undefined}
              >
                <span className="dash-kpi-card__stats-band-label">{s.label}</span>
                <span
                  className={`dash-kpi-card__stats-band-value dash-kpi-card__stats-band-value--${s.tone || 'neutral'}`}
                >
                  {s.value}
                </span>
              </span>
            ))}
          </div>
        ) : null}
        {densityBlock}
        {chart ? (
          <>
            <div
              className="dash-kpi-card__hero-readout"
              role="status"
              aria-live="polite"
              data-hover={isHovering ? 'true' : undefined}
              data-measure={measureMode ? 'true' : undefined}
            >
              {canMeasure ? (
                <button
                  type="button"
                  className={`dash-kpi-card__measure-btn${measureMode ? ' is-active' : ''}`}
                  onClick={() => setMeasureMode((m) => !m)}
                  aria-pressed={measureMode}
                  title={measureMode ? 'Désactiver la mesure' : 'Outil mesure A → B'}
                >
                  <Ruler size={13} aria-hidden="true" />
                </button>
              ) : null}
              <span className="dash-kpi-card__hero-readout-content">{readoutContent}</span>
            </div>
            <div
              ref={chartBoxRef}
              className="dash-kpi-card__hero-chart"
              data-measure={measureMode ? 'true' : undefined}
              onClick={handleChartContainerClick}
              onMouseMove={handleBoxMove}
              onMouseLeave={handleBoxLeave}
            >
              {renderHeroChart(chart, {
                onActiveChange: handleActiveChange,
                measureADate,
                measureBDate,
                measureLocked: locked,
              })}
            </div>
          </>
        ) : null}
      </div>
      <KpiFooter cells={footerCells} />
    </section>
  );
}

function KpiCard({
  label,
  topRight,
  value,
  valueTone = 'neutral',
  chfLine,
  visual,
  footerCells,
}) {
  return (
    <section className="dash-kpi-card" data-tone={valueTone}>
      <div className="dash-kpi-card__top">
        <span className="dash-kpi-card__label">{label}</span>
        {topRight ?? null}
      </div>
      <div className="dash-kpi-card__money">
        <div className="dash-kpi-card__value">{value}</div>
        {chfLine ? <div className="dash-kpi-card__chf">{chfLine}</div> : null}
      </div>
      <div className="dash-kpi-card__visual">{visual}</div>
      <KpiFooter cells={footerCells} />
    </section>
  );
}

function KpiCardWinRate({
  winRate,
  profitFactor,
  winCount,
  lossCount,
  tradeCount,
  currentStreak,
  footerCells,
}) {
  const wins = Number.isFinite(winCount) ? winCount : 0;
  const losses = Number.isFinite(lossCount) ? lossCount : 0;

  // Streak bloc — > 0 win streak, < 0 loss streak, 0 → placeholder mute.
  let streakBlock;
  if (Number.isFinite(currentStreak) && currentStreak > 0) {
    streakBlock = (
      <InfoBlock
        tone="profit"
        label="STREAK"
        value={`▲ ${currentStreak}W`}
        valueTone="profit"
      />
    );
  } else if (Number.isFinite(currentStreak) && currentStreak < 0) {
    streakBlock = (
      <InfoBlock
        tone="loss"
        label="STREAK"
        value={`▼ ${Math.abs(currentStreak)}L`}
        valueTone="loss"
      />
    );
  } else {
    streakBlock = <InfoBlock tone="mute" label="STREAK" value="—" valueTone="mute" />;
  }

  return (
    <section className="dash-kpi-card dash-kpi-card--wr" data-tone="accent">
      <div className="dash-kpi-card__top">
        <span className="dash-kpi-card__label">WIN RATE</span>
        <Pill tone="mute">N={tradeCount}</Pill>
      </div>
      <div className="dash-kpi-card__wr-mid">
        <div className="dash-kpi-card__wr-text">
          <div className="dash-kpi-card__wr-value">{fmtPctPlain(winRate, 1)}</div>
          <div className="dash-kpi-card__wr-sub">
            <span className="dash-kpi-card__wr-w">{wins}W</span>
            <span className="dash-kpi-card__wr-sep">·</span>
            <span className="dash-kpi-card__wr-l">{losses}L</span>
          </div>
        </div>
        <div className="dash-kpi-card__wr-donut">
          <WinRateDonut winRate={winRate} profitFactor={profitFactor} />
        </div>
      </div>
      <div className="dash-kpi-card__info-slot">{streakBlock}</div>
      <KpiFooter cells={footerCells} />
    </section>
  );
}

// ─── Main component ─────────────────────────────────────────────

export default function DashboardKPICards() {
  const metrics = usePortfolioMetrics();
  const kpis = useKPIs();
  const { availableUsd } = useAvailableCapital();
  const equityHistory = useEquityHistory();
  const dailyPnL = useDailyPnL();
  const closedTrades = useClosedTrades();
  const openPositions = useOpenPositions();
  const greeks = useGreeksAggregate();
  const marketSession = useMarketSession();
  const settings = useSettings();

  // Brique 13 — paramètres du tier Sniper actif, dérivés de la
  // coordonnée matrice persistée (settings.activeSniperTier) via la
  // source de vérité unique utils/sniperMeta. Remplace l'ancien
  // SNIPER_DEFAULTS hardcodé (TODO Phase C résolu).
  const sniperTier = useMemo(
    () => tierParams(settings?.activeSniperTier),
    [settings?.activeSniperTier]
  );

  // TEMP Brique 14 — toggle de variante de composition héro, piloté par
  // l'URL (?b14=2 → « Statement » : 4 cellules + héros 64px ; défaut
  // « Dense » : 6 cellules + héros 56px). À RETIRER une fois la variante
  // choisie par Rafael — aucune n'est retenue par défaut ici.
  const b14Variant = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('b14') === '2'
        ? 'statement'
        : 'dense';
    } catch {
      return 'dense';
    }
  }, []);

  const [range, setRange] = useState('30J');
  const rangeConf = RANGES.find((r) => r.key === range) || RANGES[2];

  // Snapshot-backed sparklines.
  const availCapSeries = useDailySnapshot('availCapital', 30);
  const unrealizedSeries = useDailySnapshot('unrealized', 14);

  // ─── Derivations ────────────────────────────────────────────
  const liveRate = metrics?.liveRate || null;
  const fxOk = liveRate != null && Number.isFinite(liveRate) && liveRate > 0;
  const realizedAllTimeSeries = useRealizedAllTimeSeries(closedTrades, liveRate || 1);
  const unrealStats = useOpenPositionsStats(openPositions, liveRate || 1);
  const closedExtremes = useClosedExtremes(closedTrades, liveRate || 1);

  // ─── A3b — Hero NLV série sourced from realEquity (init + cumPnL) ──
  // Prior versions sliced `equityHistory` which is cumPnL-only ⇒ the
  // hero pill % was computed on a denominator that started near zero on
  // the first trade. The series now reads `metrics.realEquityPoints`
  // (the A3b canonical timeline) so both the visual line and the % pill
  // anchor on the REAL portfolio equity, not on the bare cumulative P&L.
  // Série de base canonique (full, non rangée) — partagée entre la courbe
  // du chart (via nlvSeries) et la cellule PEAK de la rail, pour que
  // l'annotation PIC et PEAK dérivent de la MÊME timeline par construction.
  const nlvBaseSeries = useMemo(() => {
    const real = metrics?.realEquityPoints;
    const base = Array.isArray(real) && real.length > 0 ? real : equityHistory;
    return Array.isArray(base) ? base : [];
  }, [metrics, equityHistory]);

  const nlvSeries = useMemo(() => {
    if (nlvBaseSeries.length === 0) return [];
    const slice =
      rangeConf.days == null ? nlvBaseSeries : nlvBaseSeries.slice(-rangeConf.days);
    return slice.map((p) => ({ date: p.date, value: p.equity }));
  }, [nlvBaseSeries, rangeConf.days]);

  // Brique 3 — toggle de vue Équité / Drawdown, NLV uniquement.
  // L'état vit dans le parent (la carte NLV est sans état propre côté
  // KpiCardHero pour cette dimension). Drawdown dérivé de la série déjà
  // filtrée par le range : changer de range recompose les 2 vues.
  const [nlvView, setNlvView] = useState('equity');
  const nlvDrawdownSeries = useMemo(
    () => computeDrawdownSeries(nlvSeries),
    [nlvSeries]
  );

  // Brique 4 — toggle Realized : Cumulé (défaut, ALL-TIME comme avant) /
  // Quotidien (rangé) / Distribution (all-time, indépendant du range).
  // Cumulé conserve sciemment realizedAllTimeSeries pour rester pixel-
  // identique au comportement antérieur (cf. brief).
  const [realizedView, setRealizedView] = useState('cumulative');
  const realizedRangedCumSeries = useMemo(() => {
    if (!Array.isArray(realizedAllTimeSeries) || realizedAllTimeSeries.length === 0)
      return [];
    return rangeConf.days == null
      ? realizedAllTimeSeries
      : realizedAllTimeSeries.slice(-rangeConf.days);
  }, [realizedAllTimeSeries, rangeConf.days]);
  const realizedDailySeries = useMemo(
    () => computeRealizedDailySeries(realizedRangedCumSeries),
    [realizedRangedCumSeries]
  );
  const realizedDistributionBins = useMemo(
    () => computeDistributionBins(closedTrades, liveRate || 1, 150),
    [closedTrades, liveRate]
  );

  const dayPnlSeries = useMemo(() => {
    if (!dailyPnL || dailyPnL.length === 0) return [];
    return dailyPnL.slice(-14).map((d) => ({ date: d.date, value: d.dailyPnl }));
  }, [dailyPnL]);

  // ─── Métriques de base ──────────────────────────────────────
  const nlvUsd = metrics?.netLiquidationValueUsd;
  const realizedUsd = metrics?.realizedPnlUsd;
  const unrealUsd = metrics?.unrealizedPnlUsd;
  const exposureUsd = metrics?.totalExposure;
  const monthlyPnlUsd = metrics?.monthlyPnlUsd;
  const positionsCount = (openPositions || []).length;
  const tradeCount = kpis?.totalTrades ?? metrics?.tradeCount ?? 0;
  const winRate = kpis?.winRate ?? null;
  const profitFactor = kpis?.profitFactor ?? null;
  const winCount = kpis?.winCount ?? 0;
  const lossCount = kpis?.lossCount ?? 0;
  const expectancy = metrics?.expectancy;
  const averageWin = metrics?.averageWin;
  const averageLoss = metrics?.averageLoss;
  const currentStreak = metrics?.currentStreak;
  const sumDelta = greeks?.sumDelta;
  // Brique 7 — rails enrichis (4 → 6 cellules).
  // DD ACTUEL : primitive pure currentDrawdownPct (utils/risk) sur la
  // timeline canonique realEquityPoints (init + cumPnL) — même calcul
  // que m.currentDDPct du cockpit RiskMatrix, identique au pixel.
  // MAX DD / KELLY : champs déjà calculés par calculatePortfolioMetrics
  // (utils/calculations) et exposés via le même objet metrics ci-dessus.
  const currentDDPct = useMemo(
    () => currentDrawdownPct(metrics?.realEquityPoints || []),
    [metrics?.realEquityPoints]
  );
  const maxDDPct = metrics?.maxDrawdownPct;
  const kellyPct = metrics?.kellyPercent;

  // ─── CHF lines ──────────────────────────────────────────────
  const nlvChfLine = fxOk && nlvUsd != null ? fmtChfLine(nlvUsd * liveRate) : null;
  const availChfLine =
    fxOk && availableUsd != null ? fmtChfLine(availableUsd * liveRate) : null;
  const unrealChfLine =
    fxOk && unrealUsd != null ? fmtChfLine(unrealUsd * liveRate, { signed: true }) : null;
  const realizedChfLine =
    fxOk && realizedUsd != null ? fmtChfLine(realizedUsd * liveRate, { signed: true }) : null;
  const exposureChfLine =
    fxOk && exposureUsd != null ? fmtChfLine(exposureUsd * liveRate) : null;

  // ─── A3b — NLV range delta (REAL equity growth, gated denominator) ──
  // Three distinct % badges across the app now have CLEAR semantics :
  //   - this pill (NLV hero) : growth of REAL equity (init + cumPnL)
  //     across the selected window. Guarded by MIN_CAPITAL_REF_USD (500)
  //     on the denominator to refuse the "tiny start ⇒ huge %" trap.
  //   - REALIZED hero pill   : realised P&L ÷ initialCapital (cumulative
  //     return on capital, A2b). Not annualised.
  //   - TWR row (RiskMatrix) : time-weighted return, neutralises the
  //     timing of deposits. Pure trading performance.
  const rangeDeltaUsd = useMemo(() => {
    if (nlvSeries.length < 2) return null;
    return nlvSeries[nlvSeries.length - 1].value - nlvSeries[0].value;
  }, [nlvSeries]);
  const rangeDeltaPct = useMemo(() => {
    if (nlvSeries.length < 2) return null;
    const start = nlvSeries[0].value;
    // Guard against a denominator below MIN_CAPITAL_REF_USD (500) — the
    // very first trade often happens before significant capital was
    // deployed and the % would balloon otherwise. Honest "—" instead.
    if (typeof start !== 'number' || !Number.isFinite(start) || start < 500) {
      return null;
    }
    return (rangeDeltaUsd / start) * 100;
  }, [nlvSeries, rangeDeltaUsd]);

  const rangeHigh = useMemo(() => {
    if (nlvSeries.length === 0) return null;
    return Math.max(...nlvSeries.map((p) => p.value));
  }, [nlvSeries]);
  const rangeLow = useMemo(() => {
    if (nlvSeries.length === 0) return null;
    return Math.min(...nlvSeries.map((p) => p.value));
  }, [nlvSeries]);
  // PEAK = max all-time de la timeline NLV canonique (nlvBaseSeries), la
  // même série que celle qui alimente l'annotation PIC du chart — et non
  // plus equityHistory (cumPnL seul) qui donnait le pic du réalisé.
  const peakAllTime = useMemo(() => {
    if (nlvBaseSeries.length === 0) return null;
    return Math.max(...nlvBaseSeries.map((p) => p.equity));
  }, [nlvBaseSeries]);

  // ALL-TIME = realized + unrealized (somme P&L totale).
  const allTimePnlUsd = useMemo(() => {
    const r = Number.isFinite(realizedUsd) ? realizedUsd : 0;
    const u = Number.isFinite(unrealUsd) ? unrealUsd : 0;
    return r + u;
  }, [realizedUsd, unrealUsd]);

  // ─── Week / YTD aggregations (B2 hero Day P&L footer) ──────
  const weekPnlUsd = useMemo(() => {
    if (!dailyPnL || dailyPnL.length === 0) return null;
    const now = new Date();
    const day = now.getDay(); // 0 = dimanche, 1 = lundi
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const mondayISO = monday.toISOString().slice(0, 10);
    return dailyPnL
      .filter((d) => d.date >= mondayISO)
      .reduce((sum, d) => sum + d.dailyPnl, 0);
  }, [dailyPnL]);

  const ytdPnlUsd = useMemo(() => {
    if (!dailyPnL || dailyPnL.length === 0) return null;
    const yearStart = `${new Date().getFullYear()}-01-01`;
    return dailyPnL
      .filter((d) => d.date >= yearStart)
      .reduce((sum, d) => sum + d.dailyPnl, 0);
  }, [dailyPnL]);

  // ─── Brique 14 (A) — bande de stats héro NLV ────────────────
  // Densifie la zone morte entre les deltas et EXPOSITION. Uniquement
  // des valeurs DÉJÀ calculées (metrics / hooks existants) — aucun
  // calcul nouveau. Dense = 6 cellules, Statement = les 4 premières.
  const volAnnPct = metrics?.volAnnPct;
  const yearsActive = metrics?.yearsActive;
  const initialCapitalUsd = metrics?.initialCapital;
  const nlvStatsBand = useMemo(() => {
    const cells = [
      {
        label: 'DÉPLOYÉ',
        value: Number.isFinite(exposureUsd) ? fmtUsdCompact(exposureUsd) : '——',
        tone: 'neutral',
        title: 'Notionnel déployé (même valeur que la barre EXPOSITION)',
      },
      {
        label: 'DISPONIBLE',
        value: Number.isFinite(availableUsd) ? fmtUsdCompact(availableUsd) : '——',
        tone: 'neutral',
        title: 'Capital déployable (même valeur que la card AVAIL. CAPITAL)',
      },
      {
        label: 'YTD',
        value: Number.isFinite(ytdPnlUsd) ? fmtUsdSigned(ytdPnlUsd) : '—',
        tone: toneSign(ytdPnlUsd),
        title: 'P&L réalisé cumulé depuis le 1er janvier',
      },
      {
        label: 'CAP. INITIAL',
        value: Number.isFinite(initialCapitalUsd)
          ? fmtUsdCompact(initialCapitalUsd)
          : '——',
        tone: 'mute',
        title: 'Capital de référence (cascade manuel → cashReport → dépôts)',
      },
    ];
    if (b14Variant === 'dense') {
      cells.push(
        {
          label: 'VOL ANN.',
          value: Number.isFinite(volAnnPct) ? `${volAnnPct.toFixed(1)}%` : '—',
          tone: 'mute',
          title: 'Volatilité annualisée des returns (même valeur que le cockpit)',
        },
        {
          label: 'JOURS ACTIFS',
          value: Number.isFinite(yearsActive)
            ? `${Math.round(yearsActive * 365.25)} J`
            : '—',
          tone: 'mute',
          title: 'Jours calendaires entre le premier et le dernier trade clôturé',
        }
      );
    }
    return cells;
  }, [exposureUsd, availableUsd, ytdPnlUsd, initialCapitalUsd, volAnnPct, yearsActive, b14Variant]);

  // ─── Day P&L + flat-market detection ───────────────────────
  const dayPnl = todayPnlUsd(dailyPnL);
  const dayTone = toneSign(dayPnl);
  const unrealTone = toneSign(unrealUsd);
  const realTone = toneSign(realizedUsd);
  const dayChfLine =
    fxOk && dayPnl != null ? fmtChfLine(dayPnl * liveRate, { signed: true }) : null;
  // Si pas d'activité aujourd'hui ET pas d'historique 14 j → on bascule
  // sur les blocs info contextuels (MARKET + NEXT OPEN). Sinon sparkline.
  const showDayInfoBlocks = dayPnl === 0 && dayPnlSeries.length < 2;

  // ─── Pcts (fill bars) ───────────────────────────────────────
  const availPctNlv =
    Number.isFinite(availableUsd) && Number.isFinite(nlvUsd) && nlvUsd > 0
      ? (availableUsd / nlvUsd) * 100
      : null;
  const expoPctNlv =
    Number.isFinite(exposureUsd) && Number.isFinite(nlvUsd) && nlvUsd > 0
      ? (exposureUsd / nlvUsd) * 100
      : null;
  const tiedUpUsd =
    Number.isFinite(nlvUsd) && Number.isFinite(availableUsd) ? nlvUsd - availableUsd : null;

  // ─── A2b — Realized % all-time ──────────────────────────────
  // Single denominator : `m.initialCapital` from the canonical
  // resolution hierarchy (cashReport > cashFlows > settings > null).
  // No more NLV fallback (that conflated growth-of-equity with
  // realised-return-on-capital — the user saw +54.3 % on a 100-trade
  // book whose REAL relative gain on initial capital was +118 %).
  // Below MIN_CAPITAL_REF_USD or when init is unknown : null → display $ only.
  // The "B2 |pct|>999 shield" is retired : with a proper init denominator
  // there is no aberration to mask. Tone follows the $ sign of realised
  // P&L, not the % (so null pct still gets a green / red tone on the card).
  const realizedPct = useMemo(() => {
    if (!Number.isFinite(realizedUsd)) return null;
    const init = metrics?.initialCapital;
    if (typeof init !== 'number' || !Number.isFinite(init) || init < 500) return null;
    return (realizedUsd / init) * 100;
  }, [realizedUsd, metrics]);
  const realizedPctDisplay = realizedPct;

  // ─── Card 6 Risk $ : Σ effectiveSlDollar (gate SL35) ────────
  // Brique 13 — somme des risques max par position (35 % du coût
  // d'entrée, surcharge pos.slDollar prioritaire). Remplace l'ancien
  // proxy "unrealized de la 1re position" qui n'était pas un risque.
  const riskUsd = useMemo(() => totalSlDollar(openPositions), [openPositions]);

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="dash-kpi-cards">
      <div className="dash-kpi-cards__row dash-kpi-cards__row--hero">
        {/* HERO 1. NLV */}
        <KpiCardHero
          statsBand={nlvStatsBand}
          sizeVariant={b14Variant}
          range={range}
          setRange={setRange}
          topRight={
            <span className="dash-kpi-card__top-tools">
              <ViewToggle
                value={nlvView}
                onChange={setNlvView}
                options={NLV_VIEWS}
                ariaLabel="Vue affichée NLV"
              />
              <RangeSelector value={range} onChange={setRange} />
            </span>
          }
          value={fmtUsdCompact(nlvUsd)}
          valueTone="accent"
          chfLine={nlvChfLine}
          deltaUsd={rangeDeltaUsd}
          deltaPct={rangeDeltaPct}
          microStats={[
            {
              label: 'JOUR',
              value: dayPnl != null ? fmtUsdSigned(dayPnl) : '—',
              tone: toneSign(dayPnl),
            },
            {
              label: 'SEMAINE',
              value: Number.isFinite(weekPnlUsd) ? fmtUsdSigned(weekPnlUsd) : '—',
              tone: toneSign(weekPnlUsd),
              title: 'P&L cumulé depuis lundi 00h',
            },
            {
              label: 'MOIS',
              value: Number.isFinite(monthlyPnlUsd) ? fmtUsdSigned(monthlyPnlUsd) : '—',
              tone: toneSign(monthlyPnlUsd),
              title: 'P&L cumulé du mois en cours',
            },
          ]}
          densityBlock={
            <HeroExposureGauge
              exposureUsd={exposureUsd}
              exposurePctNlv={expoPctNlv}
              availableUsd={availableUsd}
              capPct={sniperTier.notionalMaxPct}
            />
          }
          chart={
            nlvView === 'drawdown'
              ? {
                  data: nlvDrawdownSeries,
                  chartId: 'nlv-dd',
                  tone: 'down',
                  withZeroBaseline: true,
                  showPeakLine: false,
                  yFormatter: fmtAxisPctDeCH,
                  baseValue: 0,
                  // Si jamais le drawdown reste à 0 (plus-hauts continus), on
                  // garantit un petit espace visuel sous la ligne 0 pour que
                  // la base de référence ne paraisse pas cassée.
                  yDomain: [(dataMin) => Math.min(dataMin, -0.1), 0],
                  renderReadout: renderDrawdownReadout,
                  renderMeasureReadout: renderMeasureDrawdownReadout,
                }
              : {
                  data: nlvSeries,
                  chartId: 'nlv',
                  withZeroBaseline: false,
                  renderReadout: renderNlvReadout,
                  renderMeasureReadout: renderMeasureEquityReadout,
                }
          }
          footerCells={[
            {
              label: `HIGH ${range}`,
              value: rangeHigh != null ? fmtUsdCompact(rangeHigh) : '——',
              tone: 'mute',
            },
            {
              label: `LOW ${range}`,
              value: rangeLow != null ? fmtUsdCompact(rangeLow) : '——',
              tone: 'mute',
            },
            {
              label: 'PEAK',
              value: peakAllTime != null ? fmtUsdCompact(peakAllTime) : '——',
              tone: peakAllTime != null && peakAllTime >= 0 ? 'profit' : 'mute',
              title: 'Plus haute NLV jamais atteinte (max all-time de la courbe equity réelle)',
            },
            {
              label: 'DD ACTUEL',
              value: Number.isFinite(currentDDPct) ? fmtPctSignedDeCH(currentDDPct, 2) : '——',
              tone: Number.isFinite(currentDDPct) && currentDDPct < 0 ? 'loss' : 'mute',
              title: 'Drawdown courant — écart au pic all-time (même calcul que Current DD du cockpit)',
            },
            {
              label: 'MAX DD',
              value:
                Number.isFinite(maxDDPct) && maxDDPct > 0 ? `−${maxDDPct.toFixed(2)}%` : '——',
              tone: Number.isFinite(maxDDPct) && maxDDPct > 0 ? 'loss' : 'mute',
              title: 'Max Drawdown all-time (même valeur que Max DD All-Time du cockpit)',
            },
            {
              label: 'ALL-TIME',
              value: Number.isFinite(allTimePnlUsd) ? fmtUsdSigned(allTimePnlUsd) : '——',
              tone: toneSign(allTimePnlUsd),
              title: 'P&L total = realized + unrealized',
            },
          ]}
        />

        {/* HERO 2. REALIZED (B2 — promu de secondary à hero) */}
        <KpiCardHero
          label="REALIZED · P&L CUMULÉ"
          sizeVariant={b14Variant}
          liveBadge={null}
          topRight={
            <span className="dash-kpi-card__top-tools">
              <ViewToggle
                value={realizedView}
                onChange={setRealizedView}
                options={REALIZED_VIEWS}
                ariaLabel="Vue affichée Realized"
              />
              {realizedPctDisplay != null ? (
                <Pill tone={realTone === 'mute' ? 'mute' : realTone}>
                  {fmtPctSigned(realizedPctDisplay, 1)}
                </Pill>
              ) : (
                <Pill tone="mute">ALL-TIME</Pill>
              )}
            </span>
          }
          value={fmtUsdSigned(realizedUsd)}
          valueTone={realTone}
          chfLine={realizedChfLine}
          microStats={[
            {
              label: 'WIN RATE',
              value: Number.isFinite(winRate) ? fmtPctPlain(winRate, 1) : '—',
              tone: 'accent',
            },
            {
              label: 'PF',
              value:
                profitFactor === Infinity
                  ? '∞'
                  : Number.isFinite(profitFactor)
                    ? profitFactor.toFixed(2)
                    : '—',
              tone:
                profitFactor === Infinity || (Number.isFinite(profitFactor) && profitFactor > 1)
                  ? 'profit'
                  : Number.isFinite(profitFactor) && profitFactor < 1
                    ? 'loss'
                    : 'mute',
              title: 'Profit Factor = gains bruts / pertes brutes',
            },
            {
              label: 'STREAK',
              value:
                Number.isFinite(currentStreak) && currentStreak !== 0
                  ? currentStreak > 0
                    ? `▲${currentStreak}W`
                    : `▼${Math.abs(currentStreak)}L`
                  : '—',
              tone:
                Number.isFinite(currentStreak) && currentStreak > 0
                  ? 'profit'
                  : Number.isFinite(currentStreak) && currentStreak < 0
                    ? 'loss'
                    : 'mute',
            },
          ]}
          densityBlock={
            <HeroFormBand
              trades={closedTrades}
              liveRate={liveRate || 1}
              currentStreak={currentStreak}
            />
          }
          chart={
            realizedView === 'daily'
              ? {
                  kind: 'bar',
                  data: realizedDailySeries,
                  chartId: 'realized-daily',
                  renderReadout: renderRealizedDailyReadout,
                  renderMeasureReadout: renderMeasureDailyReadout,
                }
              : realizedView === 'distribution'
                ? {
                    kind: 'histogram',
                    data: realizedDistributionBins,
                    chartId: 'realized-dist',
                    expectancy: expectancy,
                    renderReadout: renderDistributionReadout,
                  }
                : {
                    data: realizedAllTimeSeries,
                    chartId: 'realized',
                    withZeroBaseline: true,
                    renderReadout: renderRealizedReadout,
                    renderMeasureReadout: renderMeasureCumulativeReadout,
                  }
          }
          footerCells={[
            {
              label: 'BEST',
              value:
                closedExtremes.best && Number.isFinite(closedExtremes.best.pnl)
                  ? fmtUsdSigned(closedExtremes.best.pnl)
                  : '—',
              tone: closedExtremes.best && closedExtremes.best.pnl > 0 ? 'profit' : 'mute',
            },
            {
              label: 'WORST',
              value:
                closedExtremes.worst && Number.isFinite(closedExtremes.worst.pnl)
                  ? fmtUsdSigned(closedExtremes.worst.pnl)
                  : '—',
              tone: closedExtremes.worst && closedExtremes.worst.pnl < 0 ? 'loss' : 'mute',
            },
            {
              label: 'EXPECT',
              value:
                tradeCount > 0 && Number.isFinite(expectancy) ? fmtUsdSigned(expectancy) : '—',
              tone: toneSign(expectancy),
              title: 'Expectancy par trade (winRate × avgWin − lossRate × avgLoss)',
            },
            {
              label: 'AVG W',
              value:
                winCount > 0 && Number.isFinite(averageWin) ? fmtUsdSigned(averageWin) : '—',
              tone: Number.isFinite(averageWin) && averageWin > 0 ? 'profit' : 'mute',
              title: 'Gain moyen par trade gagnant',
            },
            {
              label: 'AVG L',
              value:
                lossCount > 0 && Number.isFinite(averageLoss)
                  ? fmtUsdSigned(-Math.abs(averageLoss))
                  : '—',
              tone: Number.isFinite(averageLoss) && averageLoss > 0 ? 'loss' : 'mute',
              title: 'Perte moyenne par trade perdant',
            },
            {
              label: 'KELLY',
              value: Number.isFinite(kellyPct) ? `${kellyPct.toFixed(1)}%` : '—',
              tone: 'neutral',
              title: 'Kelly Optimal — fraction du capital à risquer (même valeur que le cockpit)',
            },
          ]}
        />
      </div>

      <div className="dash-kpi-cards__row dash-kpi-cards__row--secondary">
        {/* SECONDARY 1. AVAIL CAPITAL */}
        <KpiCard
          label="AVAIL. CAPITAL"
          topRight={<Pill tone="accent">DEPLOYABLE</Pill>}
          value={fmtUsdCompact(availableUsd)}
          valueTone="neutral"
          chfLine={availChfLine}
          visual={
            <div className="dash-kpi-card__avail-block">
              {/* Mini-sparkline trend 30 j (subtil, accent) */}
              <div className="dash-kpi-card__avail-spark">
                <Sparkline
                  data={availCapSeries}
                  color="accent"
                  height={28}
                  area
                  dot
                  strokeOpacity={0.65}
                  gradientOpacity={0.28}
                />
              </div>
              <div className="dash-kpi-card__bar-row">
                <span className="dash-kpi-card__bar-pct dash-kpi-card__bar-pct--accent">
                  {availPctNlv != null ? `${availPctNlv.toFixed(1)}%` : '——'}
                </span>
                <span className="dash-kpi-card__bar-denom">
                  {Number.isFinite(nlvUsd) ? `/ ${fmtUsdCompact(nlvUsd)}` : ''}
                </span>
              </div>
              <FillBar pct={availPctNlv} color="accent" restColor />
            </div>
          }
          footerCells={[
            {
              label: 'TIED UP',
              value: tiedUpUsd != null ? fmtUsdCompact(tiedUpUsd) : '——',
            },
            {
              label: 'CASH FLR',
              value: `${sniperTier.cashFloorPct}%`,
              tone: 'amber',
              title: `Plancher de cash du tier Sniper actif (${sniperTier.label})`,
            },
          ]}
        />

        {/* SECONDARY 2. UNREALIZED */}
        <KpiCard
          label="UNREALIZED"
          topRight={
            positionsCount > 0 && unrealStats.pct != null ? (
              <Pill tone={unrealTone === 'mute' ? 'mute' : unrealTone}>
                {fmtPctSigned(unrealStats.pct, 1)}
              </Pill>
            ) : null
          }
          value={fmtUsdSigned(unrealUsd)}
          valueTone={unrealTone}
          chfLine={unrealChfLine}
          visual={
            <div className="dash-kpi-card__spark-wrap">
              <Sparkline
                data={unrealizedSeries}
                color={unrealTone === 'mute' ? 'neutral' : unrealTone}
                height={50}
                area
                dot
                strokeWidth={2}
                dotRadius={3}
                dotHaloRadius={6}
                gridlines={3}
              />
              <span className="dash-kpi-card__spark-overlay">14 J</span>
            </div>
          }
          footerCells={[
            {
              label: 'BEST',
              value:
                unrealStats.best && unrealStats.best.pnl > 0
                  ? `${unrealStats.best.ticker} ${fmtUsdSigned(unrealStats.best.pnl)}`
                  : '—',
              tone: unrealStats.best && unrealStats.best.pnl > 0 ? 'profit' : 'mute',
            },
            {
              label: 'WORST',
              value:
                unrealStats.worst && unrealStats.worst.pnl < 0
                  ? `${unrealStats.worst.ticker} ${fmtUsdSigned(unrealStats.worst.pnl)}`
                  : '—',
              tone: unrealStats.worst && unrealStats.worst.pnl < 0 ? 'loss' : 'mute',
            },
          ]}
        />

        {/* SECONDARY 3. DAY P&L */}
        <KpiCard
          label="DAY P&L"
          topRight={<Pill tone="mute">INTRADAY</Pill>}
          value={fmtUsdSigned(dayPnl)}
          valueTone={dayTone}
          chfLine={dayChfLine}
          visual={
            showDayInfoBlocks ? (
              <div className="dash-kpi-card__info-stack">
                <InfoBlock
                  tone={marketSession.isOpen ? 'profit' : 'loss'}
                  label="MARKET"
                  value={marketSession.isOpen ? 'OPEN · NY' : 'CLOSED · NY'}
                  valueTone={marketSession.isOpen ? 'profit' : 'loss'}
                />
                <InfoBlock
                  tone="accent"
                  label="NEXT OPEN"
                  value={
                    marketSession.isOpen
                      ? 'NOW'
                      : `${marketSession.hoursUntilOpen}h ${marketSession.minutesUntilOpen}m`
                  }
                  valueTone="accent"
                />
              </div>
            ) : (
              <div className="dash-kpi-card__spark-wrap">
                <Sparkline
                  data={dayPnlSeries}
                  color={dayTone === 'mute' ? 'neutral' : dayTone}
                  height={50}
                  area
                  dot
                  strokeWidth={2}
                  dotRadius={3}
                  dotHaloRadius={6}
                  gridlines={3}
                  zeroLine
                />
              </div>
            )
          }
          footerCells={[
            {
              label: 'WEEK',
              value: Number.isFinite(weekPnlUsd) ? fmtUsdSigned(weekPnlUsd) : '—',
              tone: toneSign(weekPnlUsd),
              title: 'P&L cumulé depuis lundi 00h (UTC)',
            },
            {
              label: 'MTD',
              value: Number.isFinite(monthlyPnlUsd) ? fmtUsdSigned(monthlyPnlUsd) : '—',
              tone: toneSign(monthlyPnlUsd),
            },
          ]}
        />

        {/* SECONDARY 4. EXPOSURE */}
        <KpiCard
          label="EXPOSURE"
          topRight={<Pill tone="amber">NOTIONAL</Pill>}
          value={fmtUsdCompact(exposureUsd)}
          valueTone="neutral"
          chfLine={exposureChfLine}
          visual={
            <div className="dash-kpi-card__expo-block">
              <div className="dash-kpi-card__bar-row">
                <span className="dash-kpi-card__bar-pct dash-kpi-card__bar-pct--amber">
                  {expoPctNlv != null ? `${expoPctNlv.toFixed(1)}% NLV` : '—— NLV'}
                </span>
                <span className="dash-kpi-card__bar-denom">
                  MAX {sniperTier.notionalMaxPct}%
                </span>
              </div>
              <FillBarWithMarker
                pct={expoPctNlv}
                color="amber"
                markerPct={sniperTier.notionalMaxPct}
              />
              <div className="dash-kpi-card__info-slot dash-kpi-card__info-slot--tight">
                <InfoBlock
                  tone="amber"
                  label="TIER ACTIF"
                  value={sniperTier.label}
                  valueTone="amber"
                />
              </div>
            </div>
          }
          footerCells={[
            {
              label: 'RISK $',
              // Risque potentiel (pas une perte réalisée) → ton neutre,
              // jamais rouge. Affiché signé négatif : montant perdu si
              // tous les stops SL35 se déclenchent.
              value: Number.isFinite(riskUsd) ? fmtUsdSigned(-riskUsd) : '—',
              tone: 'mute',
              title:
                'Σ risque max par position : surcharge slDollar sinon 35% du coût d’entrée (gate SL35)',
            },
            {
              label: 'DELTA',
              value:
                Number.isFinite(sumDelta) && sumDelta !== 0
                  ? sumDelta.toFixed(2)
                  : positionsCount === 0
                    ? '—'
                    : greeks?.loading
                      ? '…'
                      : '—',
              tone: 'neutral',
              title: 'Delta agrégé du portefeuille via useGreeksAggregate',
            },
          ]}
        />

        {/* SECONDARY 5. WIN RATE */}
        <KpiCardWinRate
          winRate={winRate}
          profitFactor={profitFactor}
          winCount={winCount}
          lossCount={lossCount}
          tradeCount={tradeCount}
          currentStreak={currentStreak}
          footerCells={[
            {
              label: 'AVG W',
              // Signed format avec "+$X" (brief B.4 explicite)
              value: winCount > 0 && Number.isFinite(averageWin) ? fmtUsdSigned(averageWin) : '—',
              tone: winCount > 0 ? 'profit' : 'mute',
            },
            {
              label: 'AVG L',
              value:
                lossCount > 0 && Number.isFinite(averageLoss) ? fmtUsdSigned(-averageLoss) : '—',
              tone: lossCount > 0 ? 'loss' : 'mute',
            },
          ]}
        />
      </div>
    </div>
  );
}
