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
//  Hardcoded TODO Phase C (signalés en rapport) :
//    CASH FLR (Card 2), MAX 70 % NLV (Card 6), TIER ACTIF (Card 6),
//    RISK $ via SL_amount (Card 6).
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { usePortfolioMetrics, useKPIs } from '../../hooks/usePortfolioMetrics';
import useAvailableCapital from '../../hooks/useAvailableCapital';
import useEquityHistory from '../../hooks/useEquityHistory';
import useDailyPnL from '../../hooks/useDailyPnL';
import useDailySnapshot from '../../hooks/useDailySnapshot';
import useGreeksAggregate from '../../hooks/useGreeksAggregate';
import useMarketSession from '../../hooks/useMarketSession';
import { useClosedTrades, useOpenPositions } from '../../store/useStore';
import { tradePnlUsd, calculateOpenPositionPnl } from '../../utils/calculations';
import Sparkline from './Sparkline';

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

// ─── Formatters ──────────────────────────────────────────────────

const fmtUsdCompact = (v) => {
  if (v == null || !Number.isFinite(v)) return '——';
  if (Math.abs(v) >= 1_000_000) {
    return `$${(v / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 })}M`;
  }
  return `$${Math.round(v).toLocaleString('en-US')}`;
};

const fmtUsdSigned = (v) => {
  if (v == null || !Number.isFinite(v)) return '——';
  if (v === 0) return '$0';
  const sign = v > 0 ? '+' : '−';
  return `${sign}$${Math.round(Math.abs(v)).toLocaleString('en-US')}`;
};

// Axis labels NLV : "$1,516" (jamais "$1.52K" — brief B.4).
const fmtAxisUsd = (v) => {
  if (!Number.isFinite(v)) return '';
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
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

// ─── Sub-primitives ─────────────────────────────────────────────

function KpiFooter({ cells }) {
  const cn =
    cells.length === 4
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

// ─── Card shells ────────────────────────────────────────────────

function KpiCardHero({
  label = 'NLV · NET LIQUIDITY VALUE',
  liveBadge = 'LIVE',
  range,
  setRange,
  topRight,
  value,
  valueTone = 'accent',
  chfLine,
  deltaUsd,
  deltaPct,
  spark,
  footerCells,
}) {
  const deltaTone = toneSign(deltaUsd);
  const showRange = range != null && typeof setRange === 'function';
  return (
    <section className="dash-kpi-card dash-kpi-card--hero" data-tone={valueTone}>
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
        </div>
        <div className="dash-kpi-card__hero-spark">{spark}</div>
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

// TODO Phase C : lier au tier Sniper actif quand exposé par le store.
const SNIPER_DEFAULTS = {
  cashFloorPct: 30,
  notionalMaxPct: 70,
  tierLabel: 'A · E0×C1',
};

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

  // Hero NLV série — ALL → toute la série, sinon slice(-days).
  const nlvSeries = useMemo(() => {
    if (!equityHistory || equityHistory.length === 0) return [];
    const slice =
      rangeConf.days == null ? equityHistory : equityHistory.slice(-rangeConf.days);
    return slice.map((p) => ({ date: p.date, value: p.equity }));
  }, [equityHistory, rangeConf.days]);

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

  // ─── NLV range delta + HIGH / LOW / PEAK / ALL-TIME ─────────
  const rangeDeltaUsd = useMemo(() => {
    if (nlvSeries.length < 2) return null;
    return nlvSeries[nlvSeries.length - 1].value - nlvSeries[0].value;
  }, [nlvSeries]);
  const rangeDeltaPct = useMemo(() => {
    if (nlvSeries.length < 2) return null;
    const start = nlvSeries[0].value;
    if (!start) return null;
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
  const peakAllTime = useMemo(() => {
    if (!equityHistory || equityHistory.length === 0) return null;
    return Math.max(...equityHistory.map((p) => p.equity));
  }, [equityHistory]);

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

  // ─── Realized % all-time ────────────────────────────────────
  const realizedPct = useMemo(() => {
    if (!Number.isFinite(realizedUsd)) return null;
    const totalFundedUsd = metrics?.totalFundedUsd ?? 0;
    const totalDepositedChf = metrics?.totalDepositedChf ?? 0;
    const initialCapital =
      totalFundedUsd + (fxOk && liveRate > 0 ? totalDepositedChf / liveRate : 0);
    if (initialCapital > 0) return (realizedUsd / initialCapital) * 100;
    if (Number.isFinite(nlvUsd) && nlvUsd > 0) return (realizedUsd / nlvUsd) * 100;
    return null;
  }, [realizedUsd, metrics, fxOk, liveRate, nlvUsd]);

  // ─── Card 6 Risk $ : proxy via unrealizedPnl 1re position ───
  const riskUsd = useMemo(() => {
    if (!openPositions || openPositions.length === 0) return null;
    const first = openPositions[0];
    const r = calculateOpenPositionPnl(first, liveRate || 1);
    return r.unrealizedPnlUsd;
  }, [openPositions, liveRate]);

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="dash-kpi-cards">
      <div className="dash-kpi-cards__row dash-kpi-cards__row--hero">
        {/* HERO 1. NLV */}
        <KpiCardHero
          range={range}
          setRange={setRange}
          value={fmtUsdCompact(nlvUsd)}
          valueTone="accent"
          chfLine={nlvChfLine}
          deltaUsd={rangeDeltaUsd}
          deltaPct={rangeDeltaPct}
          spark={
            <Sparkline
              data={nlvSeries}
              color={toneSign(rangeDeltaUsd) === 'loss' ? 'loss' : 'profit'}
              height={100}
              area
              dot
              strokeWidth={2}
              dotRadius={4}
              dotHaloRadius={8}
              gradientOpacity={0.4}
              gridlines={3}
              axisLabels
              formatLabel={fmtAxisUsd}
            />
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
              title: 'Plus haut gain cumulé jamais atteint (max all-time de la courbe equity)',
            },
            {
              label: 'ALL-TIME',
              value: Number.isFinite(allTimePnlUsd) ? fmtUsdSigned(allTimePnlUsd) : '——',
              tone: toneSign(allTimePnlUsd),
              title: 'P&L total = realized + unrealized',
            },
          ]}
        />

        {/* HERO 2. DAY P&L (B2 — promu de secondary à hero, footer 4 cells WEEK/MTD/YTD/ALL-TIME) */}
        <KpiCardHero
          label="DAY P&L"
          liveBadge={null}
          topRight={<Pill tone="mute">INTRADAY</Pill>}
          value={fmtUsdSigned(dayPnl)}
          valueTone={dayTone}
          chfLine={dayChfLine}
          spark={
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
              <Sparkline
                data={dayPnlSeries}
                color={dayTone === 'mute' ? 'neutral' : dayTone}
                height={100}
                area
                dot
                strokeWidth={2}
                dotRadius={4}
                dotHaloRadius={8}
                gradientOpacity={0.4}
                gridlines={3}
                zeroLine
              />
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
            {
              label: 'YTD',
              value: Number.isFinite(ytdPnlUsd) ? fmtUsdSigned(ytdPnlUsd) : '—',
              tone: toneSign(ytdPnlUsd),
              title: 'P&L cumulé depuis le 1er janvier de l’année en cours',
            },
            {
              label: 'ALL-TIME',
              value: Number.isFinite(allTimePnlUsd) ? fmtUsdSigned(allTimePnlUsd) : '—',
              tone: toneSign(allTimePnlUsd),
              title: 'P&L total = realized + unrealized',
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
              value: `${SNIPER_DEFAULTS.cashFloorPct}%`,
              tone: 'amber',
              title: 'Plancher de cash du tier Sniper actif (valeur statique — TODO Phase C)',
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

        {/* SECONDARY 3. REALIZED */}
        <KpiCard
          label="REALIZED"
          topRight={
            realizedPct != null ? (
              <Pill tone={realTone === 'mute' ? 'mute' : realTone}>
                {fmtPctSigned(realizedPct, 1)}
              </Pill>
            ) : null
          }
          value={fmtUsdSigned(realizedUsd)}
          valueTone={realTone}
          chfLine={realizedChfLine}
          visual={
            <div className="dash-kpi-card__spark-wrap">
              <Sparkline
                data={realizedAllTimeSeries}
                color={realTone === 'loss' ? 'loss' : 'profit'}
                height={50}
                area
                dot
                strokeWidth={2}
                dotRadius={3}
                dotHaloRadius={6}
                gridlines={3}
              />
              <span className="dash-kpi-card__spark-overlay">{tradeCount} TR</span>
            </div>
          }
          footerCells={[
            {
              label: 'BEST',
              value:
                closedExtremes.best && Number.isFinite(closedExtremes.best.pnl)
                  ? fmtUsdSigned(closedExtremes.best.pnl)
                  : '—',
              tone:
                closedExtremes.best && closedExtremes.best.pnl > 0 ? 'profit' : 'mute',
            },
            {
              label: 'EXPCT',
              value:
                tradeCount > 0 && Number.isFinite(expectancy) ? fmtUsdSigned(expectancy) : '—',
              tone: 'neutral',
              title: 'Expectancy par trade (winRate × avgWin − lossRate × avgLoss)',
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
                  MAX {SNIPER_DEFAULTS.notionalMaxPct}%
                </span>
              </div>
              <FillBarWithMarker
                pct={expoPctNlv}
                color="amber"
                markerPct={SNIPER_DEFAULTS.notionalMaxPct}
              />
              <div className="dash-kpi-card__info-slot dash-kpi-card__info-slot--tight">
                <InfoBlock
                  tone="amber"
                  label="TIER ACTIF"
                  value={SNIPER_DEFAULTS.tierLabel}
                  valueTone="amber"
                />
              </div>
            </div>
          }
          footerCells={[
            {
              label: 'RISK $',
              value: Number.isFinite(riskUsd) ? fmtUsdSigned(riskUsd) : '—',
              tone: toneSign(riskUsd),
              title:
                'Proxy via unrealizedPnl de la 1re position (TODO Phase C : pos.slDollar quand exposé)',
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
