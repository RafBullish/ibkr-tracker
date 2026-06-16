// ═══════════════════════════════════════════════════════════════
//  useWatchlist — slice store `watchlist` + quotes live (U6)
//
//  Lit la liste de tickers persistée dans le store (slice `watchlist`,
//  clé localStorage `ibkr_u_w`, actions ADD_TICKER / REMOVE_TICKER) et
//  récupère pour chacun sa quote via le MÊME hook que PreMarketBriefing
//  (useMarketQuotes → endpoint /api/quote, cascade Finnhub→Yahoo→CBOE).
//  Aucune nouvelle source externe, aucun fetch dupliqué.
//
//  Renvoie un tableau de lignes prêtes pour <Watchlist /> :
//    { tk, last, chgPct, change, hasQuote, error }
//  Les champs prix/variation sont `null` tant que la quote n'est pas
//  revenue (le composant rend `—`, jamais un faux 0).
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useWatchlistTickers } from '../store/useStore';
import useMarketQuotes from './useMarketQuotes';

export function useWatchlist() {
  const tickers = useWatchlistTickers();
  // Référence stable tant que la liste ne change pas → pas de refetch
  // à chaque render (useMarketQuotes est keyé sur l'identité de symbols).
  const symbols = useMemo(() => (Array.isArray(tickers) ? tickers : []), [tickers]);

  const { quotes, errors } = useMarketQuotes(symbols);

  return useMemo(
    () =>
      symbols.map((tk) => {
        const q = quotes?.[tk];
        return {
          tk,
          last: q && Number.isFinite(q.price) ? q.price : null,
          chgPct: q && Number.isFinite(q.changePercent) ? q.changePercent : null,
          change: q && Number.isFinite(q.change) ? q.change : null,
          hasQuote: !!q,
          error: errors?.[tk] || null,
        };
      }),
    [symbols, quotes, errors]
  );
}

export default useWatchlist;
