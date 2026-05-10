// ═══════════════════════════════════════════════════════════════
//  TICKER TAPE v5.0 « Institutional Terminal »
//
//  Sticky strip 24 px between CommandBar (32 px) and main content.
//  Scrolls horizontally at ~30 px/s. Hover pauses the marquee.
//  Click on a ticker navigates to /trading/chain?ticker=X.
//
//  Sources :
//    - 3 indices fixes : SPX / QQQ / VIX via useMarketQuotes
//      (cascade Finnhub → Yahoo → CBOE, polled every 60 s)
//    - Positions ouvertes via useOpenPositions (mark price = pos.pc)
//
//  Empty states :
//    - Aucune position + aucun quote indices → render null (le shell
//      fonctionne sans ticker tape, pas une zone vide qui flotte)
//    - Quotes en attente initiale → on affiche les libellés avec ——
//      pour le prix (jamais de chiffre random — cf. décision Sprint 0
//      « pas de mock global polluant en prod »)
//
//  Sprint 1 livre le squelette + indices + positions. Sprint 5 (Pre-
//  Market Briefing) ajoutera la watchlist quand le store l'expose.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOpenPositions } from '../../store/useStore';
import useMarketQuotes from '../../hooks/useMarketQuotes';

const INDICES = ['SPX', 'QQQ', 'VIX'];

const fmtPrice = (v) => {
  if (v == null || !Number.isFinite(v)) return '——';
  if (Math.abs(v) >= 10000) {
    return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtPctChange = (v) => {
  if (v == null || !Number.isFinite(v)) return null;
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(2)}%`;
};

function buildItems(positions, quotes) {
  const indexItems = INDICES.map((sym) => {
    const q = quotes[sym];
    return {
      key: `idx-${sym}`,
      ticker: sym,
      type: 'index',
      price: q?.price ?? null,
      changePct: q?.changePercent ?? null,
    };
  });

  const positionItems = positions.map((pos) => {
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

  return [...indexItems, ...positionItems];
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
  const { quotes } = useMarketQuotes(INDICES);

  const items = useMemo(() => buildItems(positions, quotes), [positions, quotes]);

  // Always render at least the 3 indices — the bar's value is permanent
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
