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
//  Footer 26 px : ligne de synchro VÉRIDIQUE (lastSync — É3.2 :
//  IMPORT CSV / IBKR FLEX · Query masqué / IBKR BRIDGE, ou rien)
//  + PMET <GO>.
//
//  Tous les colors via var(--*). Aucun hex hardcoded.
//
//  TODO Phase C ultérieure (signalés en rapport) :
//    TIER badge hardcodé, Max DD YTD USD non dérivé, dates Max
//    W/L Streak non dispo, FX Impact % non dérivable simply.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useClosedTrades, useSettings } from '../../store/useStore';
import { tradePnlUsd } from '../../utils/calculations';
// S2 (É4-a) — `tierParams` (badge TIER « A · E0×C1 ») RETIRÉ : doctrine V1
// morte (régime VIX + palier Edge + Capital tier, abolie par la carte V3).
// Le magasin dormant (settings.activeSniperTier + reducer + migrations +
// SniperMetaEditor + PerformanceAttribution) reste en place → purge = refonte
// de module CONSIGNÉE (hors périmètre recette).
// É3.1 — métriques de courbe via la maison unique (curveStats) : DD
// courant, jours-depuis-pic CALENDAIRES, max DD YTD. Courbe RÉAL.
import { currentDrawdownOf, daysSincePeakOf, maxDrawdownOf } from '../../utils/metrics/curveStats';
// É3.2 — la ligne de synchro du footer dit la vérité de lastSync
// (source csv/flex/bridge, QueryID masqué) ou n'existe pas.
import { deriveSyncLabel } from '../../utils/syncProvenance';
// É3.3 — dates calendaires au format central dd.mm.yy.
import { fmtDate } from '../../utils/format';

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

const USD_FMT_0D_RM = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 });
const fmtUsd = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  return (v < 0 ? '-' : '') + '$' + USD_FMT_0D_RM.format(Math.abs(v));
};

const fmtUsdSigned = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return '$0';
  return (v > 0 ? '+' : '-') + '$' + USD_FMT_0D_RM.format(Math.abs(v));
};

// COULEUR (v1.0.1/4, D1a) : le Δ vs bench d'un RATIO est une
// STATISTIQUE — le signe reste dans le texte, le jugement coloré est
// mort. Toujours mute.
function deltaVsBench(value, bench) {
  if (value == null || !Number.isFinite(value) || bench == null) {
    return { text: '—', tone: 'mute' };
  }
  const d = value - bench;
  if (d === 0) return { text: '0', tone: 'mute' };
  const sign = d > 0 ? '+' : '';
  return { text: `${sign}${d.toFixed(2)}`, tone: 'mute' };
}

// ─── Export CSV de la matrice ───────────────────────────────────
// Même convention que History.exportCsv : Blob text/csv horodaté,
// téléchargement via <a download> au format ibkr-<nom>-<date>.csv.
// `rows` = Array<[Section, Métrique, Valeur, Détail]> déjà formatées —
// on sérialise exactement ce qui est rendu, aucune donnée inventée.
function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadRiskMatrixCsv(rows) {
  const header = ['Section', 'Métrique', 'Valeur', 'Détail'];
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ibkr-risk-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
// `mode` : 'higher-is-better' | 'lower-is-better' | 'info' (mode ne
// sert plus qu'à la géométrie — COULEUR D1b : remplissage NEUTRE
// ink-soft sur piste hairline, graduations conservées ; le jugement
// vert/rouge d'un RATIO est mort, le repère ambre 70 % reste exclusif
// aux jauges de capital/exposition).
function MetricGauge({ value, bench, mode = 'higher-is-better' }) {
  if (value == null || !Number.isFinite(value)) {
    return <div className="risk-matrix__gauge" aria-hidden="true" />;
  }
  if (mode === 'info') {
    return (
      <div className="risk-matrix__gauge" aria-hidden="true">
        <div className="risk-matrix__gauge-fill" style={{ width: '50%' }} />
      </div>
    );
  }
  // Fallback bench=0 (R Avg) — use abs(value) * 50 as scale.
  if (bench == null || bench === 0) {
    const fillPct = Math.min(100, Math.max(0, Math.abs(value) * 50));
    return (
      <div className="risk-matrix__gauge" aria-hidden="true">
        <div className="risk-matrix__gauge-fill" style={{ width: `${fillPct}%` }} />
      </div>
    );
  }
  // Standard : fill = value / (bench*2) * 100, clampé 0-100. Marker à 50% (bench position).
  const fillPct = Math.min(100, Math.max(0, (value / (bench * 2)) * 100));
  return (
    <div className="risk-matrix__gauge" aria-hidden="true">
      <div className="risk-matrix__gauge-fill" style={{ width: `${fillPct}%` }} />
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
          <span className="risk-matrix__winrate-label">{winCount ?? 0} gagnants</span>
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
          <span className="risk-matrix__winrate-label">{lossCount ?? 0} perdants</span>
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
        <span>P&amp;L MENSUEL · 6M</span>
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

// Row helpers (DRY). `title` (É3.1) = formule/base en une ligne,
// tooltip natif — zéro impact layout.
function RowPerf({ label, value, valueTone, bench, delta, deltaTone, gauge, title }) {
  return (
    <div className="risk-matrix__row risk-matrix__row--cols-perf" title={title || undefined}>
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

function Row3({ label, value, valueTone, sub, subTone, alert, title }) {
  return (
    <div
      className={`risk-matrix__row risk-matrix__row--cols-3${alert ? ' risk-matrix__row--alert-loss' : ''}`}
      title={title || undefined}
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

// É3 §4.2.3 — la GreeksStrip (Σ Δ/Γ/Θ/ν/OPTIONS) est MORTE ici :
// triplication éteinte. Le résumé décisionnel vit dans la bande
// CAPITAL (Δ NET, Θ TOTAL), le portefeuille dans le PortfolioDeck
// (Δ/Γ/Θ/V NET), le détail par position dans les tables et la page
// Greeks (⌘4). RiskMatrix reste la vue détaillée historique/statistique.

// ─── Main component ─────────────────────────────────────────────

export default function RiskMatrix({ metrics, area = 'risk' }) {
  const m = metrics || {};
  const equityHistory = Array.isArray(m.equityHistory) ? m.equityHistory : [];
  // A3a — `m.liveRate` is null when fxValid is false (FX guard).
  // tradePnlUsd is USD-pure (respects stored t.pnl first), so propagating
  // null downstream is safe — USD calculations are FX-independent.
  const liveRate = m.liveRate;
  const closedTrades = useClosedTrades();
  const settings = useSettings();
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

  // Drawdown derivatives — É3.1 : via curveStats sur la courbe RÉAL
  // realEquityPoints (init + cumPnL par jour de clôture, même base que
  // m.currentDDPct/m.maxDDYtdPct — fini le $ par-trade face à un % par-
  // jour dans la même ligne), fallback equityHistory. Jours-depuis-pic
  // en jours CALENDAIRES vers AUJOURD'HUI : la courbe réalisée est figée
  // après la dernière clôture, mesurer pic→dernier trade mentait
  // (« 11 » affiché pour un pic vieux de 110 jours — constat 15.08).
  const realCurvePoints = useMemo(() => {
    const source =
      Array.isArray(m.realEquityPoints) && m.realEquityPoints.length > 0
        ? m.realEquityPoints
        : equityHistory;
    return source.map((p) => ({ date: p.date, value: p.equity }));
  }, [m.realEquityPoints, equityHistory]);

  const ddInfo = useMemo(() => {
    if (realCurvePoints.length === 0) {
      return { ddUsd: null, daysSincePeak: null, peakDate: null };
    }
    const cur = currentDrawdownOf(realCurvePoints);
    const today = new Date().toISOString().slice(0, 10);
    const dsp = daysSincePeakOf(realCurvePoints, today);
    return {
      ddUsd: cur ? cur.usd : null,
      daysSincePeak: dsp ? dsp.days : null,
      peakDate: dsp ? dsp.date : null,
    };
  }, [realCurvePoints]);

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

  // (A) Max DD YTD USD — É3.1 : curveStats.maxDrawdownOf sur la MÊME
  // courbe RÉAL que le % voisin (m.maxDDYtdPct, realEquityPoints) —
  // fini le $ par-trade face à un % par-jour. < 2 points YTD → null.
  const maxDDYtdUsd = useMemo(() => {
    if (realCurvePoints.length < 2) return null;
    const year = new Date().getFullYear().toString();
    const ytdPoints = realCurvePoints.filter((p) => p.date?.startsWith(year));
    if (ytdPoints.length < 2) return null;
    const dd = maxDrawdownOf(ytdPoints);
    return dd && dd.usd > 0 ? dd.usd : null;
  }, [realCurvePoints]);

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

    // É3.3 — dates au format central dd.mm.yy (l'ex « 30/03 » est mort).
    const day = (iso) => (fmtDate(iso) === '—' ? null : fmtDate(iso));
    const fmtRange = (run) => {
      if (!run.start) return null;
      const s = day(run.start);
      const e = day(run.end);
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

  // (D) TIER badge SUPPRIMÉ (S2 · É4-a) — doctrine V1 morte, cf. import.

  // (E) É3.2 — ligne de synchro du footer : pilotée par
  // settings.lastSync (rc.4). source=csv → IMPORT CSV + fichier/date ;
  // source=flex → IBKR FLEX · Query ****xxxx (QueryID localStorage,
  // masqué) ; bridge (string) → IBKR BRIDGE + date ; rien → ligne
  // MORTE. Plus jamais « —— », plus jamais « IBKR Flex Sync » en dur,
  // plus jamais l'horloge de rendu déguisée en fraîcheur (« Updated »).
  const syncLabel = useMemo(() => {
    let queryId = null;
    try {
      queryId = window.localStorage.getItem('ibkr_flex_queryid');
    } catch {
      queryId = null;
    }
    return deriveSyncLabel(settings?.lastSync, queryId);
  }, [settings?.lastSync]);

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

  // EDGE badge — COULEUR (D1c) : l'INFO survit (le libellé, dérivé de
  // PF & win rate), le jugement coloré est mort — variante neutre
  // unique (PF/WR sont des ratios, pas de l'argent).
  const edge = useMemo(() => {
    const pf = m.profitFactor;
    const wr = m.winRate;
    const pfFinite = Number.isFinite(pf) || pf === Infinity;
    if (pfFinite && (pf === Infinity || pf > 1.5) && Number.isFinite(wr) && wr > 50) {
      return { label: 'EDGE+ ACTIF' };
    }
    if (pfFinite && (pf === Infinity || pf > 1)) {
      return { label: 'EDGE NEUTRE' };
    }
    return { label: 'EDGE− ALERTE' };
  }, [m.profitFactor, m.winRate]);

  // COULEUR (D1a) — volTone est MORT (une volatilité est une
  // statistique, pas de l'argent : ligne Vol neutre).
  // É3.2 — l'ex `updatedStr` (new Date() au render, affiché comme une
  // fraîcheur de synchro) est MORT : la vérité vit dans syncLabel.

  // Δ vs benchmarks — tous mute (COULEUR D1a : statistiques).
  const sharpeDelta = deltaVsBench(m.sharpeRatio, 1.0);
  const sortinoDelta = deltaVsBench(m.sortinoRatio, 1.5);
  const calmarDelta = deltaVsBench(m.calmarRatio, 3.0);
  const sqnDelta = deltaVsBench(m.sqn, 1.6);
  const cagrDelta = deltaVsBench(cagr, 15);
  const twrDelta = deltaVsBench(m.twr, 15);
  const volDelta = deltaVsBench(m.volAnnPct, 20);
  const recoveryDelta = deltaVsBench(m.recoveryFactor, 3.0);

  // Mentions edge+/edge− : l'info textuelle survit, le ton meurt (D1a).
  const pfEdge =
    m.profitFactor === Infinity
      ? { text: 'EDGE+', tone: 'mute' }
      : m.profitFactor == null || !Number.isFinite(m.profitFactor)
        ? { text: '—', tone: 'mute' }
        : m.profitFactor > 1.5
          ? { text: 'EDGE+', tone: 'mute' }
          : m.profitFactor < 1
            ? { text: 'EDGE−', tone: 'mute' }
            : { text: '—', tone: 'mute' };

  const rAvgEdge =
    m.rAverage == null || !Number.isFinite(m.rAverage)
      ? { text: '—', tone: 'mute' }
      : m.rAverage > 0
        ? { text: 'EDGE+', tone: 'mute' }
        : { text: 'EDGE−', tone: 'mute' };

  // U3 — Export CSV : sérialise les métriques affichées du cockpit
  // (mêmes champs m.* et mêmes formatters que le rendu). Désactivé
  // quand 0 trade fermé (tout serait '—').
  const handleExport = () => {
    const rows = [
      ['Contexte', 'Capital initial', fmtUsd(initialCapital), ''],
      ['Contexte', 'FX live USD/CHF', fmtNum(liveRate, 4), ''],
      ['Contexte', 'Trades (N)', String(tradeCount), ''],
      ['Contexte', 'YTD actif (jours)', ytdDaysActive != null ? String(ytdDaysActive) : '—', ''],

      ['Performance', 'Sharpe (YTD)', fmtNum(m.sharpeRatio), 'bench 1.00'],
      ['Performance', 'Sortino', fmtNum(m.sortinoRatio), 'bench 1.50'],
      ['Performance', 'Calmar', fmtNum(m.calmarRatio), 'bench 3.00'],
      ['Performance', 'SQN', fmtNum(m.sqn), 'bench 1.60'],
      ['Performance', m.twrMode === 'cumulative' ? 'TWR Cumulé · RÉAL' : 'TWR (ann.) · RÉAL', fmtPct(m.twr), 'bench 15.0%'],
      ['Performance', m.cagrMode === 'cumulative' ? 'Cumulé · RÉAL' : 'CAGR · RÉAL', fmtPct(cagr), 'bench 15.0%'],
      ['Performance', 'Vol (ann.)', fmtPct(m.volAnnPct), 'bench 20.0%'],
      [
        'Performance',
        'Recovery Factor · RÉAL',
        m.recoveryFactor == null || !Number.isFinite(m.recoveryFactor)
          ? '—'
          : `${fmtNum(m.recoveryFactor)}×`,
        'bench 3.0×',
      ],
      ['Performance', 'Expectancy', fmtUsdSigned(m.expectancy), ''],
      ['Performance', 'Kelly optimal', fmtPct(m.kellyPercent), ''],
      [
        'Performance',
        'R moy.',
        m.rAverage == null ? '—' : `${m.rAverage >= 0 ? '+' : ''}${fmtNum(m.rAverage)}`,
        `σ ${fmtNum(m.rStdDev)}`,
      ],

      [
        'Drawdown',
        'DD courant · RÉAL',
        ddInfo.ddUsd != null && ddInfo.ddUsd > 0 ? `−${fmtUsd(ddInfo.ddUsd).replace(/^-/, '')}` : '—',
        fmtPctSigned(m.currentDDPct, 2),
      ],
      [
        'Drawdown',
        'Max DD · RÉAL · YTD',
        maxDDYtdUsd != null ? `−${fmtUsd(maxDDYtdUsd)}` : '—',
        m.maxDDYtdPct > 0 ? `−${fmtPct(m.maxDDYtdPct, 2)}` : '—',
      ],
      [
        'Drawdown',
        'Max DD · RÉAL · ALL',
        m.maxDrawdown != null && Number.isFinite(m.maxDrawdown) && m.maxDrawdown > 0
          ? `−${fmtUsd(m.maxDrawdown)}`
          : '—',
        m.maxDrawdownPct > 0 ? `−${fmtPct(m.maxDrawdownPct, 2)}` : '—',
      ],
      [
        'Drawdown',
        'Depuis pic · RÉAL',
        ddInfo.daysSincePeak != null ? `${ddInfo.daysSincePeak} j` : '—',
        ddInfo.peakDate ? `pic ${fmtDate(ddInfo.peakDate)}` : '—',
      ],
      [
        'Drawdown',
        'Récupération',
        m.recoveryPctValue != null && Number.isFinite(m.recoveryPctValue)
          ? fmtPct(m.recoveryPctValue)
          : '—',
        'du creux récupéré',
      ],

      [
        'Séries',
        'Série en cours',
        m.currentStreak > 0
          ? `${m.currentStreak}W`
          : m.currentStreak < 0
            ? `${Math.abs(m.currentStreak)}L`
            : '—',
        streakPnlSum != null ? fmtUsdSigned(streakPnlSum) : '—',
      ],
      ['Séries', 'Série gagn. max', `${m.maxWinStreak ?? 0}W`, ''],
      ['Séries', 'Série perd. max', `${m.maxLossStreak ?? 0}L`, ''],

      ['Gains/Pertes', 'Gagnants', `${m.winCount ?? 0}`, fmtUsdSigned(m.averageWin)],
      [
        'Gains/Pertes',
        'Perdants',
        `${m.lossCount ?? 0}`,
        m.averageLoss != null && Number.isFinite(m.averageLoss)
          ? fmtUsdSigned(-Math.abs(m.averageLoss))
          : '—',
      ],
      ['Gains/Pertes', 'Break-Even', `${m.breakEvenCount ?? 0}`, ''],
      ['Gains/Pertes', 'Win Rate', fmtPct(m.winRate), ''],
      [
        'Gains/Pertes',
        'Profit Factor',
        m.profitFactor === Infinity
          ? '∞'
          : m.profitFactor != null && Number.isFinite(m.profitFactor)
            ? fmtNum(m.profitFactor)
            : '—',
        '',
      ],
      ['Gains/Pertes', 'Frais totaux', fmtUsd(m.totalAllFees), ''],
      [
        'Gains/Pertes',
        'Impact FX',
        m.totalFxImpact != null && Number.isFinite(m.totalFxImpact)
          ? `CHF ${m.totalFxImpact >= 0 ? '+' : ''}${Math.round(m.totalFxImpact)}`
          : '—',
        '',
      ],
      ['Gains/Pertes', 'P&L YTD', fmtUsdSigned(ytdAmount), ''],
    ];
    downloadRiskMatrixCsv(rows);
  };

  // ─── Render ──────────────────────────────────────────────────

  return (
    <section className="risk-matrix" style={{ gridArea: area }}>
      <header className="risk-matrix__header">
        <button
          type="button"
          className="risk-matrix__action"
          onClick={handleExport}
          disabled={tradeCount === 0}
          title="Exporter la matrice de risque (CSV)"
        >
          Exporter CSV
        </button>
        {/* É3.3 — langue : une seule voix. */}
        <span className="risk-matrix__title">Cockpit · Performance · Risque · Comportement</span>
      </header>

      <div className="risk-matrix__subheader">
        <div className="risk-matrix__context">
          <span>
            Cap. initial{' '}
            <span className="risk-matrix__ctx-val">
              {initialCapital > 0 ? fmtUsd(initialCapital) : '—'}
            </span>
          </span>
          <span className="risk-matrix__dot">·</span>
          <span>
            FX live <span className="risk-matrix__ctx-val">{fmtNum(liveRate, 4)}</span>
          </span>
          <span className="risk-matrix__dot">·</span>
          <span>
            N=<span className="risk-matrix__ctx-val">{tradeCount}</span> trades
          </span>
          <span className="risk-matrix__dot">·</span>
          <span>
            YTD actif{' '}
            <span className="risk-matrix__ctx-val">
              {ytdDaysActive != null ? `${ytdDaysActive} j` : '—'}
            </span>
          </span>
        </div>
        <div className="risk-matrix__context risk-matrix__context--right">
          {/* S2 — badge TIER « A · E0×C1 » retiré (doctrine V1 morte). */}
          <span className="risk-matrix__edge-badge">
            <span className="risk-matrix__edge-dot" aria-hidden="true" />
            {edge.label}
          </span>
        </div>
      </div>

      <div className="risk-matrix__body">
        {/* ─────────────── COL 1 : Performance + R-Distribution ─────────── */}
        <div className="risk-matrix__col risk-matrix__col--left">
          <div className="risk-matrix__section-head risk-matrix__section-head--accent">
            <span>▼ Métriques de performance</span>
            {m.preliminaryRatios && (
              <span
                className="risk-matrix__preliminary"
                title={`Échantillon court : ${m.yearsActive != null ? `${(m.yearsActive * 365.25).toFixed(0)} j` : '< 1 an'}. Sharpe / Sortino / Calmar extrapolés (Calmar utilise CAGR annualisé = ${m.cagrAnnPct != null ? m.cagrAnnPct.toFixed(1) + '%' : '—'} / |MaxDD ${m.maxDrawdownPct != null ? m.maxDrawdownPct.toFixed(2) + '%' : '—'}|).`}
              >
                ~ préliminaire · échantillon &lt; 1 an
              </span>
            )}
          </div>
          <div className="risk-matrix__row risk-matrix__row--cols-perf risk-matrix__row--th">
            <span>Métrique</span>
            <span className="risk-matrix__cell--right">Valeur</span>
            <span className="risk-matrix__cell--right">Bench</span>
            <span className="risk-matrix__cell--right">Δ</span>
            <span className="risk-matrix__cell--right">Plage</span>
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
            label={m.twrMode === 'cumulative' ? 'TWR Cumulé · RÉAL' : 'TWR (ann.) · RÉAL'}
            value={fmtPct(m.twr)}
            valueTone="value"
            bench="15.0%"
            delta={twrDelta.text}
            deltaTone={twrDelta.tone}
            gauge={<MetricGauge value={m.twr} bench={15} mode="higher-is-better" />}
            title="RÉAL · ALL — rendement pondéré temps : produit des sous-périodes entre flux ((MV fin / MV début) − 1), le timing des dépôts est NEUTRALISÉ. ≠ Cumulé (capital initial)."
          />
          {/* A2.2 — label switches to "Cumulé" when years < 1 (no
              annualisation applied). Bench stays at 15 % to give a
              comparable reference target in both modes. CAGR is the
              SIMPLE return on initial capital (mechanically rewards
              big later deposits) — TWR is the timing-neutral truth. */}
          <RowPerf
            label={m.cagrMode === 'cumulative' ? 'Cumulé · RÉAL' : 'CAGR · RÉAL'}
            value={fmtPct(cagr)}
            valueTone="value"
            bench="15.0%"
            delta={cagrDelta.text}
            deltaTone={cagrDelta.tone}
            gauge={<MetricGauge value={cagr} bench={15} mode="higher-is-better" />}
            title="RÉAL · ALL — (capital initial + Σ réalisé) ÷ capital initial − 1 : rendement simple sur capital initial, les dépôts tardifs NE sont PAS neutralisés (≠ TWR). ≠ « SUR CETTE PÉRIODE · NLV » du Héros 1."
          />
          <RowPerf
            label="Vol (ann.)"
            value={fmtPct(m.volAnnPct)}
            valueTone="value"
            bench="20.0%"
            delta={volDelta.text}
            deltaTone={volDelta.tone}
            gauge={<MetricGauge value={m.volAnnPct} bench={20} mode="lower-is-better" />}
            title="RÉAL · ALL — écart-type des rendements par trade (base equity réelle), annualisé ; gaté sous 30 obs. / 0.25 an."
          />
          <RowPerf
            label="Recovery Factor · RÉAL"
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
            title="RÉAL · ALL — Σ réalisé ÷ Max DD · RÉAL · ALL (par trade). ≠ RECOVERY · NLV du Héros 1 (P&L flow-neutral / DD NLV) et ≠ RECOVERY · RÉAL fenêtré du Héros 2."
          />
          {/* COULEUR D1a — Expectancy/Kelly/R Avg : ratios & moyennes
              statistiques → neutres (le Kelly ambre est mort). */}
          <RowPerf
            label="Expectancy"
            value={fmtUsdSigned(m.expectancy)}
            valueTone="value"
            bench="—"
            delta={fmtPctSigned(m.expectancy, 0)}
            deltaTone="mute"
            gauge={<MetricGauge value={m.expectancy} bench={null} mode="info" />}
          />
          <RowPerf
            label="Kelly optimal"
            value={fmtPct(m.kellyPercent)}
            valueTone="value"
            bench="—"
            delta="info"
            deltaTone="mute"
            gauge={<MetricGauge value={m.kellyPercent} bench={null} mode="info" />}
          />
          <RowPerf
            label="R moy. / σ"
            value={m.rAverage == null ? '—' : `${m.rAverage >= 0 ? '+' : ''}${fmtNum(m.rAverage)}`}
            valueTone="value"
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
            <span>▼ Drawdown · Séries</span>
          </div>
          <div className="risk-matrix__row risk-matrix__row--cols-3 risk-matrix__row--th">
            <span>Metric</span>
            <span className="risk-matrix__cell--right">USD</span>
            <span className="risk-matrix__cell--right">%</span>
          </div>
          <Row3
            label="⚠ DD courant · RÉAL"
            value={ddInfo.ddUsd != null && ddInfo.ddUsd > 0 ? `−${fmtUsd(ddInfo.ddUsd).replace(/^-/, '')}` : '—'}
            valueTone={ddInfo.ddUsd && ddInfo.ddUsd > 0 ? 'loss-bold' : 'mute'}
            sub={fmtPctSigned(m.currentDDPct, 2)}
            subTone={m.currentDDPct != null && m.currentDDPct < 0 ? 'loss' : 'mute'}
            alert={ddInfo.ddUsd != null && ddInfo.ddUsd > 0}
            title="RÉAL · ALL — pic du cumul réalisé − cumul réalisé courant (courbe par jour de clôture, latent exclu) ; % sur l'equity au pic. ≠ DD COURANT · NLV du Héros 1."
          />
          <Row3
            label="Max DD · RÉAL · YTD"
            value={maxDDYtdUsd != null ? `−${fmtUsd(maxDDYtdUsd)}` : '—'}
            valueTone={maxDDYtdUsd != null ? 'loss-bold' : 'mute'}
            sub={m.maxDDYtdPct > 0 ? `−${fmtPct(m.maxDDYtdPct, 2)}` : '—'}
            subTone={m.maxDDYtdPct > 0 ? 'loss' : 'mute'}
            title="RÉAL · YTD — pic→creux du cumul réalisé sur l'année en cours (courbe par jour de clôture) ; % sur l'equity au pic."
          />
          <Row3
            label="Max DD · RÉAL · ALL"
            value={
              m.maxDrawdown != null && Number.isFinite(m.maxDrawdown) && m.maxDrawdown > 0
                ? `−${fmtUsd(m.maxDrawdown)}`
                : '—'
            }
            valueTone={m.maxDrawdown > 0 ? 'loss-bold' : 'mute'}
            sub={m.maxDrawdownPct > 0 ? `−${fmtPct(m.maxDrawdownPct, 2)}` : '—'}
            subTone={m.maxDrawdownPct > 0 ? 'loss' : 'mute'}
            title="RÉAL · ALL — pic→creux du cumul réalisé, granularité PAR TRADE (buildEquitySeries) ; % sur l'equity réelle au pic. ≠ MAX DD · NLV du Héros 1 (flow-neutral, latent inclus)."
          />
          <Row3
            label="Depuis pic · RÉAL"
            value={ddInfo.daysSincePeak != null ? `${ddInfo.daysSincePeak} j` : '—'}
            valueTone="value"
            sub={ddInfo.peakDate ? `pic ${fmtDate(ddInfo.peakDate)}` : '—'}
            subTone="mute"
            title="RÉAL — jours CALENDAIRES entre le pic du cumul réalisé et aujourd'hui (plus jamais pic→dernier trade)."
          />
          {/* COULEUR D1 — montant à recouvrer = hypothétique (amendement
              15.07) et % = ratio : l'ambre ambiant est mort, neutres. */}
          <Row3
            label="Récupération"
            value={
              m.recoveryPctValue != null && Number.isFinite(m.recoveryPctValue)
                ? fmtPct(m.recoveryPctValue)
                : '—'
            }
            valueTone="value"
            sub="du creux récupéré"
            subTone="mute"
            title="RÉAL · ALL — (meilleur point post-creux − creux) ÷ (pic − creux) : 100 % = pic retrouvé. L'ex-ligne répétait le Current DD $ sous un label de récupération."
          />

          {/* É3.1 — vérité du libellé : la fenêtre = 60 derniers POINTS de
              la courbe réalisée (jours de clôture), pas 60 jours calendaires. */}
          <div
            className="risk-matrix__subzone"
            title="RÉAL · 60 derniers jours de clôture — underwater % vs pic de la fenêtre ((equity − pic) / pic)."
          >
            <div className="risk-matrix__subzone-head">
              <span>COURBE DD · RÉAL · 60 J CLÔT.</span>
              <span className="risk-matrix__cell--loss">
                Peak {ddCurvePeakPct != null ? `${ddCurvePeakPct.toFixed(2)}%` : '—'}
              </span>
            </div>
            <DdSparkline data={ddCurve60} />
          </div>

          {/* É3 §4.2.4 — COMPTEURS de streak NEUTRES (parité bande FORME
              1.F : un compteur n'est pas de l'argent). Le P&L $ cumulé de
              la streak courante (sub) reste toné : argent réel. */}
          <Row3
            label="Série en cours"
            value={
              m.currentStreak > 0
                ? `▲ ${m.currentStreak}W`
                : m.currentStreak < 0
                  ? `▼ ${Math.abs(m.currentStreak)}L`
                  : '—'
            }
            valueTone="mute"
            sub={streakPnlSum != null ? fmtUsdSigned(streakPnlSum) : '—'}
            subTone={
              streakPnlSum == null ? 'mute' : streakPnlSum > 0 ? 'profit' : 'loss'
            }
          />
          <Row3
            label="Série gagn. max"
            value={`${m.maxWinStreak ?? 0}W`}
            valueTone="mute"
            sub={streakDates.winRange || '—'}
            subTone="mute"
          />
          <Row3
            label="Série perd. max"
            value={`${m.maxLossStreak ?? 0}L`}
            valueTone="mute"
            sub={streakDates.lossRange || '—'}
            subTone="mute"
          />

          <div className="risk-matrix__subzone risk-matrix__subzone--push">
            <div className="risk-matrix__subzone-head">
              <span>MOTIF SÉRIES · 13 DERNIERS</span>
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
            <span>▼ Stats gains / pertes</span>
          </div>
          <div className="risk-matrix__row risk-matrix__row--cols-3 risk-matrix__row--th">
            <span>Stat</span>
            <span className="risk-matrix__cell--right">Nb</span>
            <span className="risk-matrix__cell--right">$ moy.</span>
          </div>
          {/* É3 panel §4.2.4 — COMPTEURS gagnants/perdants NEUTRES (même
              motif que les séries juste au-dessus) ; le $ moy. reste
              toné : argent réel. */}
          <Row3
            label="Gagnants"
            value={`${m.winCount ?? 0}`}
            valueTone="mute"
            sub={fmtUsdSigned(m.averageWin)}
            subTone="profit"
          />
          <Row3
            label="Perdants"
            value={`${m.lossCount ?? 0}`}
            valueTone="mute"
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
            label="Frais totaux"
            value={fmtUsd(m.totalAllFees)}
            valueTone="mute"
            sub={
              m.totalClosedFees != null && tradeCount > 0
                ? `Ø ${(m.totalClosedFees / tradeCount).toFixed(2)}/tr clôt.`
                : '—'
            }
            subTone="mute"
            title="Total = commissions clôturées + frais des positions ouvertes + frais cash (base LARGE). « Ø …/tr clôt. » = MOYENNE des commissions de clôture par trade clôturé (base ÉTROITE) — les deux bases diffèrent, donc Ø×N ≠ total (ce n'est pas une erreur arithmétique)."
          />
          <Row3
            label="Impact FX"
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
              <span>JAUGE WIN RATE</span>
              {/* COULEUR D1 — PF est un ratio : ambre mort, encre pleine. */}
              <span className="risk-matrix__cell--value">
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
        {/* É3.2 — la ligne dit la vérité de lastSync ou n'existe pas. */}
        {syncLabel ? <span>{syncLabel}</span> : <span aria-hidden="true" />}
        <div className="risk-matrix__footer-cmd-wrap">
          <span className="risk-matrix__footer-cmd-label">PMET</span>
          <span className="risk-matrix__footer-cmd">&lt;GO&gt;</span>
        </div>
      </footer>
    </section>
  );
}
