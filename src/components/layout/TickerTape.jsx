// ═══════════════════════════════════════════════════════════════
//  TICKER TAPE — Scrolling marquee, TROIS GROUPES (1.G-c · D2)
//
//  Le bandeau ne double plus le cockpit (indices/FX/matières vivaient
//  aux deux endroits — DAX/FTSE/BTC/ETH deux fois). Il porte désormais
//  ce que le cockpit ne montre PAS, en trois groupes étiquetés :
//    1. MAG 7      — fixe : AAPL·MSFT·NVDA·GOOGL·AMZN·META·TSLA.
//    2. POSITIONS  — sous-jacents détenus (dynamique, dédup. du Mag 7) :
//                    chaque nom porte un POINT AMBRE + son P&L LATENT.
//                    Groupe vide → il DISPARAÎT (aucun placeholder).
//    3. SECTEURS   — 8 leaders hors Mag 7, ÉDITABLES en Réglages.
//
//  Marquee CSS infinite (track dupliqué, translateX 0 → -50 %). Hover
//  pause. prefers-reduced-motion : rendu 1×, scroll manuel (overflow-x).
//  Hauteur via --qc-ticker-h (92 px ≥1440). Doto LED + flash au tick
//  INTOUCHÉS (gel MarketDeck : contenu/échelle/densité seulement).
//
//  Cellule = [point ambre?] SYMBOLE / PRIX héro + pastille Δ% / Δ net +
//  [P&L latent si détenu] + sparkline 1D. Quotes/sparks via les pollers
//  partagés (batch /api/quotes désormais : 1 requête par cycle).
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
import { buildTapeGroups } from '../../config/tapeGroups';
import { useOpenPositions, useSettings } from '../../store/useStore';

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
    // de-CH = apostrophe Suisse-allemande (7'580), cohérent avec le reste
    // de l'app qui formate les CHF dans cette locale.
    return new Intl.NumberFormat('de-CH').format(Math.round(price));
  }
  return price.toFixed(2);
}

// Sparkline inline — spec DA Obsidienne (1.B.2) : stroke 1 px, aire fermée
// à 8 % (≤ cap 8 %), AUCUN glow, ~84×46. Couleurs directionnelles
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
function netChange(quote) {
  if (!quote) return null;
  if (quote.change != null && Number.isFinite(quote.change)) return quote.change;
  const { price, changePercent: pct } = quote;
  if (price == null || pct == null || !Number.isFinite(price) || !Number.isFinite(pct)) return null;
  if (pct <= -100) return null;
  return price - price / (1 + pct / 100);
}

// Formatage du Δ net — mêmes conventions d'affichage que formatPrice.
function formatNetChange(net, ticker) {
  if (net == null || !Number.isFinite(net)) return null;
  const sign = net > 0 ? '+' : net < 0 ? '−' : '';
  const abs = Math.abs(net);
  const classKey = getAssetClass(ticker);
  if (classKey === 'FX') return `${sign}${abs.toFixed(4)}`;
  if (abs >= 1000) return `${sign}${new Intl.NumberFormat('de-CH').format(Math.round(abs))}`;
  return `${sign}${abs.toFixed(2)}`;
}

// P&L latent (USD) d'un sous-jacent détenu — argent RÉEL, donc la LOI DE
// COULEUR s'applique (le SEUL rouge/vert « argent » du bandeau). Arrondi
// au dollar, milliers à la suisse, préfixe « $ » manuel (pas d'Intl
// currency qui insère un NBSP).
function formatPnlUsd(v) {
  if (v == null || !Number.isFinite(v)) return null;
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  const abs = Math.abs(v);
  const num = abs >= 1000 ? new Intl.NumberFormat('de-CH').format(Math.round(abs)) : Math.round(abs).toString();
  return `${sign}$${num}`;
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

  // P&L latent (groupe POSITIONS) — loi de couleur : perte réelle rouge,
  // gain réel vert, plat neutre.
  const pnlText = ticker.held ? formatPnlUsd(ticker.pnl) : null;
  const pnlClass =
    ticker.pnl > 0 ? 'qc-profit' : ticker.pnl < 0 ? 'qc-loss' : 'qc-text-secondary';

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
      {/* Bloc gauche — SYMBOLE (point ambre si détenu) au-dessus du PRIX. */}
      <div className="ticker-cell__main">
        <span className="ticker-cell__symbol">
          {ticker.held && <span className="ticker-cell__dot" aria-hidden="true" />}
          {ticker.display}
        </span>
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
      {/* Bloc droit — pastille Δ% au-dessus du Δ net (couleurs marché). */}
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
      {/* P&L latent — uniquement pour les sous-jacents détenus. */}
      {pnlText && (
        <span className={`ticker-cell__pnl ${pnlClass}`} title="P&L latent de la position">
          {pnlText}
        </span>
      )}
      {state !== 'OFFLINE' && spark?.prices && spark.prices.length > 1 && (
        <span className="ticker-cell__sparkline">
          <TickerSparkline prices={spark.prices} color={sparkColor} width={84} height={46} />
        </span>
      )}
    </div>
  );
}

// Séquence PLATE du track : [label][cells…][sep][label][cells…]… Émise
// telle quelle en enfants flex du track (le label et le séparateur sont
// des flex-items au même titre que les cellules). `keyPrefix` distingue
// l'original de sa copie marquee.
function trackChildren(groups, quotes, sparklines, now, keyPrefix) {
  const out = [];
  groups.forEach((g, gi) => {
    if (gi > 0) {
      out.push(<span className="ticker-sep" aria-hidden="true" key={`${keyPrefix}sep-${g.key}`} />);
    }
    out.push(
      <span className="ticker-group-label" key={`${keyPrefix}lbl-${g.key}`}>
        {g.label}
      </span>
    );
    g.items.forEach((it, i) =>
      out.push(
        <TickerCell
          key={`${keyPrefix}${g.key}-${it.fetch}-${i}`}
          ticker={it}
          quote={quotes[it.fetch]}
          spark={sparklines[it.fetch]}
          state={deriveState(quotes[it.fetch], it.classKey, now)}
        />
      )
    );
  });
  return out;
}

// Vue présentationnelle — reçoit groupes + quotes/sparklines en props.
function TickerTapeView({ groups, quotes, sparklines, prefersReducedMotion }) {
  const now = new Date();
  return (
    <div className={`ticker-tape ${prefersReducedMotion ? 'ticker-tape--reduced' : ''}`}>
      <div className="ticker-tape__viewport">
        <div className="ticker-tape__track">
          {trackChildren(groups, quotes, sparklines, now, '')}
          {!prefersReducedMotion && trackChildren(groups, quotes, sparklines, now, 'dup-')}
        </div>
      </div>
    </div>
  );
}

export default function TickerTape() {
  const openPositions = useOpenPositions();
  const { tapeSectors } = useSettings();

  // Composition des 3 groupes + liste de symboles à requêter (pure,
  // testée dans config/tapeGroups).
  const { groups, fetchSymbols } = useMemo(
    () => buildTapeGroups({ openPositions, tapeSectors }),
    [openPositions, tapeSectors]
  );

  const { quotes } = useMarketQuotes(fetchSymbols);
  const { sparklines } = useMarketSparklines(fetchSymbols);

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
      groups={groups}
      quotes={quotes}
      sparklines={sparklines}
      prefersReducedMotion={prefersReducedMotion}
    />
  );
}
