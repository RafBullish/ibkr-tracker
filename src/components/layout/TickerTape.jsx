// ═══════════════════════════════════════════════════════════════
//  TICKER TAPE v5.1 « Institutional Terminal » — 4K refonte
//
//  Sticky strip (var --shell-tickertape-h) between CommandBar et main.
//  Scrolls horizontally at ~30 px/s. Hover pauses the marquee.
//  Click on a ticker navigates to /trading/chain?ticker=X.
//
//  Sources :
//    - 10 tickers statiques (indices US, crypto, FX, métaux)
//      via useMarketQuotes (cascade Finnhub → Yahoo → CBOE, 60 s)
//    - Positions ouvertes via useOpenPositions (mark price = pos.pc),
//      dédupliquées par rapport aux statiques pour éviter le double
//      affichage si une position partage un symbole macro (e.g. SPX)
//
//  Mapping display / fetch :
//    - Le label affiché reste compact (SPX, BTC, USD/CHF, GOLD…)
//    - Le symbole envoyé à /api/quote utilise le suffixe Yahoo
//      requis pour les indices (^), forex (=X) et futures (=F).
//    - La regex serveur autorise A-Z0-9.^=- ; les caractères hors
//      classe sont déjà neutralisés côté backend (cf. api/quote/
//      [ticker].js).
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOpenPositions } from '../../store/useStore';
import useMarketQuotes from '../../hooks/useMarketQuotes';

// Tickers statiques affichés au tout début de la ticker tape.
//   `display` = libellé visible dans l'UI + clé de dédup positions
//   `fetch`   = symbole résolu côté /api/quote (suffixe Yahoo si besoin)
// Ordre intentionnel : indices US → crypto → FX → métaux.
const STATIC_TICKERS = [
  // Indices US
  { display: 'SPX', fetch: 'SPX' },
  { display: 'NDX', fetch: '^NDX' },
  { display: 'DJI', fetch: '^DJI' },
  { display: 'RUT', fetch: '^RUT' },
  { display: 'VIX', fetch: 'VIX' },
  // Crypto
  { display: 'BTC', fetch: 'BTC-USD' },
  { display: 'ETH', fetch: 'ETH-USD' },
  // Forex
  { display: 'USD/CHF', fetch: 'USDCHF=X' },
  { display: 'EUR/USD', fetch: 'EURUSD=X' },
  // Métaux (Gold front-month future Yahoo, ≈ XAU/USD spot)
  { display: 'GOLD', fetch: 'GC=F' },
];

const STATIC_FETCH_SYMBOLS = STATIC_TICKERS.map((t) => t.fetch);
const STATIC_DISPLAY_SET = new Set(STATIC_TICKERS.map((t) => t.display.toUpperCase()));

const fmtPrice = (v) => {
  if (v == null || !Number.isFinite(v)) return '——';
  if (Math.abs(v) >= 10000) {
    return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  // FX rates need 4 decimals to be useful (USD/CHF, EUR/USD).
  if (Math.abs(v) < 10) {
    return v.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  }
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtPctChange = (v) => {
  if (v == null || !Number.isFinite(v)) return null;
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(2)}%`;
};

function buildItems(positions, quotes) {
  const staticItems = STATIC_TICKERS.map(({ display, fetch }) => {
    const q = quotes[fetch];
    return {
      key: `idx-${display}`,
      ticker: display,
      type: 'index',
      price: q?.price ?? null,
      changePct: q?.changePercent ?? null,
    };
  });

  // Dédup : on ignore les positions dont le ticker matche un statique
  // (e.g. position SPX redondante avec le statique SPX).
  const positionItems = positions
    .filter((pos) => {
      if (!pos?.tk) return false;
      return !STATIC_DISPLAY_SET.has(String(pos.tk).toUpperCase());
    })
    .map((pos) => {
      const price = typeof pos.pc === 'number' && Number.isFinite(pos.pc) ? pos.pc : null;
      const entry = typeof pos.pi === 'number' && Number.isFinite(pos.pi) ? pos.pi : null;
      let changePct = null;
      if (price != null && entry != null && entry !== 0) {
        changePct = ((price - entry) / entry) * 100;
      }
      return {
        key: `pos-${pos.id}`,
        ticker: pos.tk,
        type: 'position',
        price,
        changePct,
      };
    });

  return [...staticItems, ...positionItems];
}

function TickerCell({ item, onClick }) {
  const { ticker, type, price, changePct } = item;
  const semantic =
    changePct == null ? 'neutral' : changePct > 0 ? 'bull' : changePct < 0 ? 'bear' : 'neutral';
  const formattedChange = fmtPctChange(changePct);

  return (
    <button
      type="button"
      className="tickertape__cell"
      data-type={type}
      onClick={() => onClick(ticker)}
      title={`Voir la chaîne d'options ${ticker}`}
    >
      <span className="tickertape__sym">{ticker}</span>
      <span className="tickertape__px">{fmtPrice(price)}</span>
      {formattedChange ? (
        <span className="tickertape__chg" data-semantic={semantic}>
          {formattedChange}
        </span>
      ) : null}
    </button>
  );
}

export default function TickerTape() {
  const positions = useOpenPositions();
  const navigate = useNavigate();
  const { quotes } = useMarketQuotes(STATIC_FETCH_SYMBOLS);

  const items = useMemo(() => buildItems(positions, quotes), [positions, quotes]);

  // Always render at least the 10 statics — the bar's value is permanent
  // visibility of macro context, even when the user has no positions yet.
  // The cells will display "——" until first quote arrives.
  if (items.length === 0) return null;

  const handleClick = (ticker) => {
    navigate(`/trading/chain?ticker=${encodeURIComponent(ticker)}`);
  };

  // Duplicate items so the marquee loops seamlessly (translateX -50%).
  return (
    <div className="tickertape" role="marquee" aria-label="Cours en direct">
      <div className="tickertape__track">
        {items.map((item) => (
          <TickerCell key={item.key} item={item} onClick={handleClick} />
        ))}
        {items.map((item) => (
          <TickerCell key={`${item.key}-dup`} item={item} onClick={handleClick} />
        ))}
      </div>
    </div>
  );
}
