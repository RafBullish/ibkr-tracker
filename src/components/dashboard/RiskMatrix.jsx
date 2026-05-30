// ═══════════════════════════════════════════════════════════════
//  RISK MATRIX v7 — 4K refonte Phase C.1.5 (Bloomberg-dense V3)
//
//  Refonte 3 colonnes + visuels intégrés :
//
//    Col 1 (Performance, 1.4 fr) :
//      ▼ Performance Metrics (10 lignes, 5 cols : Metric / Value /
//                             Bench / Δ / Gauge horizontale)
//      ▼ Distribution R-Multiples (12-bucket histogramme, range
//                                   fixe [-3R, +3R])
//
//    Col 2 (Drawdown · Streak, 1 fr) :
//      ▼ Drawdown · Streak (5 lignes USD / %)
//      DD CURVE · 60 J (mini sparkline area underwater)
//      Streak Current / Max Win / Max Loss (3 lignes)
//      STREAK PATTERN · 13 LAST (push-down — bars W/L)
//
//    Col 3 (Win/Loss · Distribution, 1 fr) :
//      ▼ Win/Loss Stats (7 lignes Count / $ Avg)
//      WIN RATE GAUGE (donut 64 + ratio bar W/L)
//      MONTHLY P&L · 6M (push-down — bars verticales)
//
//  Header 34 px avec 3 boutons (98/99/97) + title cockpit.
//  Sub-header 4 infos (Init Cap, Live FX, N trades, YTD Active)
//  + 2 badges (TIER + EDGE dynamique selon profitFactor & winRate).
//  Footer 26 px avec QueryID Flex + PMET <GO>.
//
//  Tous les colors via var(--*). Aucun hex hardcoded.
//
//  TODO Phase C ultérieure (signalés en rapport) :
//    TIER badge hardcodé, Max DD YTD USD non dérivé, dates Max
//    W/L Streak non dispo, FX Impact % non dérivable simply.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useClosedTrades } from '../../store/useStore';
import { tradePnlUsd } from '../../utils/calculations';

// ─── Formatters ─────────────────────────────────────────────────

const fmtNum = (v, decimals = 2) =>
  v == null || !Number.isFinite(v) ? '—' : v.toFixed(decimals);

const fmtPct = (v, decimals = 1) =>
  v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(decimals)}%`;

const fmtPctSigned = (v, decimals = 1) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(decimals)}%`;
};

const fmtUsd = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    signDisplay: 'auto',
  }).format(v);
};

const fmtUsdSigned = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    signDisplay: 'exceptZero',
  }).format(v);
};

function deltaVsBench(value, bench, profitIfAbove = true) {
  if (value == null || !Number.isFinite(value) || bench == null) {
    return { text: '—', tone: 'mute' };
  }
  const d = value - bench;
  if (d === 0) return { text: '0', tone: 'mute' };
  const tone = (profitIfAbove ? d > 0 : d < 0) ? 'profit' : 'loss';
  const sign = d > 0 ? '+' : '';
  return { text: `${sign}${d.toFixed(2)}`, tone };
}

// ─── Histogram R-Multiples : range fixe [-3R, +3R], 12 buckets ──

const HISTOGRAM_BUCKETS = 12;
const HIST_MIN = -3;
const HIST_MAX = 3;
const HIST_WIDTH = (HIST_MAX - HIST_MIN) / HISTOGRAM_BUCKETS;

function buildHistogram(rMultiples) {
  const counts = Array(HISTOGRAM_BUCKETS).fill(0);
  if (!Array.isArray(rMultiples) || rMultiples.length === 0) {
    return { buckets: counts.map(() => ({ count: 0, kind: 'zero', max: false })), max: 0 };
  }
  for (const r of rMultiples) {
    if (!Number.isFinite(r)) continue;
    const clamped = Math.max(HIST_MIN, Math.min(HIST_MAX - 1e-6, r));
    const idx = Math.floor((clamped - HIST_MIN) / HIST_WIDTH);
    counts[idx]++;
  }
  const maxCount = Math.max(...counts, 0);
  const buckets = counts.map((count, i) => {
    const center = HIST_MIN + (i + 0.5) * HIST_WIDTH;
    const kind = center < -0.1 ? 'loss' : center > 0.1 ? 'profit' : 'zero';
    return { count, kind, max: maxCount > 0 && count === maxCount };
  });
  return { buckets, max: maxCount };
}

// ─── Monthly P&L (6 derniers mois incluant le mois courant) ─────

const MONTHS_FR_SHORT = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Jun',
  'Jul',
  'Aoû',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
];

function computeMonthlyPnL(closedTrades, liveRate, monthsBack = 6) {
  const now = new Date();
  const months = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ key, label: MONTHS_FR_SHORT[d.getMonth()], pnl: 0 });
  }
  for (const t of closedTrades || []) {
    const k = (t.do || t.di || '').slice(0, 7); // YYYY-MM
    const m = months.find((x) => x.key === k);
    if (m) m.pnl += tradePnlUsd(t, liveRate);
  }
  return months;
}

// ─── Sub-components ─────────────────────────────────────────────

// Gauge horizontale par métrique (5e colonne Performance).
// `mode` : 'higher-is-better' | 'lower-is-better' | 'info'
function MetricGauge({ value, bench, mode = 'higher-is-better' }) {
  if (value == null || !Number.isFinite(value)) {
    return <div className="risk-matrix__gauge" aria-hidden="true" />;
  }
  if (mode === 'info') {
    return (
      <div className="risk-matrix__gauge" aria-hidden="true">
        <div className="risk-matrix__gauge-fill" data-tone="amber" style={{ width: '50%' }} />
      </div>
    );
  }
  // Fallback bench=0 (R Avg) — use abs(value) * 50 as scale.
  if (bench == null || bench === 0) {
    const fillPct = Math.min(100, Math.max(0, Math.abs(value) * 50));
    const tone =
      mode === 'higher-is-better' ? (value >= 0 ? 'profit' : 'loss') : value <= 0 ? 'profit' : 'loss';
    return (
      <div className="risk-matrix__gauge" aria-hidden="true">
        <div
          className="risk-matrix__gauge-fill"
          data-tone={tone}
          style={{ width: `${fillPct}%` }}
        />
      </div>
    );
  }
  // Standard : fill = value / (bench*2) * 100, clampé 0-100. Marker à 50% (bench position).
  const fillPct = Math.min(100, Math.max(0, (value / (bench * 2)) * 100));
  const isGood = mode === 'higher-is-better' ? value >= bench : value <= bench;
  const tone = isGood ? 'profit' : 'loss';
  return (
    <div className="risk-matrix__gauge" aria-hidden="true">
      <div className="risk-matrix__gauge-fill" data-tone={tone} style={{ width: `${fillPct}%` }} />
      <div className="risk-matrix__gauge-marker" style={{ left: '50%' }} />
    </div>
  );
}

// Streak pattern : 13 bars verticales — vert si win, rouge si loss.
function StreakPattern({ trades, liveRate, currentStreak }) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return (
      <div className="risk-matrix__streak-pattern" aria-hidden="true">
        <span className="risk-matrix__streak-empty">aucun trade fermé</span>
      </div>
    );
  }
  const activeSign = currentStreak > 0 ? 1 : currentStreak < 0 ? -1 : 0;
  return (
    <div className="risk-matrix__streak-pattern" aria-label="Streak pattern 13 derniers trades">
      {trades.map((t, i) => {
        const pnl = tradePnlUsd(t, liveRate);
        const sign = pnl > 0 ? 1 : pnl < 0 ? -1 : 0;
        const kind = sign > 0 ? 'win' : sign < 0 ? 'loss' : 'even';
        const isLast = i === trades.length - 1;
        const isActive = isLast && activeSign !== 0 && activeSign === sign;
        const cls = isActive
          ? `risk-matrix__streak-bar risk-matrix__streak-bar--active-${kind}`
          : `risk-matrix__streak-bar risk-matrix__streak-bar--${kind}`;
        const title = `${kind === 'win' ? 'W' : kind === 'loss' ? 'L' : 'BE'} ${fmtUsdSigned(pnl)}`;
        return <div key={t.id || `s-${i}`} className={cls} title={title} />;
      })}
    </div>
  );
}

// DD curve 60j — SVG sparkline area + reference line top.
function DdSparkline({ data }) {
  if (!Array.isArray(data) || data.length < 2) {
    return <div className="risk-matrix__dd-spark risk-matrix__dd-spark--empty" />;
  }
  const w = 100;
  const h = 30;
  const values = data.map((d) => d.value); // toutes ≤ 0
  const min = Math.min(...values, 0);
  const max = 0; // peak = 0 % underwater
  const span = max - min || 1;
  const yPad = 2;
  const usableH = h - yPad * 2;
  const xs = data.map((_, i) => (i / (data.length - 1)) * w);
  const ys = data.map((v) => yPad + ((max - v.value) / span) * usableH);
  const linePath = xs
    .map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${ys[i].toFixed(2)}`)
    .join(' ');
  const areaPath = `M 0 ${yPad} L ${linePath.slice(2)} L ${w} ${yPad} Z`;
  return (
    <svg
      className="risk-matrix__dd-spark"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden="true"
    >
      <line
        className="risk-matrix__dd-spark-ref"
        x1="0"
        y1={yPad}
        x2={w}
        y2={yPad}
        strokeWidth="1"
        strokeDasharray="2 3"
        vectorEffect="non-scaling-stroke"
      />
      <path d={areaPath} className="risk-matrix__dd-spark-area" />
      <path
        d={linePath}
        fill="none"
        className="risk-matrix__dd-spark-line"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// Win Rate gauge — donut + bars ratio W/L (Phase C.1.6 : 72×72, r=27).
function WinRateGauge({
  winRate,
  profitFactor,
  winCount,
  lossCount,
  totalWinAmount,
  totalLossAmount,
}) {
  const r = 27;
  const C = 2 * Math.PI * r;
  // A2b — donut painted only when winRate has passed the decisive ≥ 10
  // gate (winRate is null otherwise). Under the gate the centre shows
  // the raw fraction "x/y" with a "N faible" hint, never a green-toned %.
  const isGated = winRate == null || !Number.isFinite(winRate);
  const wrFraction = !isGated ? Math.max(0, Math.min(100, winRate)) / 100 : 0;
  const winPortion = C * wrFraction;
  const total = (winCount || 0) + (lossCount || 0);
  const winRatio = total > 0 ? (winCount / total) * 100 : 0;
  const lossRatio = total > 0 ? (lossCount / total) * 100 : 0;
  const donutLabel = !isGated
    ? `${winRate.toFixed(1)}%`
    : total > 0
      ? `${winCount}/${total}`
      : '—';
  const pfLabel =
    profitFactor != null && Number.isFinite(profitFactor)
      ? profitFactor.toFixed(2)
      : '—';
  return (
    <div className="risk-matrix__winrate-zone">
      <svg
        className="risk-matrix__winrate-donut"
        width="72"
        height="72"
        viewBox="0 0 72 72"
        role="img"
        aria-label={
          !isGated
            ? `Win rate ${winRate.toFixed(1)} pourcent`
            : total > 0
              ? `Win rate ${winCount} sur ${total}, échantillon faible`
              : 'Win rate inconnu'
        }
      >
        <circle className="risk-matrix__winrate-donut-bg" cx="36" cy="36" r={r} fill="none" strokeWidth="8" />
        <circle
          className="risk-matrix__winrate-donut-fg"
          cx="36"
          cy="36"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeDasharray={`${winPortion.toFixed(2)} ${C.toFixed(2)}`}
          strokeLinecap="butt"
          transform="rotate(-90 36 36)"
        />
        <text className="risk-matrix__winrate-donut-label" x="36" y="34" textAnchor="middle">
          WIN
        </text>
        <text className="risk-matrix__winrate-donut-value" x="36" y="48" textAnchor="middle">
          {donutLabel}
        </text>
      </svg>
      <div className="risk-matrix__winrate-stats">
        <div className="risk-matrix__winrate-row">
          <span className="risk-matrix__winrate-label">{winCount ?? 0} wins</span>
          <span className="risk-matrix__cell--profit risk-matrix__winrate-amount">
            {fmtUsdSigned(totalWinAmount)}
          </span>
        </div>
        <div
          className="risk-matrix__winrate-ratio"
          role="img"
          aria-label={`Ratio ${winRatio.toFixed(0)} pourcent wins`}
        >
          <span className="risk-matrix__winrate-ratio-win" style={{ width: `${winRatio}%` }} />
          <span className="risk-matrix__winrate-ratio-loss" style={{ width: `${lossRatio}%` }} />
        </div>
        <div className="risk-matrix__winrate-row">
          <span className="risk-matrix__winrate-label">{lossCount ?? 0} losses</span>
          <span className="risk-matrix__cell--loss risk-matrix__winrate-amount">
            {fmtUsdSigned(-Math.abs(totalLossAmount || 0))}
          </span>
        </div>
        <div className="risk-matrix__winrate-pf">
          PF{' '}
          <span className="risk-matrix__winrate-pf-val">{pfLabel}</span>
        </div>
      </div>
    </div>
  );
}

// Monthly bars 6M.
function MonthlyBars6({ months, ytdAmount }) {
  const maxAbs = Math.max(...months.map((m) => Math.abs(m.pnl)), 1);
  const ytdTone =
    ytdAmount > 0 ? 'profit' : ytdAmount < 0 ? 'loss' : 'mute';
  const ytdLabel =
    ytdAmount === 0 || !Number.isFinite(ytdAmount) ? '—' : fmtUsdSigned(ytdAmount);
  return (
    <div className="risk-matrix__monthly-zone">
      <div className="risk-matrix__subzone-head">
        <span>MONTHLY P&amp;L · 6M</span>
        <span className={`risk-matrix__cell--${ytdTone}`}>{ytdLabel} ytd</span>
      </div>
      <div className="risk-matrix__monthly-bars">
        {months.map((m) => {
          const pnl = m.pnl;
          const tone = pnl > 0 ? 'profit' : pnl < 0 ? 'loss' : 'neutral';
          const pctRaw = (Math.abs(pnl) / maxAbs) * 100;
          const heightPct = pnl === 0 ? 8 : Math.max(pctRaw, 8);
          return (
            <div
              key={m.key}
              className={`risk-matrix__monthly-bar risk-matrix__monthly-bar--${tone}`}
              style={{ height: `${heightPct}%` }}
              title={`${m.label} ${fmtUsdSigned(pnl)}`}
            />
          );
        })}
      </div>
      <div className="risk-matrix__monthly-labels">
        {months.map((m) => (
          <span key={`${m.key}-l`} className="risk-matrix__monthly-label">
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Row helpers (DRY).
function RowPerf({ label, value, valueTone, bench, delta, deltaTone, gauge }) {
  return (
    <div className="risk-matrix__row risk-matrix__row--cols-perf">
      <span>{label}</span>
      <span
        className={`risk-matrix__cell--right${valueTone ? ` risk-matrix__cell--${valueTone}` : ''}`}
      >
        {value}
      </span>
      <span className="risk-matrix__cell--right risk-matrix__cell--mute">{bench ?? '—'}</span>
      <span
        className={`risk-matrix__cell--right${deltaTone ? ` risk-matrix__cell--${deltaTone}` : ' risk-matrix__cell--mute'}`}
      >
        {delta}
      </span>
      <span>{gauge}</span>
    </div>
  );
}

function Row3({ label, value, valueTone, sub, subTone, alert }) {
  return (
    <div
      className={`risk-matrix__row risk-matrix__row--cols-3${alert ? ' risk-matrix__row--alert-loss' : ''}`}
    >
      <span>{label}</span>
      <span
        className={`risk-matrix__cell--right${valueTone ? ` risk-matrix__cell--${valueTone}` : ''}`}
      >
        {value}
      </span>
      <span
        className={`risk-matrix__cell--right${subTone ? ` risk-matrix__cell--${subTone}` : ' risk-matrix__cell--mute'}`}
      >
        {sub}
      </span>
    </div>
  );
}

// ─── Greeks strip (B4) — Σ Δ/Γ/Θ/ν permanent sous le subheader ──
//
// Lit le hook useGreeksAggregate hissé au Dashboard. Aucun calcul
// ici, juste affichage. Sémantique de tone copiée sur GreeksAggregate
// (ref) : Δ profit/loss/mute, Γ toujours mute, Θ et ν profit si >0.
// Pour Sniper OTM short-call : Θ vert (encaisse), ν rouge (short vol).

const fmtUsdSigned2 = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return '$0.00';
  const sign = v > 0 ? '+' : '−';
  return `${sign}$${Math.abs(v).toFixed(2)}`;
};

const fmtNumSigned = (v, decimals = 0) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(decimals)}`;
};

const fmtUsdCompact = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
};

const toneFromSign = (v) => {
  if (v == null || !Number.isFinite(v) || v === 0) return 'mute';
  return v > 0 ? 'profit' : 'loss';
};

const GREEKS_LABELS = ['Σ DELTA', 'Σ GAMMA', 'Σ THETA', 'Σ VEGA', 'OPTIONS'];

function GreeksStripCell({ label, value, sub, tone }) {
  return (
    <div className="risk-matrix__greek-cell">
      <span className="risk-matrix__greek-label">{label}</span>
      <span
        className={`risk-matrix__greek-value risk-matrix__greek-value--${tone || 'mute'}`}
      >
        {value}
      </span>
      <span className="risk-matrix__greek-sub">{sub}</span>
    </div>
  );
}

function GreeksStrip({ greeks }) {
  const g = greeks || {};
  const loading = g.loading === true;
  const hasError = g.error != null;
  const noOptions = !loading && (g.optionsCount === 0 || hasError);

  if (loading) {
    return (
      <div className="risk-matrix__greeks-strip" aria-label="Greeks loading">
        {GREEKS_LABELS.map((lbl) => (
          <GreeksStripCell key={lbl} label={lbl} value="…" sub="fetching" tone="mute" />
        ))}
      </div>
    );
  }

  if (noOptions) {
    return (
      <div
        className="risk-matrix__greeks-strip"
        aria-label={hasError ? 'Greeks unavailable' : 'No options'}
      >
        {GREEKS_LABELS.map((lbl) => (
          <GreeksStripCell
            key={lbl}
            label={lbl}
            value="—"
            sub={hasError ? 'unavailable' : 'no options'}
            tone="mute"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="risk-matrix__greeks-strip" aria-label="Options greeks aggregated">
      <GreeksStripCell
        label="Σ DELTA"
        value={fmtNumSigned(g.sumDelta, 0)}
        sub={`exp ${fmtUsdCompact(g.notionalDelta)}`}
        tone={toneFromSign(g.sumDelta)}
      />
      <GreeksStripCell
        label="Σ GAMMA"
        value={fmtNum(g.sumGamma, 2)}
        sub="per $1↑"
        tone="mute"
      />
      <GreeksStripCell
        label="Σ THETA"
        value={fmtUsdSigned2(g.thetaDaily)}
        sub="/jour"
        tone={toneFromSign(g.thetaDaily)}
      />
      <GreeksStripCell
        label="Σ VEGA"
        value={fmtUsdSigned2(g.vegaPer1Pct)}
        sub="per 1%IV"
        tone={toneFromSign(g.vegaPer1Pct)}
      />
      <GreeksStripCell
        label="OPTIONS"
        value={String(g.optionsCount ?? 0)}
        sub="ouvertes"
        tone="neutral"
      />
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────

export default function RiskMatrix({ metrics, area = 'risk' }) {
  const m = metrics || {};
  const equityHistory = Array.isArray(m.equityHistory) ? m.equityHistory : [];
  // A3a — `m.liveRate` is null when fxValid is false (FX guard).
  // tradePnlUsd is USD-pure (respects stored t.pnl first), so propagating
  // null downstream is safe — USD calculations are FX-independent.
  const liveRate = m.liveRate;
  const closedTrades = useClosedTrades();
  const tradeCount = m.tradeCount ?? 0;

  // A2.1 — read the canonical resolution from calculatePortfolioMetrics
  // instead of re-deriving from totalFundedUsd + totalDepositedChf
  // (which collapses to 0 when the Flex CSV omits Cash Transactions).
  // `m.initialCapital` is nullable : null = "capital unknown" state.
  const initialCapital = m.initialCapital ?? null;

  // YTD Active : jours depuis le premier trade YTD.
  const ytdDaysActive = useMemo(() => {
    if (!closedTrades || closedTrades.length === 0) return null;
    const year = new Date().getUTCFullYear();
    const firstYtd = closedTrades
      .slice()
      .filter((t) => (t.do || t.di || '').startsWith(`${year}-`))
      .sort((a, b) => (a.do || a.di || '').localeCompare(b.do || b.di || ''))[0];
    if (!firstYtd) return null;
    const ms = Date.now() - new Date(firstYtd.do || firstYtd.di).getTime();
    return Math.max(0, Math.floor(ms / 86_400_000));
  }, [closedTrades]);

  // YTD amount : somme P&L YTD.
  const ytdAmount = useMemo(() => {
    if (!closedTrades || closedTrades.length === 0) return 0;
    const year = new Date().getUTCFullYear();
    let s = 0;
    for (const t of closedTrades) {
      if (!(t.do || t.di || '').startsWith(`${year}-`)) continue;
      s += tradePnlUsd(t, liveRate);
    }
    return s;
  }, [closedTrades, liveRate]);

  // Drawdown derivatives.
  const ddInfo = useMemo(() => {
    if (equityHistory.length === 0) {
      return { ddUsd: null, daysSincePeak: null, peakDate: null, recoveryPct: null, peakVal: null };
    }
    let peakIdx = 0;
    let peakVal = -Infinity;
    for (let i = 0; i < equityHistory.length; i++) {
      if (equityHistory[i].equity > peakVal) {
        peakVal = equityHistory[i].equity;
        peakIdx = i;
      }
    }
    const lastIdx = equityHistory.length - 1;
    const last = equityHistory[lastIdx];
    const ddUsd = Math.max(0, peakVal - last.equity);
    const peakDate = equityHistory[peakIdx].date;
    let daysSincePeak = 0;
    if (peakIdx !== lastIdx && peakDate && last.date) {
      const ms = new Date(last.date).getTime() - new Date(peakDate).getTime();
      if (Number.isFinite(ms) && ms > 0) daysSincePeak = Math.round(ms / 86_400_000);
    }
    const peakBase = initialCapital + peakVal;
    const recoveryPct = peakBase > 0 ? (ddUsd / peakBase) * 100 : null;
    return { ddUsd, daysSincePeak, peakDate, recoveryPct, peakVal };
  }, [equityHistory, initialCapital]);

  // A1 refactor : CAGR is read from the canonical single-source value
  // emitted by `calculatePortfolioMetrics` (m.cagr) instead of being
  // recomputed inline. Same formula, same inputs (closedTrades-based
  // date range + USD-equivalent initialCapital + realizedPnlUsd), so
  // the value is identical to the previous inline derivation modulo
  // the equityHistory-vs-sortedTrades date source — both arrays derive
  // from the same closedTrades via `computeEquityCurve`, so the first
  // and last dates match.
  const cagr = m.cagr ?? null;

  // Streak Current P&L sum.
  const streakPnlSum = useMemo(() => {
    if (!closedTrades || closedTrades.length === 0 || !m.currentStreak) return null;
    const sorted = closedTrades
      .slice()
      .filter((t) => t.do || t.di)
      .sort((a, b) => (b.do || b.di || '').localeCompare(a.do || a.di || ''));
    const targetSign = m.currentStreak > 0 ? 1 : -1;
    const limit = Math.abs(m.currentStreak);
    let sum = 0;
    let taken = 0;
    for (const t of sorted) {
      const pnl = tradePnlUsd(t, liveRate);
      const sign = pnl > 0 ? 1 : pnl < 0 ? -1 : 0;
      if (sign === targetSign) {
        sum += pnl;
        taken++;
        if (taken >= limit) break;
      } else if (sign !== 0) break;
    }
    return sum;
  }, [closedTrades, m.currentStreak, liveRate]);

  // Histogram.
  const histogram = useMemo(() => buildHistogram(m.rMultiples), [m.rMultiples]);

  // ─── Phase C.1.8 TODO résolution ─────────────────────────────

  // (A) Max DD YTD USD — dérivé inline depuis equityHistory filtré YTD.
  // Algorithme : running peak sur les points YTD, suit le pire trough
  // post-peak. Si moins de 2 points YTD → null (cohérent avec "—").
  const maxDDYtdUsd = useMemo(() => {
    if (equityHistory.length < 2) return null;
    const year = new Date().getFullYear().toString();
    const ytdPoints = equityHistory.filter((p) => p.date?.startsWith(year));
    if (ytdPoints.length < 2) return null;
    let peak = ytdPoints[0].equity;
    let maxDD = 0;
    for (const p of ytdPoints) {
      if (p.equity > peak) peak = p.equity;
      const dd = peak - p.equity;
      if (dd > maxDD) maxDD = dd;
    }
    return maxDD > 0 ? maxDD : null;
  }, [equityHistory]);

  // (B) Dates Max Win / Loss Streak — scan séquentiel sur closedTrades
  // triés par date. À chaque trade : si même signe que la streak en
  // cours → étendre. Sinon → reset. On garde la meilleure run par type.
  const streakDates = useMemo(() => {
    if (!closedTrades || closedTrades.length === 0) {
      return { winRange: null, lossRange: null };
    }
    const sorted = closedTrades
      .slice()
      .filter((t) => t.do || t.di)
      .sort((a, b) => (a.do || a.di || '').localeCompare(b.do || b.di || ''));

    let bestWin = { len: 0, start: null, end: null };
    let bestLoss = { len: 0, start: null, end: null };
    let curWin = { len: 0, start: null, end: null };
    let curLoss = { len: 0, start: null, end: null };

    for (const t of sorted) {
      const pnl = tradePnlUsd(t, liveRate);
      if (!Number.isFinite(pnl)) continue;
      const d = t.do || t.di;
      if (pnl > 0) {
        if (curWin.len === 0) curWin.start = d;
        curWin.len++;
        curWin.end = d;
        if (curWin.len > bestWin.len) bestWin = { ...curWin };
        curLoss = { len: 0, start: null, end: null };
      } else if (pnl < 0) {
        if (curLoss.len === 0) curLoss.start = d;
        curLoss.len++;
        curLoss.end = d;
        if (curLoss.len > bestLoss.len) bestLoss = { ...curLoss };
        curWin = { len: 0, start: null, end: null };
      }
      // break-even : ne casse ni étend (préserve la streak en cours
      // selon convention trading classique).
    }

    const fmtDate = (iso) => {
      if (!iso || typeof iso !== 'string') return null;
      const parts = iso.split('-');
      if (parts.length !== 3) return null;
      return `${parts[2]}/${parts[1]}`;
    };
    const fmtRange = (run) => {
      if (!run.start) return null;
      const s = fmtDate(run.start);
      const e = fmtDate(run.end);
      if (!s) return null;
      if (run.start === run.end || !e) return s;
      return `${s} → ${e}`;
    };
    return { winRange: fmtRange(bestWin), lossRange: fmtRange(bestLoss) };
  }, [closedTrades, liveRate]);

  // (C) FX Impact % — totalFxImpact CHF vs realizedPnlChf en valeur
  // absolue. Si l'un des deux est null/0 → null (cohérent avec "—").
  const fxImpactPct = useMemo(() => {
    if (
      !Number.isFinite(m.totalFxImpact) ||
      !Number.isFinite(m.realizedPnlChf) ||
      m.realizedPnlChf === 0
    ) {
      return null;
    }
    return (m.totalFxImpact / Math.abs(m.realizedPnlChf)) * 100;
  }, [m.totalFxImpact, m.realizedPnlChf]);

  // (D) TIER badge — reste hardcodé "TIER A · E0×C1" (TODO Phase C.3
  // quand `settings.activeSniperTier` sera exposé par le store).

  // ── Passe finale — underwater % sur realEquity ────────────────
  // 7e (et dernière) implémentation drawdown migrée vers la base
  // realEquity (init + cumPnL), cohérente avec A3b. Source de vérité :
  // m.realEquityPoints (de A3b equityTimeline). Math équivalent au
  // calcul précédent quand `initialCapital` est connu, mais signature
  // simplifiée (peak ET denom = realEquity_peak, plus de mélange
  // cumPnL/init+peak). Fallback sur equityHistory cumPnL si A2.1 init
  // unknown — dégradé honnête, pas de NaN.
  const ddCurve60 = useMemo(() => {
    const source =
      Array.isArray(m.realEquityPoints) && m.realEquityPoints.length > 0
        ? m.realEquityPoints
        : equityHistory;
    if (!source || source.length === 0) return [];
    const slice = source.slice(-60);
    let peak = -Infinity;
    return slice.map((p) => {
      if (p.equity > peak) peak = p.equity;
      const underwater = peak > 0 ? ((p.equity - peak) / peak) * 100 : 0;
      return { date: p.date, value: underwater };
    });
  }, [m.realEquityPoints, equityHistory]);

  const ddCurvePeakPct = useMemo(() => {
    if (ddCurve60.length === 0) return null;
    return Math.min(...ddCurve60.map((d) => d.value));
  }, [ddCurve60]);

  // Streak 13 last trades.
  const streak13 = useMemo(() => {
    if (!closedTrades || closedTrades.length === 0) return [];
    return closedTrades
      .slice()
      .filter((t) => t.do || t.di)
      .sort((a, b) => (a.do || a.di || '').localeCompare(b.do || b.di || ''))
      .slice(-13);
  }, [closedTrades]);

  // Monthly P&L 6M.
  const monthlyPnL = useMemo(
    () => computeMonthlyPnL(closedTrades || [], liveRate, 6),
    [closedTrades, liveRate]
  );

  // Total win / loss amounts.
  const totalWinAmount = useMemo(
    () => (m.winCount > 0 && Number.isFinite(m.averageWin) ? m.winCount * m.averageWin : 0),
    [m.winCount, m.averageWin]
  );
  const totalLossAmount = useMemo(
    () =>
      m.lossCount > 0 && Number.isFinite(m.averageLoss) ? m.lossCount * Math.abs(m.averageLoss) : 0,
    [m.lossCount, m.averageLoss]
  );

  // EDGE badge tone.
  const edge = useMemo(() => {
    const pf = m.profitFactor;
    const wr = m.winRate;
    const pfFinite = Number.isFinite(pf) || pf === Infinity;
    if (pfFinite && (pf === Infinity || pf > 1.5) && Number.isFinite(wr) && wr > 50) {
      return { tone: 'profit', label: 'EDGE+ ACTIF' };
    }
    if (pfFinite && (pf === Infinity || pf > 1)) {
      return { tone: 'amber', label: 'EDGE NEUTRE' };
    }
    return { tone: 'loss', label: 'EDGE− ALERTE' };
  }, [m.profitFactor, m.winRate]);

  // Vol (ann.) tone (lower-is-better). A2a — field renamed from
  // `vol30dPct` to `volAnnPct` (the 30-day window approach is retired;
  // the canonical primitive uses all-history returns + obs/years gate).
  const volTone = useMemo(() => {
    if (m.volAnnPct == null || !Number.isFinite(m.volAnnPct)) return 'mute';
    return m.volAnnPct > 20 ? 'amber' : 'profit';
  }, [m.volAnnPct]);

  // Updated timestamp.
  const updatedStr = new Date().toLocaleString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Δ vs benchmarks.
  const sharpeDelta = deltaVsBench(m.sharpeRatio, 1.0, true);
  const sortinoDelta = deltaVsBench(m.sortinoRatio, 1.5, true);
  const calmarDelta = deltaVsBench(m.calmarRatio, 3.0, true);
  const sqnDelta = deltaVsBench(m.sqn, 1.6, true);
  const cagrDelta = deltaVsBench(cagr, 15, true);
  const twrDelta = deltaVsBench(m.twr, 15, true);
  const volDelta = deltaVsBench(m.volAnnPct, 20, false);
  const recoveryDelta = deltaVsBench(m.recoveryFactor, 3.0, true);

  const pfEdge =
    m.profitFactor === Infinity
      ? { text: 'edge+', tone: 'profit' }
      : m.profitFactor == null || !Number.isFinite(m.profitFactor)
        ? { text: '—', tone: 'mute' }
        : m.profitFactor > 1.5
          ? { text: 'edge+', tone: 'profit' }
          : m.profitFactor < 1
            ? { text: 'edge−', tone: 'loss' }
            : { text: '—', tone: 'mute' };

  const rAvgEdge =
    m.rAverage == null || !Number.isFinite(m.rAverage)
      ? { text: '—', tone: 'mute' }
      : m.rAverage > 0
        ? { text: 'edge+', tone: 'profit' }
        : { text: 'edge−', tone: 'loss' };

  // ─── Render ──────────────────────────────────────────────────

  return (
    <section className="risk-matrix" style={{ gridArea: area }}>
      <header className="risk-matrix__header">
        <button type="button" className="risk-matrix__action risk-matrix__action--active">
          98) Detail
        </button>
        <button type="button" className="risk-matrix__action">
          99) Export
        </button>
        <button type="button" className="risk-matrix__action">
          97) History
        </button>
        <span className="risk-matrix__title">Performance · Risk · Behavior Cockpit</span>
      </header>

      <div className="risk-matrix__subheader">
        <div className="risk-matrix__context">
          <span>
            Init Cap{' '}
            <span className="risk-matrix__ctx-val">
              {initialCapital > 0 ? fmtUsd(initialCapital) : '—'}
            </span>
          </span>
          <span className="risk-matrix__dot">·</span>
          <span>
            Live FX <span className="risk-matrix__ctx-val">{fmtNum(liveRate, 4)}</span>
          </span>
          <span className="risk-matrix__dot">·</span>
          <span>
            N=<span className="risk-matrix__ctx-val">{tradeCount}</span> trades
          </span>
          <span className="risk-matrix__dot">·</span>
          <span>
            YTD Active{' '}
            <span className="risk-matrix__ctx-val">
              {ytdDaysActive != null ? `${ytdDaysActive} j` : '—'}
            </span>
          </span>
        </div>
        <div className="risk-matrix__context risk-matrix__context--right">
          <span className="risk-matrix__tier-badge">TIER A · E0×C1</span>
          <span className="risk-matrix__edge-badge" data-tone={edge.tone}>
            <span className="risk-matrix__edge-dot" aria-hidden="true" />
            {edge.label}
          </span>
        </div>
      </div>

      <GreeksStrip greeks={m.greeks} />

      <div className="risk-matrix__body">
        {/* ─────────────── COL 1 : Performance + R-Distribution ─────────── */}
        <div className="risk-matrix__col risk-matrix__col--left">
          <div className="risk-matrix__section-head risk-matrix__section-head--accent">
            <span>▼ Performance Metrics</span>
            {m.preliminaryRatios && (
              <span
                style={{
                  marginLeft: 10,
                  fontSize: 10,
                  letterSpacing: '0.04em',
                  fontStyle: 'italic',
                  opacity: 0.7,
                  textTransform: 'none',
                }}
                title={`Échantillon court : ${m.yearsActive != null ? `${(m.yearsActive * 365.25).toFixed(0)} j` : '< 1 an'}. Sharpe / Sortino / Calmar extrapolés (Calmar utilise CAGR annualisé = ${m.cagrAnnPct != null ? m.cagrAnnPct.toFixed(1) + '%' : '—'} / |MaxDD ${m.maxDrawdownPct != null ? m.maxDrawdownPct.toFixed(2) + '%' : '—'}|).`}
              >
                ~ préliminaire · échantillon &lt; 1 an
              </span>
            )}
          </div>
          <div className="risk-matrix__row risk-matrix__row--cols-perf risk-matrix__row--th">
            <span>Metric</span>
            <span className="risk-matrix__cell--right">Value</span>
            <span className="risk-matrix__cell--right">Bench</span>
            <span className="risk-matrix__cell--right">Δ</span>
            <span className="risk-matrix__cell--right">Range</span>
          </div>
          <RowPerf
            label="Sharpe (YTD)"
            value={fmtNum(m.sharpeRatio)}
            valueTone="value"
            bench="1.00"
            delta={sharpeDelta.text}
            deltaTone={sharpeDelta.tone}
            gauge={<MetricGauge value={m.sharpeRatio} bench={1.0} mode="higher-is-better" />}
          />
          <RowPerf
            label="Sortino"
            value={fmtNum(m.sortinoRatio)}
            valueTone="value"
            bench="1.50"
            delta={sortinoDelta.text}
            deltaTone={sortinoDelta.tone}
            gauge={<MetricGauge value={m.sortinoRatio} bench={1.5} mode="higher-is-better" />}
          />
          <RowPerf
            label="Calmar"
            value={fmtNum(m.calmarRatio)}
            valueTone="value"
            bench="3.00"
            delta={calmarDelta.text}
            deltaTone={calmarDelta.tone}
            gauge={<MetricGauge value={m.calmarRatio} bench={3.0} mode="higher-is-better" />}
          />
          <RowPerf
            label="SQN"
            value={fmtNum(m.sqn)}
            valueTone="value"
            bench="1.60"
            delta={sqnDelta.text}
            deltaTone={sqnDelta.tone}
            gauge={<MetricGauge value={m.sqn} bench={1.6} mode="higher-is-better" />}
          />
          {/* A3b — TWR (time-weighted return) — neutralises the timing
              of deposits, the canonical "trading performance" KPI.
              Label switches "TWR (ann.)" / "TWR Cumulé" by m.twrMode.
              Bench 15 % aligns with the CAGR target — same scale. */}
          <RowPerf
            label={m.twrMode === 'cumulative' ? 'TWR Cumulé' : 'TWR (ann.)'}
            value={fmtPct(m.twr)}
            valueTone="value"
            bench="15.0%"
            delta={twrDelta.text}
            deltaTone={twrDelta.tone}
            gauge={<MetricGauge value={m.twr} bench={15} mode="higher-is-better" />}
          />
          {/* A2.2 — label switches to "Cumulé" when years < 1 (no
              annualisation applied). Bench stays at 15 % to give a
              comparable reference target in both modes. CAGR is the
              SIMPLE return on initial capital (mechanically rewards
              big later deposits) — TWR is the timing-neutral truth. */}
          <RowPerf
            label={m.cagrMode === 'cumulative' ? 'Cumulé' : 'CAGR'}
            value={fmtPct(cagr)}
            valueTone="value"
            bench="15.0%"
            delta={cagrDelta.text}
            deltaTone={cagrDelta.tone}
            gauge={<MetricGauge value={cagr} bench={15} mode="higher-is-better" />}
          />
          <RowPerf
            label="Vol (ann.)"
            value={fmtPct(m.volAnnPct)}
            valueTone={volTone}
            bench="20.0%"
            delta={volDelta.text}
            deltaTone={volDelta.tone}
            gauge={<MetricGauge value={m.volAnnPct} bench={20} mode="lower-is-better" />}
          />
          <RowPerf
            label="Recovery Factor"
            value={
              m.recoveryFactor == null || !Number.isFinite(m.recoveryFactor)
                ? '—'
                : `${fmtNum(m.recoveryFactor)}×`
            }
            valueTone="value"
            bench="3.0×"
            delta={recoveryDelta.text}
            deltaTone={recoveryDelta.tone}
            gauge={<MetricGauge value={m.recoveryFactor} bench={3.0} mode="higher-is-better" />}
          />
          <RowPerf
            label="Expectancy"
            value={fmtUsdSigned(m.expectancy)}
            valueTone={
              m.expectancy == null
                ? 'mute'
                : m.expectancy > 0
                  ? 'profit-bold'
                  : m.expectancy < 0
                    ? 'loss-bold'
                    : 'mute'
            }
            bench="—"
            delta={fmtPctSigned(m.expectancy, 0)}
            deltaTone={m.expectancy > 0 ? 'profit' : m.expectancy < 0 ? 'loss' : 'mute'}
            gauge={<MetricGauge value={m.expectancy} bench={null} mode="info" />}
          />
          <RowPerf
            label="Kelly Optimal"
            value={fmtPct(m.kellyPercent)}
            valueTone="amber"
            bench="—"
            delta="info"
            deltaTone="amber"
            gauge={<MetricGauge value={m.kellyPercent} bench={null} mode="info" />}
          />
          <RowPerf
            label="R Avg / σ"
            value={m.rAverage == null ? '—' : `${m.rAverage >= 0 ? '+' : ''}${fmtNum(m.rAverage)}`}
            valueTone={
              m.rAverage == null ? 'mute' : m.rAverage > 0 ? 'profit-bold' : 'loss-bold'
            }
            bench={`σ ${fmtNum(m.rStdDev)}`}
            delta={rAvgEdge.text}
            deltaTone={rAvgEdge.tone}
            gauge={<MetricGauge value={m.rAverage} bench={0} mode="higher-is-better" />}
          />

          <div className="risk-matrix__section-head risk-matrix__section-head--accent risk-matrix__section-head--pushdown">
            <span>▼ Distribution R-Multiples</span>
            <span className="risk-matrix__section-head-info">N={tradeCount}</span>
          </div>
          <div className="risk-matrix__histogram">
            {histogram.max === 0 ? (
              <div className="risk-matrix__histogram-empty">Aucun trade fermé</div>
            ) : (
              histogram.buckets.map((b, i) => {
                const heightPct = histogram.max > 0 ? (b.count / histogram.max) * 100 : 0;
                const modifier = b.max && b.count > 0 ? `${b.kind}-strong` : b.kind;
                return (
                  <div
                    key={i}
                    className={`risk-matrix__histogram-bar risk-matrix__histogram-bar--${modifier}`}
                    style={{ height: `${heightPct}%` }}
                    title={`${b.count} trade${b.count > 1 ? 's' : ''}`}
                  />
                );
              })
            )}
          </div>
          <div className="risk-matrix__histogram-axis">
            <span>−3R</span>
            <span>−1R</span>
            <span>0</span>
            <span>+1R</span>
            <span>+3R</span>
          </div>
        </div>

        {/* ─────────────── COL 2 : Drawdown · Streak ─────────────────────── */}
        <div className="risk-matrix__col risk-matrix__col--mid">
          <div className="risk-matrix__section-head risk-matrix__section-head--loss">
            <span>▼ Drawdown · Streak</span>
          </div>
          <div className="risk-matrix__row risk-matrix__row--cols-3 risk-matrix__row--th">
            <span>Metric</span>
            <span className="risk-matrix__cell--right">USD</span>
            <span className="risk-matrix__cell--right">%</span>
          </div>
          <Row3
            label="⚠ Current DD"
            value={ddInfo.ddUsd != null && ddInfo.ddUsd > 0 ? `−${fmtUsd(ddInfo.ddUsd).replace(/^-/, '')}` : '—'}
            valueTone={ddInfo.ddUsd && ddInfo.ddUsd > 0 ? 'loss-bold' : 'mute'}
            sub={fmtPctSigned(m.currentDDPct, 2)}
            subTone={m.currentDDPct != null && m.currentDDPct < 0 ? 'loss' : 'mute'}
            alert={ddInfo.ddUsd != null && ddInfo.ddUsd > 0}
          />
          <Row3
            label="Max DD YTD"
            value={maxDDYtdUsd != null ? `−${fmtUsd(maxDDYtdUsd)}` : '—'}
            valueTone={maxDDYtdUsd != null ? 'loss-bold' : 'mute'}
            sub={m.maxDDYtdPct > 0 ? `−${fmtPct(m.maxDDYtdPct, 2)}` : '—'}
            subTone={m.maxDDYtdPct > 0 ? 'loss' : 'mute'}
          />
          <Row3
            label="Max DD All-Time"
            value={
              m.maxDrawdown != null && Number.isFinite(m.maxDrawdown) && m.maxDrawdown > 0
                ? `−${fmtUsd(m.maxDrawdown)}`
                : '—'
            }
            valueTone={m.maxDrawdown > 0 ? 'loss-bold' : 'mute'}
            sub={m.maxDrawdownPct > 0 ? `−${fmtPct(m.maxDrawdownPct, 2)}` : '—'}
            subTone={m.maxDrawdownPct > 0 ? 'loss' : 'mute'}
          />
          <Row3
            label="Days Since Peak"
            value={ddInfo.daysSincePeak != null ? `${ddInfo.daysSincePeak}` : '—'}
            valueTone="value"
            sub={ddInfo.peakDate || '—'}
            subTone="mute"
          />
          <Row3
            label="Recovery to Peak"
            value={ddInfo.ddUsd != null && ddInfo.ddUsd > 0 ? fmtUsd(ddInfo.ddUsd) : '—'}
            valueTone="amber"
            sub={fmtPct(ddInfo.recoveryPct)}
            subTone="amber"
          />

          <div className="risk-matrix__subzone">
            <div className="risk-matrix__subzone-head">
              <span>DD CURVE · 60 J</span>
              <span className="risk-matrix__cell--loss">
                Peak {ddCurvePeakPct != null ? `${ddCurvePeakPct.toFixed(2)}%` : '—'}
              </span>
            </div>
            <DdSparkline data={ddCurve60} />
          </div>

          <Row3
            label="Streak Current"
            value={
              m.currentStreak > 0
                ? `▲ ${m.currentStreak}W`
                : m.currentStreak < 0
                  ? `▼ ${Math.abs(m.currentStreak)}L`
                  : '—'
            }
            valueTone={m.currentStreak > 0 ? 'profit' : m.currentStreak < 0 ? 'loss' : 'mute'}
            sub={streakPnlSum != null ? fmtUsdSigned(streakPnlSum) : '—'}
            subTone={
              streakPnlSum == null ? 'mute' : streakPnlSum > 0 ? 'profit' : 'loss'
            }
          />
          <Row3
            label="Max Win Streak"
            value={`${m.maxWinStreak ?? 0}W`}
            valueTone={m.maxWinStreak > 0 ? 'profit' : 'mute'}
            sub={streakDates.winRange || '—'}
            subTone={streakDates.winRange ? 'mute' : 'mute'}
          />
          <Row3
            label="Max Loss Streak"
            value={`${m.maxLossStreak ?? 0}L`}
            valueTone={m.maxLossStreak > 0 ? 'loss' : 'mute'}
            sub={streakDates.lossRange || '—'}
            subTone="mute"
          />

          <div className="risk-matrix__subzone risk-matrix__subzone--push">
            <div className="risk-matrix__subzone-head">
              <span>STREAK PATTERN · 13 LAST</span>
              <span className="risk-matrix__cell--mute">{streak13.length}/13</span>
            </div>
            <StreakPattern
              trades={streak13}
              liveRate={liveRate}
              currentStreak={m.currentStreak}
            />
          </div>
        </div>

        {/* ─────────────── COL 3 : Win/Loss + Donut + Monthly ───────────── */}
        <div className="risk-matrix__col risk-matrix__col--right">
          <div className="risk-matrix__section-head risk-matrix__section-head--accent">
            <span>▼ Win / Loss Stats</span>
          </div>
          <div className="risk-matrix__row risk-matrix__row--cols-3 risk-matrix__row--th">
            <span>Stat</span>
            <span className="risk-matrix__cell--right">Count</span>
            <span className="risk-matrix__cell--right">$ Avg</span>
          </div>
          <Row3
            label="Wins"
            value={`${m.winCount ?? 0}`}
            valueTone={m.winCount > 0 ? 'profit' : 'mute'}
            sub={fmtUsdSigned(m.averageWin)}
            subTone="profit"
          />
          <Row3
            label="Losses"
            value={`${m.lossCount ?? 0}`}
            valueTone={m.lossCount > 0 ? 'loss' : 'mute'}
            sub={
              m.averageLoss != null && Number.isFinite(m.averageLoss)
                ? fmtUsdSigned(-Math.abs(m.averageLoss))
                : '—'
            }
            subTone="loss"
          />
          <Row3
            label="Break-Even"
            value={`${m.breakEvenCount ?? 0}`}
            valueTone="mute"
            sub="—"
            subTone="mute"
          />
          <Row3
            label="Win Rate"
            value={fmtPct(m.winRate)}
            valueTone="value"
            sub={
              (m.winCount ?? 0) + (m.lossCount ?? 0) > 0
                ? `${m.winCount ?? 0} / ${tradeCount}`
                : '—'
            }
            subTone="mute"
          />
          <Row3
            label="Profit Factor"
            value={
              m.profitFactor === Infinity
                ? '∞'
                : m.profitFactor != null && Number.isFinite(m.profitFactor)
                  ? fmtNum(m.profitFactor)
                  : '—'
            }
            valueTone="value"
            sub={pfEdge.text}
            subTone={pfEdge.tone}
          />
          <Row3
            label="Total Fees"
            value={fmtUsd(m.totalAllFees)}
            valueTone="mute"
            sub={
              m.totalAllFees != null && tradeCount > 0
                ? `${(m.totalAllFees / tradeCount).toFixed(2)} / tr`
                : '—'
            }
            subTone="mute"
          />
          <Row3
            label="FX Impact"
            value={
              m.totalFxImpact != null && Number.isFinite(m.totalFxImpact)
                ? `CHF ${m.totalFxImpact >= 0 ? '+' : ''}${Math.round(m.totalFxImpact).toLocaleString('de-CH')}`
                : '—'
            }
            valueTone={
              m.totalFxImpact == null
                ? 'mute'
                : m.totalFxImpact > 0
                  ? 'profit'
                  : m.totalFxImpact < 0
                    ? 'loss'
                    : 'mute'
            }
            sub={
              fxImpactPct != null
                ? `${fxImpactPct >= 0 ? '+' : ''}${fxImpactPct.toFixed(2)}%`
                : '—'
            }
            subTone={
              fxImpactPct == null
                ? 'mute'
                : fxImpactPct > 0
                  ? 'profit'
                  : fxImpactPct < 0
                    ? 'loss'
                    : 'mute'
            }
          />

          <div className="risk-matrix__subzone">
            <div className="risk-matrix__subzone-head">
              <span>WIN RATE GAUGE</span>
              <span className="risk-matrix__cell--accent">
                PF{' '}
                {m.profitFactor === Infinity
                  ? '∞'
                  : Number.isFinite(m.profitFactor)
                    ? m.profitFactor.toFixed(2)
                    : '—'}
              </span>
            </div>
            <WinRateGauge
              winRate={m.winRate}
              profitFactor={m.profitFactor}
              winCount={m.winCount}
              lossCount={m.lossCount}
              totalWinAmount={totalWinAmount}
              totalLossAmount={totalLossAmount}
            />
          </div>

          <MonthlyBars6 months={monthlyPnL} ytdAmount={ytdAmount} />
        </div>
      </div>

      <footer className="risk-matrix__footer">
        <span>Updated {updatedStr} CET · IBKR Flex Sync · QueryID 1443387</span>
        <div className="risk-matrix__footer-cmd-wrap">
          <span className="risk-matrix__footer-cmd-label">PMET</span>
          <span className="risk-matrix__footer-cmd">&lt;GO&gt;</span>
        </div>
      </footer>
    </section>
  );
}
