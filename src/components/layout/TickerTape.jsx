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
// 1.C.10-bis — LED NYSE (ordre architecte) : Doto variable dot-matrix,
// auto-hébergée (fontsource, SIL OFL), variante `full` = axes wght+ROND.
// Import scopé au bandeau : seul le tape consomme cette police.
import '@fontsource-variable/doto/full.css';
import useMarketQuotes from '../../hooks/useMarketQuotes';
import { useMarketSparklines } from '../../hooks/useMarketSparklines';
import usePriceFlash from '../../hooks/usePriceFlash';
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
// Exportés pour le MarketDeck (1.C) : il consomme la MÊME liste → le
// poller partagé (useMarketQuotes/useMarketSparklines) reste unique.
export const STATIC_TICKERS = [
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

export const STATIC_FETCH_SYMBOLS = STATIC_TICKERS.map((t) => t.fetch);

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

// Sparkline inline — spec DA Obsidienne (1.B.2) : stroke 1 px, aire fermée
// à 8 % (≤ cap 8 %), AUCUN glow, ~56×30. Couleurs directionnelles
// conservées (sémantique marché).
export function TickerSparkline({ prices, color, width = 84, height = 46, stroke = 1 }) {
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
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <path d={areaD} fill={color} fillOpacity="0.08" stroke="none" />
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

// Δ net en valeur (1.B.2) : priorité au champ `change` du payload quotes ;
// sinon dérivé du prix et du pourcentage (net = price − price/(1+pct/100)).
// Aucun nouveau champ réseau, aucun nouvel appel.
function netChange(quote) {
  if (!quote) return null;
  if (quote.change != null && Number.isFinite(quote.change)) return quote.change;
  const { price, changePercent: pct } = quote;
  if (price == null || pct == null || !Number.isFinite(price) || !Number.isFinite(pct)) return null;
  if (pct <= -100) return null;
  return price - price / (1 + pct / 100);
}

// Formatage du Δ net — mêmes conventions d'affichage que formatPrice
// (FX 4 décimales, de-CH arrondi ≥1000, sinon 2 décimales), signé.
function formatNetChange(net, ticker) {
  if (net == null || !Number.isFinite(net)) return null;
  const sign = net > 0 ? '+' : net < 0 ? '−' : '';
  const abs = Math.abs(net);
  const classKey = getAssetClass(ticker);
  if (classKey === 'FX') return `${sign}${abs.toFixed(4)}`;
  if (abs >= 1000) return `${sign}${new Intl.NumberFormat('de-CH').format(Math.round(abs))}`;
  return `${sign}${abs.toFixed(2)}`;
}

function TickerCell({ ticker, quote, spark, state }) {
  const price = quote?.price;
  const change = quote?.changePercent;
  const net = netChange(quote);
  const netText = formatNetChange(net, ticker.display);
  const stateClass = `ticker-cell--${state.toLowerCase()}`;
  const changeClass =
    change > 0 ? 'qc-profit' : change < 0 ? 'qc-loss' : 'qc-text-secondary';
  const changeArrow = change > 0 ? '▲' : change < 0 ? '▼' : '';
  // 1.B.3/L2 — flash au tick (variante D) : overlay plat + pulse de
  // luminosité du prix, re-déclenchés par key à chaque changement de prix.
  const flash = usePriceFlash(price);

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
      {flash && (
        <span
          key={flash.id}
          className={`tape-flash tape-flash--${flash.dir}`}
          aria-hidden="true"
        />
      )}
      {/* Bloc gauche — SYMBOLE au-dessus du PRIX (héros de cellule). */}
      <div className="ticker-cell__main">
        <span className="ticker-cell__symbol">{ticker.display}</span>
        {state === 'OFFLINE' ? (
          <span className="ticker-cell__value ticker-cell__value--offline qc-num">—</span>
        ) : (
          <span
            key={flash ? `p${flash.id}` : 'p'}
            className={`ticker-cell__value qc-num${flash ? ' ticker-cell__value--pulse' : ''}`}
          >
            {formatPrice(price, ticker.display)}
          </span>
        )}
      </div>
      {/* Bloc droit — pastille Δ% au-dessus du Δ net (couleurs marché
          conservées ; pastille désaturée 16 %, variante D). */}
      {change != null && Number.isFinite(change) && (
        <div className="ticker-cell__delta">
          <span className={`ticker-cell__change qc-pct ${changeClass}`}>
            {changeArrow && <span className="ticker-cell__arrow">{changeArrow}</span>}
            {Math.abs(change).toFixed(2)}%
          </span>
          {netText && (
            <span className={`ticker-cell__change-net ${changeClass}`}>{netText}</span>
          )}
        </div>
      )}
      {state !== 'OFFLINE' && spark?.prices && spark.prices.length > 1 && (
        <span className="ticker-cell__sparkline">
          <TickerSparkline prices={spark.prices} color={sparkColor} width={84} height={46} />
        </span>
      )}
    </div>
  );
}

// Vue présentationnelle — reçoit quotes/sparklines en props (héritage
// du lab 1.B.3, purgé ; conservée : elle isole le rendu des hooks).
function TickerTapeView({ quotes, sparklines, prefersReducedMotion }) {
  const now = new Date();

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

export default function TickerTape() {
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

  return (
    <TickerTapeView
      quotes={quotes}
      sparklines={sparklines}
      prefersReducedMotion={prefersReducedMotion}
    />
  );
}
