// ═══════════════════════════════════════════════════════════════
//  TICKER TAPE — B1.6 polish Bloomberg (refonte visuelle)
//
//  Une seule ligne qui défile gauche → droite en continu, hauteur
//  var(--qc-ticker-h) = 44 px. Séparateurs verticaux discrets entre
//  cellules via border-right (au lieu de gap track). Marquee CSS
//  infinite (track primary + clone à left:100% pour boucle seamless),
//  hover pause, reduced-motion fallback (clone retirée du DOM +
//  overflow-x manuel).
//
//  Ordre figé : SPX · NDX · DJI · RUT · VIX · USD/CHF · EUR/USD ·
//  GOLD · [positions equities dynamiques dédupées] · BTC · ETH.
//  Les positions s'insèrent entre GOLD et BTC.
//
//  Cellule = symbole · prix mono blanc · change% avec ▲ ▼ ·
//  sparkline 7-j 48×18 (TickerSparkline inline, couleur résolue via
//  sparkColor useMemo — voir B1.5). Le prix reste TOUJOURS blanc peu
//  importe l'état (STALE/CLOSED se traduisent UNIQUEMENT par une
//  réduction d'opacité de la cellule entière, pas de badge texte).
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import useMarketQuotes from '../../hooks/useMarketQuotes';
import { useMarketSparklines } from '../../hooks/useMarketSparklines';
import { useOpenPositions } from '../../store/useStore';
import { isMarketOpen, getAssetClass } from '../../utils/marketHours';

// Ordre figé. Positions s'insèrent entre GOLD et BTC (cf. sequence).
const STATIC_TICKERS = [
  { display: 'SPX',     fetch: '^SPX',     classKey: 'US_INDICES' },
  { display: 'NDX',     fetch: '^NDX',     classKey: 'US_INDICES' },
  { display: 'DJI',     fetch: '^DJI',     classKey: 'US_INDICES' },
  { display: 'RUT',     fetch: '^RUT',     classKey: 'US_INDICES' },
  { display: 'VIX',     fetch: '^VIX',     classKey: 'US_INDICES' },
  { display: 'USD/CHF', fetch: 'USDCHF=X', classKey: 'FX' },
  { display: 'EUR/USD', fetch: 'EURUSD=X', classKey: 'FX' },
  { display: 'GOLD',    fetch: 'GC=F',     classKey: 'COMMODITIES' },
  { display: 'BTC',     fetch: 'BTC-USD',  classKey: 'CRYPTO' },
  { display: 'ETH',     fetch: 'ETH-USD',  classKey: 'CRYPTO' },
];

const STATIC_FETCH_SYMBOLS = STATIC_TICKERS.map((t) => t.fetch);
const STATIC_DISPLAY_SET = new Set(STATIC_TICKERS.map((t) => t.display.toUpperCase()));

// Note B1 : ^SPX et ^VIX peuvent rater Finnhub puis tomber sur Yahoo
// (cascade auto côté /api/quote). Fallback SPX / VIX sans caret possible.

function deriveState(quote, classKey, now) {
  if (!quote || quote.price == null) return 'OFFLINE';
  const lastUpdate = quote.timestamp || quote.lastUpdate;
  if (!lastUpdate) return 'STALE';
  const ageSeconds = (now.getTime() - new Date(lastUpdate).getTime()) / 1000;
  const marketOpen = isMarketOpen(classKey, now);
  if (!marketOpen) return 'CLOSED';
  if (ageSeconds > 120) return 'STALE'; // polling 60s + marge
  return 'LIVE';
}

function formatPrice(price, ticker) {
  if (price == null) return '—';
  const classKey = getAssetClass(ticker);
  if (classKey === 'FX') return price.toFixed(4);
  if (price >= 1000) {
    // fr-CH sépare les milliers via U+202F (narrow no-break space) qui
    // rend trop large en mono. Remplacé par U+2009 (thin space) plus
    // compact, ET letter-spacing -0.02em côté CSS resserre encore.
    return Math.round(price).toLocaleString('fr-CH').replace(/[  \s]/g, ' ');
  }
  return price.toFixed(2);
}

// Wrapper sparkline inline (B1.5) : ne dépend pas de ui/Sparkline.jsx qui
// résout encore via var(--profit)/var(--loss) (vars retirées en Phase 0.5
// → undefined → stroke par défaut noir). On force ici une couleur explicite
// passée en prop, déterministe et résolue par tokens.css principal.
//
// B1.6 : défauts ramenés à 48×18 stroke 1.25 pour rendu plus discret
// en hauteur 44 px du ticker.
function TickerSparkline({ prices, color, width = 56, height = 22, stroke = 1.5 }) {
  if (!prices || prices.length < 2) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const stepX = width / (prices.length - 1);
  const points = prices.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p - min) / range) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const pathD = `M ${points.join(' L ')}`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function TickerCell({ ticker, quote, spark, state }) {
  const price = quote?.price;
  const change = quote?.changePercent;
  const stateClass = `ticker-cell--${state.toLowerCase()}`;
  const changeClass =
    change > 0 ? 'qc-profit' : change < 0 ? 'qc-loss' : 'qc-text-secondary';
  const changeArrow = change > 0 ? '▲' : change < 0 ? '▼' : '';
  const isStrongMove = change != null && Math.abs(change) > 2;

  const sparkColor = useMemo(() => {
    if (!spark?.prices || spark.prices.length < 2) return 'var(--qc-text-secondary)';
    const first = spark.prices[0];
    const last = spark.prices[spark.prices.length - 1];
    if (last > first) return 'var(--qc-profit)';
    if (last < first) return 'var(--qc-loss)';
    return 'var(--qc-text-secondary)';
  }, [spark]);

  return (
    <div className={`ticker-cell ${stateClass}`}>
      <div className="ticker-cell__data">
        <span className="ticker-cell__symbol">{ticker.display}</span>
        {state === 'OFFLINE' ? (
          <span className="ticker-cell__value ticker-cell__value--offline qc-num">—</span>
        ) : (
          <>
            <span className="ticker-cell__value qc-num">{formatPrice(price, ticker.display)}</span>
            {change != null && Number.isFinite(change) && (
              <span
                className={`ticker-cell__change qc-pct ${changeClass}${isStrongMove ? ' ticker-cell__change--glow' : ''}`}
              >
                {changeArrow && <span className="ticker-cell__arrow">{changeArrow}</span>}
                {Math.abs(change).toFixed(2)}%
              </span>
            )}
          </>
        )}
      </div>
      {state !== 'OFFLINE' && spark?.prices && spark.prices.length > 1 && (
        <span className="ticker-cell__sparkline">
          <TickerSparkline prices={spark.prices} color={sparkColor} />
        </span>
      )}
    </div>
  );
}

export default function TickerTape() {
  const positions = useOpenPositions();
  const now = new Date();

  // Underlyings positions dédupés ET déjà filtrés contre les statiques.
  const positionUnderlyings = useMemo(
    () => [
      ...new Set(
        (positions || [])
          .map((p) => p?.tk)
          .filter(Boolean)
          .filter((s) => !STATIC_DISPLAY_SET.has(s.toUpperCase()))
      ),
    ],
    [positions]
  );

  // Séquence d'affichage : statics jusqu'à GOLD inclus → positions → BTC, ETH.
  const sequence = useMemo(() => {
    const goldIdx = STATIC_TICKERS.findIndex((t) => t.display === 'GOLD');
    const beforePositions = STATIC_TICKERS.slice(0, goldIdx + 1);
    const afterPositions = STATIC_TICKERS.slice(goldIdx + 1);
    const positionTickers = positionUnderlyings.map((s) => ({
      display: s.toUpperCase(),
      fetch: s,
      classKey: 'EQUITIES',
    }));
    return [...beforePositions, ...positionTickers, ...afterPositions];
  }, [positionUnderlyings]);

  // Symbols à fetcher : statics + underlyings positions.
  const allFetchSymbols = useMemo(
    () => [...STATIC_FETCH_SYMBOLS, ...positionUnderlyings],
    [positionUnderlyings]
  );

  const { quotes } = useMarketQuotes(allFetchSymbols);
  const { sparklines } = useMarketSparklines(allFetchSymbols);

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const renderCell = (ticker, idx) => (
    <TickerCell
      key={`${ticker.fetch}-${idx}`}
      ticker={ticker}
      quote={quotes[ticker.fetch]}
      spark={sparklines[ticker.fetch]}
      state={deriveState(quotes[ticker.fetch], ticker.classKey, now)}
    />
  );

  return (
    <div className={`ticker-tape ${prefersReducedMotion ? 'ticker-tape--reduced' : ''}`}>
      <div className="ticker-tape__viewport">
        <div className="ticker-tape__track">
          {sequence.map((t, i) => renderCell(t, i))}
          {!prefersReducedMotion && sequence.map((t, i) => renderCell(t, `dup-${i}`))}
        </div>
      </div>
    </div>
  );
}
