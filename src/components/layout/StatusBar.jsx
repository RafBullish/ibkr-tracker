// ═══════════════════════════════════════════════════════════════
//  STATUS BAR v5.0 « Institutional Terminal »
//
//  Bottom strip 22 px Bloomberg-grade. Trois zones :
//    1. Gauche  — Dots IBKR · Flex · Finnhub · CBOE + SYNC ago + POS count
//    2. Centre  — VIX / SPX live + Horloges NY · GVA · LDN · TKY
//                 (sessions OPEN/FERMÉ) + MARKET phase indicator US
//    3. Droite  — NLV CHF · DD · P&L · NEXT GATE · version
//                 · ThemeSwitcher
//
//  v5 Sprint 1.2 ajouts :
//    - useMarketQuotes(['VIX', 'SPX']) → valeurs live indices US
//    - Calcul phase marché US (PRE-MARKET / OPEN / AFTER-HOURS / CLOSED)
//      depuis NY local time
//    - useNextGate hook → ticker + gate type (SL35 / DTE45) + jours
//      au déclenchement, affiché dans la zone droite
//
//  v5 Sprint 1.2 différé (BP / ExLiq / Cushion / SMA / MTD / YTD) :
//    Ces 6 champs viennent de l'IBKR Account Summary endpoint qui
//    n'est pas encore câblé (cf. docs/CANONICAL_GUIDE.md alignment
//    note #4). Une brick métier ultérieure ajoutera api/account-
//    summary/sync.js + le hook useAccountSnapshot ; ici on ne ship
//    pas de placeholder permanent. Sprint 1 livre la structure.
//
//  Les dots de connexion s'appuient sur le hook `useApiStatus` qui
//  effectue des probes /api/health/* toutes les 2 minutes pour les
//  services live (CBOE, Finnhub, FX) et dérive Flex de `settings
//  .lastSync` + creds localStorage. Map status → couleur :
//    'active'       → vert
//    'inactive'     → rouge
//    'unconfigured' → gris
//    'checking'     → gris (premier load)
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { useOpenPositions, useSettings } from '../../store/useStore';
import { usePortfolioMetrics } from '../../hooks/usePortfolioMetrics';
import useApiStatus from '../../hooks/useApiStatus';
import useMarketQuotes from '../../hooks/useMarketQuotes';
import useNextGate from '../../hooks/useNextGate';
import ThemeSwitcher from '../ui/ThemeSwitcher';

const APP_VERSION = 'v5.0.0-sprint-1';
const STATUS_INDICES = ['VIX', 'SPX'];

const ZONES = [
  { code: 'NY', tz: 'America/New_York', open: 9 * 60 + 30, close: 16 * 60, label: 'New York' },
  { code: 'GVA', tz: 'Europe/Zurich', open: null, close: null, label: 'Genève' },
  { code: 'LDN', tz: 'Europe/London', open: 8 * 60, close: 16 * 60 + 30, label: 'Londres' },
  { code: 'TKY', tz: 'Asia/Tokyo', open: 9 * 60, close: 15 * 60, label: 'Tokyo' },
];

const STATUS_TO_DOT = {
  active: 'ok',
  inactive: 'err',
  unconfigured: 'off',
  checking: 'off',
};

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatTime(date, tz) {
  return new Intl.DateTimeFormat('fr-CH', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function tzMinutesAndWeekday(date, tz) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const weekday = WEEKDAYS.indexOf(get('weekday'));
  const hour = parseInt(get('hour'), 10);
  const minute = parseInt(get('minute'), 10);
  return { weekday, minutes: hour * 60 + minute };
}

function sessionState(date, zone) {
  if (zone.open == null) return null;
  const { weekday, minutes } = tzMinutesAndWeekday(date, zone.tz);
  const isWeekday = weekday >= 1 && weekday <= 5;
  if (!isWeekday) return 'closed';
  if (minutes >= zone.open && minutes < zone.close) return 'open';
  return 'closed';
}

// US market phase derived from NY local time. Convention :
//   04:00–09:30 → PRE-MARKET   (most pre-market venues open at 04:00)
//   09:30–16:00 → OPEN
//   16:00–20:00 → AFTER-HOURS  (most extended-hours venues close 20:00)
//   else        → CLOSED
// On weekend always CLOSED.
function usMarketPhase(date) {
  const { weekday, minutes } = tzMinutesAndWeekday(date, 'America/New_York');
  const isWeekday = weekday >= 1 && weekday <= 5;
  if (!isWeekday) return 'closed';
  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) return 'pre';
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return 'open';
  if (minutes >= 16 * 60 && minutes < 20 * 60) return 'after';
  return 'closed';
}

const PHASE_LABEL = {
  pre: 'PRE',
  open: 'OPEN',
  after: 'AFTER',
  closed: 'CLOSED',
};

function syncAgo(timestamp, now) {
  if (!timestamp) return '—';
  const ms = now.getTime() - new Date(timestamp).getTime();
  if (ms < 0) return 'now';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

function fmtChf(v) {
  if (v == null || !isFinite(v)) return '—';
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    maximumFractionDigits: 0,
  }).format(v);
}

// Drawdown formatter — `pct` is a magnitude (always ≥ 0) coming from
// metrics.maxDrawdownPct. We render it with a leading minus sign so
// the loss convention is unambiguous, and collapse a zero-or-near-zero
// value to "0.00%" without a sign (no drawdown observed yet).
function fmtDrawdownPct(pct) {
  if (pct == null || !isFinite(pct)) return '—';
  if (pct <= 0.005) return '0.00%';
  return `−${pct.toFixed(2)}%`;
}

function fmtUsd(v) {
  if (v == null || !isFinite(v)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    signDisplay: 'exceptZero',
  }).format(v);
}

function fmtIndexQuote(q) {
  if (!q || typeof q.price !== 'number' || !Number.isFinite(q.price)) return '——';
  if (q.price >= 1000) {
    return q.price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  return q.price.toFixed(2);
}

function gateLabel(gate) {
  if (!gate) return null;
  const d = gate.daysToTrigger;
  if (d <= 0) return `${gate.ticker} ${gate.gateType} ARMED`;
  if (d === 1) return `${gate.ticker} ${gate.gateType} in 1d`;
  return `${gate.ticker} ${gate.gateType} in ${d}d`;
}

function StatusDot({ apiStatus, label, title }) {
  const tone = STATUS_TO_DOT[apiStatus?.status] || 'off';
  const fullTitle = title || `${label} · ${apiStatus?.status || 'inconnu'}`;
  return (
    <span className="statusbar__group" title={fullTitle}>
      <span className={`statusbar__dot statusbar__dot--${tone}`} aria-hidden="true" />
      <span className="statusbar__label">{label}</span>
    </span>
  );
}

export default function StatusBar() {
  const now = useNow(1000);
  const openPositions = useOpenPositions();
  const settings = useSettings();
  const metrics = usePortfolioMetrics();
  const api = useApiStatus();
  const { quotes } = useMarketQuotes(STATUS_INDICES);
  const nextGate = useNextGate();

  const lastSync = settings?.lastSync;
  const positionsCount = (openPositions || []).length;
  const nlvChf = metrics?.netLiquidationValueChf;
  const realizedUsd = metrics?.realizedPnlUsd;
  // metrics.maxDrawdownPct is a positive magnitude (e.g. 2.93 means
  // a 2.93% drop from peak). fmtDrawdownPct renders it with a leading
  // U+2212 minus sign for the loss-convention display.
  const drawdownPct = metrics?.maxDrawdownPct;

  const phase = useMemo(() => usMarketPhase(now), [now]);
  const vixQuote = quotes?.VIX;
  const spxQuote = quotes?.SPX;
  const nextGateText = useMemo(() => gateLabel(nextGate), [nextGate]);

  // Display syncAgo as a stable memo (recomputes each second via `now`).
  const flexAgo = useMemo(() => syncAgo(lastSync, now), [lastSync, now]);

  return (
    <footer className="statusbar" role="status" aria-label="Barre d'état">
      {/* ZONE 1 — Connexions */}
      <div className="statusbar__zone statusbar__zone--left">
        <StatusDot apiStatus={api.flex} label="IBKR" title={`IBKR Flex · ${api.flex?.status}`} />
        <span className="statusbar__divider" aria-hidden="true" />
        <span className="statusbar__group" title={`Dernière synchro Flex · ${flexAgo}`}>
          <span className="statusbar__label">SYNC</span>
          <span className="statusbar__value">{flexAgo}</span>
        </span>
        <span className="statusbar__divider" aria-hidden="true" />
        <StatusDot apiStatus={api.finnhub} label="FNHB" />
        <span className="statusbar__divider" aria-hidden="true" />
        <StatusDot apiStatus={api.cboe} label="CBOE" />
        <span className="statusbar__divider" aria-hidden="true" />
        <span className="statusbar__group" title="Positions ouvertes">
          <span className="statusbar__label">POS</span>
          <span className="statusbar__value statusbar__value--strong">{positionsCount}</span>
        </span>
      </div>

      {/* ZONE 2 — Indices live + Horloges multi-timezone + Phase US */}
      <div className="statusbar__zone statusbar__zone--center" aria-label="Marché">
        <span className="statusbar__group" title={`VIX · ${vixQuote?.source || 'en attente'}`}>
          <span className="statusbar__label">VIX</span>
          <span className="statusbar__value">{fmtIndexQuote(vixQuote)}</span>
        </span>
        <span className="statusbar__divider" aria-hidden="true" />
        <span className="statusbar__group" title={`SPX · ${spxQuote?.source || 'en attente'}`}>
          <span className="statusbar__label">SPX</span>
          <span className="statusbar__value">{fmtIndexQuote(spxQuote)}</span>
        </span>
        <span className="statusbar__divider" aria-hidden="true" />
        <span
          className={`statusbar__group statusbar__phase statusbar__phase--${phase}`}
          title={`Phase marché US · ${PHASE_LABEL[phase]}`}
        >
          <span className="statusbar__label">MKT</span>
          <span className="statusbar__value statusbar__value--strong">{PHASE_LABEL[phase]}</span>
        </span>
        <span className="statusbar__divider" aria-hidden="true" />
        {ZONES.map((zone, i) => {
          const session = sessionState(now, zone);
          return (
            <span
              key={zone.code}
              className={`statusbar__clock${i >= 2 ? ' statusbar__clock--xtra' : ''}`}
              title={zone.label}
            >
              <span className="statusbar__clock-code">{zone.code}</span>
              <span className="statusbar__clock-time">{formatTime(now, zone.tz)}</span>
              {session && (
                <span className={`statusbar__clock-session statusbar__clock-session--${session}`}>
                  {session === 'open' ? 'OUVERT' : 'FERMÉ'}
                </span>
              )}
            </span>
          );
        })}
      </div>

      {/* ZONE 3 — Risque live + version + thème */}
      <div className="statusbar__zone statusbar__zone--right" aria-label="Risque live">
        <span className="statusbar__group" title="Net Liquidation Value">
          <span className="statusbar__label">NLV</span>
          <span className="statusbar__value statusbar__value--strong">{fmtChf(nlvChf)}</span>
        </span>
        <span className="statusbar__divider" aria-hidden="true" />
        <span className="statusbar__group" title="Drawdown maximum (% du capital initial)">
          <span className="statusbar__label">DD</span>
          <span className={`statusbar__value${drawdownPct > 0 ? ' statusbar__value--loss' : ''}`}>
            {fmtDrawdownPct(drawdownPct)}
          </span>
        </span>
        <span className="statusbar__divider" aria-hidden="true" />
        <span className="statusbar__group" title="P&L réalisé total">
          <span className="statusbar__label">P&amp;L</span>
          <span
            className={`statusbar__value${
              realizedUsd > 0
                ? ' statusbar__value--profit'
                : realizedUsd < 0
                  ? ' statusbar__value--loss'
                  : ''
            }`}
          >
            {fmtUsd(realizedUsd)}
          </span>
        </span>
        <span className="statusbar__divider" aria-hidden="true" />
        {nextGateText ? (
          <span
            className="statusbar__group statusbar__group--gate"
            title={`Prochaine gate Sniper · ${nextGateText}`}
          >
            <span className="statusbar__label">GATE</span>
            <span className="statusbar__value statusbar__value--strong">{nextGateText}</span>
          </span>
        ) : (
          <span className="statusbar__group" title="Aucune position avec gate Sniper actuelle">
            <span className="statusbar__label">GATE</span>
            <span className="statusbar__value">——</span>
          </span>
        )}
        <span className="statusbar__divider" aria-hidden="true" />
        <span className="statusbar__version" aria-label={`Version ${APP_VERSION}`}>
          {APP_VERSION}
        </span>
        <ThemeSwitcher align="end" className="statusbar__theme-switcher" />
      </div>
    </footer>
  );
}
