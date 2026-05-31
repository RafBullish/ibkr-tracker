// ═══════════════════════════════════════════════════════════════
//  TICKER TAPE — Scrolling marquee, 19 curated instruments
//
//  Bandeau DÉFILANT type Bloomberg. Avec 19 cellules la bande déborde
//  largement la viewport → marquee CSS infinite (translateX 0 → -50%
//  sur contenu dupliqué) révèle progressivement tout le contenu.
//  Hover pause. prefers-reduced-motion : pas d'animation, scroll manuel
//  via overflow-x auto (fallback minimal). Hauteur 64 px via le token
//  --qc-ticker-h (cf. tokens.css).
//
//  Liste curée, éditable à la main. Le book d'open positions vit
//  ailleurs (LivePositions), ce bandeau = contexte marché pur.
//
//  Cellule = bloc texte empilé [symbole · change%] / [prix héro 24 px]
//  + sparkline 60×32 à droite. Le prix domine par la taille (héros).
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import useMarketQuotes from '../../hooks/useMarketQuotes';
import { useMarketSparklines } from '../../hooks/useMarketSparklines';
import { isMarketOpen, getAssetClass } from '../../utils/marketHours';

// Liste curée, éditable à la main. Ajouter / retirer un ticker = touche
// uniquement ce bloc. classKey pilote l'horaire de marché pour deriveState.
//
// Notes classKey :
//   - US10Y : sémantiquement RATES, mais marketHours.js ne connaît que
//     US_INDICES/FX/CRYPTO/COMMODITIES/EQUITIES. ^TNX = indice CBOE coté
//     pendant la session NYSE → US_INDICES couvre correctement.
//   - INTL_INDICES (DAX/FTSE/NIKKEI) : classe non enregistrée dans
//     marketHours.js → isMarketOpen renvoie false → state CLOSED en
//     permanence. Sans impact visuel (pas de règle CSS sur l'état
//     CLOSED), prix/spark s'affichent normalement. Étendre marketHours.js
//     si une vraie détection de session étrangère devient nécessaire.
const STATIC_TICKERS = [
  { display: 'SPX',     fetch: '^SPX',     classKey: 'US_INDICES' },
  { display: 'NDX',     fetch: '^NDX',     classKey: 'US_INDICES' },
  { display: 'DJI',     fetch: '^DJI',     classKey: 'US_INDICES' },
  { display: 'RUT',     fetch: '^RUT',     classKey: 'US_INDICES' },
  { display: 'VIX',     fetch: '^VIX',     classKey: 'US_INDICES' },
  { display: 'USD/CHF', fetch: 'USDCHF=X', classKey: 'FX' },
  { display: 'EUR/USD', fetch: 'EURUSD=X', classKey: 'FX' },
  { display: 'GOLD',    fetch: 'GC=F',     classKey: 'COMMODITIES' },
  { display: 'US10Y',   fetch: '^TNX',     classKey: 'US_INDICES' },
  { display: 'DXY',     fetch: 'DX-Y.NYB', classKey: 'FX' },
  { display: 'CRUDE',   fetch: 'CL=F',     classKey: 'COMMODITIES' },
  { display: 'DAX',     fetch: '^GDAXI',   classKey: 'INTL_INDICES' },
  { display: 'FTSE',    fetch: '^FTSE',    classKey: 'INTL_INDICES' },
  { display: 'NIKKEI',  fetch: '^N225',    classKey: 'INTL_INDICES' },
  { display: 'BTC',     fetch: 'BTC-USD',  classKey: 'CRYPTO' },
  { display: 'ETH',     fetch: 'ETH-USD',  classKey: 'CRYPTO' },
  { display: 'SILVER',  fetch: 'SI=F',     classKey: 'COMMODITIES' },
  { display: 'COPPER',  fetch: 'HG=F',     classKey: 'COMMODITIES' },
  { display: 'NATGAS',  fetch: 'NG=F',     classKey: 'COMMODITIES' },
];

const STATIC_FETCH_SYMBOLS = STATIC_TICKERS.map((t) => t.fetch);

// Note : ^SPX et ^VIX peuvent rater Finnhub puis tomber sur Yahoo
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
  // US10Y / ^TNX : la valeur brute renvoyée par /api/quote est déjà dans la
  // bonne unité (~4.4 pour 4.4 %). Pas de division ici — la division /10
  // ajoutée lors d'une brique précédente affichait 0.45 et a été retirée.
  // Le proxy semble normaliser le quirk Yahoo en amont ou Finnhub répond
  // directement dans la bonne échelle.
  const classKey = getAssetClass(ticker);
  if (classKey === 'FX') return price.toFixed(4);
  if (price >= 1000) {
    // de-CH = apostrophe Suisse-allemande (7'580), cohérent avec le reste
    // de l'app qui formate les CHF dans cette locale.
    return new Intl.NumberFormat('de-CH').format(Math.round(price));
  }
  return price.toFixed(2);
}

// Sparkline inline : couleur explicite passée en prop (pas de dépendance
// au composant ui/Sparkline). Defaults 60×32 stroke 2 pour rendu plus
// contrasté qu'avant, lisible d'un œil dans le bandeau 64 px.
function TickerSparkline({ prices, color, width = 60, height = 32, stroke = 2 }) {
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
    if (!spark?.prices || spark.prices.length < 2) return 'var(--ink-soft)';
    const first = spark.prices[0];
    const last = spark.prices[spark.prices.length - 1];
    if (last > first) return 'var(--pnl-up)';
    if (last < first) return 'var(--pnl-down)';
    return 'var(--ink-soft)';
  }, [spark]);

  return (
    <div className={`ticker-cell ${stateClass}`}>
      <div className="ticker-cell__text">
        <div className="ticker-cell__head">
          <span className="ticker-cell__symbol">{ticker.display}</span>
          {change != null && Number.isFinite(change) && (
            <span
              className={`ticker-cell__change qc-pct ${changeClass}${isStrongMove ? ' ticker-cell__change--glow' : ''}`}
            >
              {changeArrow && <span className="ticker-cell__arrow">{changeArrow}</span>}
              {Math.abs(change).toFixed(2)}%
            </span>
          )}
        </div>
        {state === 'OFFLINE' ? (
          <span className="ticker-cell__value ticker-cell__value--offline qc-num">—</span>
        ) : (
          <span className="ticker-cell__value qc-num">{formatPrice(price, ticker.display)}</span>
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
  const now = new Date();
  const { quotes } = useMarketQuotes(STATIC_FETCH_SYMBOLS);
  const { sparklines } = useMarketSparklines(STATIC_FETCH_SYMBOLS);

  // Marquee seamless = liste rendue 2× (track translateX 0 → -50 %).
  // En reduced-motion, contenu rendu 1× + overflow-x:auto pour scroll manuel.
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const renderCell = (t, key) => (
    <TickerCell
      key={key}
      ticker={t}
      quote={quotes[t.fetch]}
      spark={sparklines[t.fetch]}
      state={deriveState(quotes[t.fetch], t.classKey, now)}
    />
  );

  return (
    <div className={`ticker-tape ${prefersReducedMotion ? 'ticker-tape--reduced' : ''}`}>
      <div className="ticker-tape__viewport">
        <div className="ticker-tape__track">
          {STATIC_TICKERS.map((t) => renderCell(t, t.fetch))}
          {!prefersReducedMotion &&
            STATIC_TICKERS.map((t) => renderCell(t, `dup-${t.fetch}`))}
        </div>
      </div>
    </div>
  );
}
