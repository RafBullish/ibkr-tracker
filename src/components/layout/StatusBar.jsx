// ═══════════════════════════════════════════════════════════════
//  STATUS BAR v6.0 — 4K refonte Phase B (3 zones, simplified)
//
//  Footer strip avec une structure flex en 3 zones séparées par des
//  hairlines verticaux internes à chaque cellule (border-right).
//
//    Zone gauche  : data feeds IBKR · FNHB · CBOE + compteur POS.
//                   Le dot IBKR porte un halo subtle (feature flag).
//    Zone milieu  : 4 horloges fuseaux NY / GVA / LDN / TKY avec
//                   badge OUVERT / FERMÉ (NY/LDN/TKY uniquement —
//                   GVA n'a pas de notion de session marché).
//    Zone droite  : USD/CHF live · P&L réalisé · ThemeSwitcher.
//
//  Données retirées vs v5 Sprint 1.2 (à reposer en Phase C si besoin) :
//    VIX / SPX live indices (déjà dans la TickerTape Phase A),
//    MKT phase (PRE/OPEN/AFTER/CLOSED), SYNC ago, NLV CHF, DD %,
//    GATE NEXT pill, version. La status bar redevient un cockpit
//    minimaliste de connexion + temps + valise CHF/P&L.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useOpenPositions, useSettings } from '../../store/useStore';
import { usePortfolioMetrics } from '../../hooks/usePortfolioMetrics';
import useApiStatus from '../../hooks/useApiStatus';
import ThemeSwitcher from '../ui/ThemeSwitcher';

// Mapping useApiStatus().status → data-status sémantique pour le CSS.
const API_TO_STATE = {
  active: 'live',
  inactive: 'error',
  unconfigured: 'offline',
  checking: 'syncing',
};

const ZONES = [
  { code: 'NY', tz: 'America/New_York', open: 9 * 60 + 30, close: 16 * 60, label: 'New York' },
  { code: 'GVA', tz: 'Europe/Zurich', open: null, close: null, label: 'Genève' },
  { code: 'LDN', tz: 'Europe/London', open: 8 * 60, close: 16 * 60 + 30, label: 'Londres' },
  { code: 'TKY', tz: 'Asia/Tokyo', open: 9 * 60, close: 15 * 60, label: 'Tokyo' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
    hour12: false,
  }).format(date);
}

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

const fmtFxRate = (v) => {
  if (v == null || !Number.isFinite(v)) return '——';
  return v.toFixed(4);
};

const fmtPnlUsd = (v) => {
  if (v == null || !Number.isFinite(v)) return '——';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    signDisplay: 'exceptZero',
  }).format(v);
};

function FeedCell({ apiStatus, label, featured = false }) {
  const state = API_TO_STATE[apiStatus?.status] || 'offline';
  return (
    <div
      className={`statusbar__cell statusbar__feed${featured ? ' statusbar__feed--featured' : ''}`}
      data-status={state}
      title={`${label} · ${apiStatus?.status || 'inconnu'}`}
    >
      <span className="statusbar__feed-dot" aria-hidden="true" />
      <span className="statusbar__feed-label">{label}</span>
    </div>
  );
}

function ClockCell({ now, zone }) {
  const state = sessionState(now, zone);
  return (
    <div className="statusbar__cell statusbar__clock" title={zone.label}>
      <span className="statusbar__clock-code">{zone.code}</span>
      <span className="statusbar__clock-time">{formatTime(now, zone.tz)}</span>
      {state ? (
        <span className="statusbar__clock-badge" data-state={state}>
          {state === 'open' ? 'OUVERT' : 'FERMÉ'}
        </span>
      ) : null}
    </div>
  );
}

export default function StatusBar() {
  const now = useNow(1000);
  const openPositions = useOpenPositions();
  const settings = useSettings();
  const metrics = usePortfolioMetrics();
  const api = useApiStatus();

  const positionsCount = (openPositions || []).length;
  const liveRate = settings?.liveRate;
  const realizedUsd = metrics?.realizedPnlUsd;
  const pnlTone =
    realizedUsd == null || !Number.isFinite(realizedUsd) || realizedUsd === 0
      ? 'mute'
      : realizedUsd > 0
        ? 'profit'
        : 'loss';

  return (
    <footer className="statusbar" role="status" aria-label="Barre d'état">
      {/* Zone gauche — broker / data feeds */}
      <div className="statusbar__zone statusbar__zone--left">
        <FeedCell apiStatus={api.flex} label="IBKR" featured />
        <FeedCell apiStatus={api.finnhub} label="FNHB" />
        <FeedCell apiStatus={api.chart} label="CHART" />
        <div className="statusbar__cell statusbar__pos" title="Positions ouvertes">
          <span className="statusbar__label">POS</span>
          <span className="statusbar__value statusbar__value--strong">{positionsCount}</span>
        </div>
      </div>

      {/* Zone milieu — horloges fuseaux */}
      <div className="statusbar__zone statusbar__zone--center" aria-label="Horloges marchés">
        {ZONES.map((zone) => (
          <ClockCell key={zone.code} now={now} zone={zone} />
        ))}
      </div>

      {/* Zone droite — taux + P&L + thème */}
      <div className="statusbar__zone statusbar__zone--right" aria-label="Portefeuille">
        <div className="statusbar__cell statusbar__rate" title="Taux USD/CHF live">
          <span className="statusbar__label">USD/CHF</span>
          <span className="statusbar__value">{fmtFxRate(liveRate)}</span>
        </div>
        <div
          className={`statusbar__cell statusbar__pnl statusbar__pnl--${pnlTone}`}
          title="P&L réalisé total"
        >
          <span className="statusbar__label">P&amp;L</span>
          <span className="statusbar__value">{fmtPnlUsd(realizedUsd)}</span>
        </div>
        <div className="statusbar__cell statusbar__theme">
          <ThemeSwitcher align="end" className="statusbar__theme-switcher" />
        </div>
      </div>
    </footer>
  );
}
