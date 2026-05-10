// ═══════════════════════════════════════════════════════════════
//  MARKET TICKER v3.1 « Midnight Terminal »
//
//  Single-cell market quote tile used inside the global header.
//
//  Layout (3 rows):
//    row 1  SYMBOL LABEL            (SPX, NDX, VIX, DJI, BTC, USD/CHF)
//    row 2  PRICE (NumberFlow)      mono 13 px, tabular-nums
//    row 3  ±ΔABS  ±Δ%  (NumberFlow) mono 11 px, coloured profit/loss
//
//  The 3-line stack keeps the cell narrow (~110 px min) so 6 cells
//  plus the user-KPI strip all fit inside the header on a 1440 px
//  viewport without layout compression.
//
//  States:
//    • loading  — row 2 shows a shimmer skeleton
//    • error    — row 2 shows "—" muted, tooltip explains why
//    • live     — animated NumberFlow triplets + pulse glow on price
//                 change + rich tooltip (day high/low/prev close/
//                 source/relative last-update)
//    • stale    — amber dot next to label; rich tooltip still shows
//                 the age via <RelativeTime>
//
//  Pulse glow fires whenever the inbound price differs from the
//  previous price: data-pulse="up" (green) or "down" (red) drives
//  an ::after overlay animated to 20 % max opacity over 420 ms.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { formatDistanceToNowStrict } from 'date-fns';
import { fr } from 'date-fns/locale';
import Tooltip from './Tooltip';
import LoadingSkeleton from './LoadingSkeleton';

const STALE_THRESHOLD_MS = 2 * 60 * 1000;
const PULSE_MS = 420;

const SOURCE_LABEL = {
  finnhub: 'Finnhub',
  yahoo: 'Yahoo',
  cboe: 'CBOE',
};

const NF_TIMING = { duration: 500, easing: 'ease-out' };
const NF_SPIN = { duration: 700, easing: 'ease-out' };

function digitsFor(price) {
  if (price == null || !isFinite(price)) return 2;
  return Math.abs(price) < 10 ? 4 : 2;
}

function tone(pct) {
  if (pct == null || !isFinite(pct) || pct === 0) return 'neutral';
  return pct > 0 ? 'profit' : 'loss';
}

// ─────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────
function RelativeTime({ timestamp }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);
  if (!timestamp) return '—';
  try {
    return formatDistanceToNowStrict(new Date(timestamp), { locale: fr, addSuffix: true });
  } catch {
    return '—';
  }
}

function TickerTooltipBody({ label, quote }) {
  const digits = digitsFor(quote?.price);
  const numFmt = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const fmt = (v) => (v == null || !isFinite(v) ? '—' : numFmt.format(v));
  const source = SOURCE_LABEL[quote?.source] || quote?.source || 'source inconnue';
  return (
    <div className="market-ticker-tooltip">
      <div className="market-ticker-tooltip__title">{label}</div>
      <dl className="market-ticker-tooltip__grid">
        <dt>Day High</dt> <dd className="mono">{fmt(quote?.high)}</dd>
        <dt>Day Low</dt> <dd className="mono">{fmt(quote?.low)}</dd>
        <dt>Prev Close</dt> <dd className="mono">{fmt(quote?.prevClose)}</dd>
      </dl>
      <div className="market-ticker-tooltip__footer">
        <span>via {source}</span>
        <span className="market-ticker-tooltip__sep" aria-hidden="true">
          ·
        </span>
        <span>
          <RelativeTime timestamp={quote?.timestamp} />
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────────
export default function MarketTicker({ symbol, label, quote, error, loading }) {
  // Deriving stale-ness from wall-clock age is intentionally impure:
  // the parent re-renders every 60 s via the polling hook which keeps
  // this flag honest without a dedicated timer inside the component.
  // eslint-disable-next-line react-hooks/purity
  const age = quote?.timestamp ? Date.now() - new Date(quote.timestamp).getTime() : null;
  const isStale = Boolean(
    quote && (quote.stale === true || (age != null && age > STALE_THRESHOLD_MS))
  );

  const hasQuote = quote && quote.price != null && isFinite(quote.price);
  const showSkeleton = loading && !hasQuote;
  const showError = !hasQuote && !showSkeleton;

  // Pulse overlay on price change
  const [pulse, setPulse] = useState(null);
  const prevPriceRef = useRef(null);
  useEffect(() => {
    const curr = quote?.price;
    if (curr == null) return;
    const prev = prevPriceRef.current;
    prevPriceRef.current = curr;
    if (prev == null || prev === curr) return;
    setPulse(curr > prev ? 'up' : 'down');
    const t = setTimeout(() => setPulse(null), PULSE_MS);
    return () => clearTimeout(t);
  }, [quote?.price]);

  if (showSkeleton) {
    return (
      <div className="market-ticker" data-state="loading" aria-label={`${label} — chargement`}>
        <div className="market-ticker__label">{label}</div>
        <LoadingSkeleton
          variant="text"
          width={72}
          height={12}
          className="market-ticker__skeleton"
        />
      </div>
    );
  }

  if (showError) {
    return (
      <Tooltip content={error || `Quote indisponible pour ${symbol}`}>
        <div
          className="market-ticker"
          data-state="error"
          aria-label={`${label} — indisponible`}
          role="img"
        >
          <div className="market-ticker__label">{label}</div>
          <div className="market-ticker__price-row mono tone-muted">—</div>
        </div>
      </Tooltip>
    );
  }

  const digits = digitsFor(quote.price);
  const priceFmt = { minimumFractionDigits: digits, maximumFractionDigits: digits };
  const changeFmt = { ...priceFmt, signDisplay: 'exceptZero' };
  const pctFmt = {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  };
  const toneClass = tone(quote.changePercent);

  return (
    <Tooltip content={<TickerTooltipBody label={label} quote={quote} />} maxWidth={240}>
      <div
        className="market-ticker"
        data-state="live"
        data-stale={isStale || undefined}
        data-pulse={pulse || undefined}
        role="img"
        aria-label={`${label}`}
      >
        <div className="market-ticker__label">
          <span>{label}</span>
          {isStale && <span className="market-ticker__stale-dot" aria-hidden="true" />}
        </div>
        <div className="market-ticker__price-row mono">
          <NumberFlow
            value={quote.price}
            locales="en-US"
            format={priceFmt}
            transformTiming={NF_TIMING}
            spinTiming={NF_SPIN}
          />
        </div>
        <div className={`market-ticker__delta-row mono tone-${toneClass}`}>
          <NumberFlow
            value={quote.change ?? 0}
            locales="en-US"
            format={changeFmt}
            transformTiming={NF_TIMING}
            spinTiming={NF_SPIN}
          />
          <NumberFlow
            value={(quote.changePercent ?? 0) * 0.01}
            locales="en-US"
            format={pctFmt}
            transformTiming={NF_TIMING}
            spinTiming={NF_SPIN}
          />
        </div>
      </div>
    </Tooltip>
  );
}
