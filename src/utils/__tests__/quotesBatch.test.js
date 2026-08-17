// ═══════════════════════════════════════════════════════════════
//  fetchQuotesBatch / fetchMultipleQuotes (1.G-c · D2).
//
//  PREUVE de la garantie « une seule requête par cycle » côté client :
//  N symboles → UN SEUL fetch /api/quotes. Vérifie aussi le remappage
//  sur le ticker original, la dédup, et la dégradation propre.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchQuotesBatch, fetchMultipleQuotes } from '../stockApi';

function jsonResponse(body, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchQuotesBatch — une seule requête pour N symboles', () => {
  it('22 symboles → 1 appel /api/quotes', async () => {
    const symbols = Array.from({ length: 22 }, (_, i) => `SYM${i}`);
    const quotes = Object.fromEntries(symbols.map((s) => [s, { price: 100 + Number(s.slice(3)) }]));
    const fetchMock = vi.fn(() => jsonResponse({ quotes, errors: {}, ts: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    const { results } = await fetchQuotesBatch(symbols);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain('/api/quotes?symbols=');
    expect(Object.keys(results)).toHaveLength(22);
    expect(results.SYM0.price).toBe(100);
  });

  it('mappe la quote sur le ticker ORIGINAL passé par l’appelant', async () => {
    const fetchMock = vi.fn(() =>
      jsonResponse({ quotes: { AAPL: { price: 231.5, change: 2, changePercent: 0.9, stale: false } }, errors: {} })
    );
    vi.stubGlobal('fetch', fetchMock);
    const { results, errors } = await fetchQuotesBatch(['AAPL']);
    expect(errors).toEqual([]);
    expect(results.AAPL).toMatchObject({ price: 231.5, change: 2, stale: false });
  });

  it('symbole absent de la réponse → erreur, pas de crash', async () => {
    const fetchMock = vi.fn(() =>
      jsonResponse({ quotes: { AAPL: { price: 231 } }, errors: { MSFT: 'unavailable' } })
    );
    vi.stubGlobal('fetch', fetchMock);
    const { results, errors } = await fetchQuotesBatch(['AAPL', 'MSFT']);
    expect(results.AAPL.price).toBe(231);
    expect(results.MSFT).toBeUndefined();
    expect(errors).toContainEqual({ ticker: 'MSFT', error: 'unavailable' });
  });

  it('déduplique les symboles (une seule occurrence dans l’URL)', async () => {
    const fetchMock = vi.fn(() => jsonResponse({ quotes: { AAPL: { price: 1 } }, errors: {} }));
    vi.stubGlobal('fetch', fetchMock);
    await fetchQuotesBatch(['AAPL', 'aapl', 'AAPL']);
    const url = decodeURIComponent(fetchMock.mock.calls[0][0]);
    expect(url.match(/AAPL/g)).toHaveLength(1);
  });

  it('échec réseau global → chaque ticker en erreur, aucun throw', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('network down')));
    vi.stubGlobal('fetch', fetchMock);
    const { results, errors } = await fetchQuotesBatch(['AAPL', 'MSFT']);
    expect(results).toEqual({});
    expect(errors.map((e) => e.ticker).sort()).toEqual(['AAPL', 'MSFT']);
  });

  it('liste vide → aucun appel réseau', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { results, errors } = await fetchQuotesBatch([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(results).toEqual({});
    expect(errors).toEqual([]);
  });
});

describe('fetchMultipleQuotes — délègue au batch (forme inchangée)', () => {
  it('renvoie {results, errors} en un seul appel', async () => {
    const fetchMock = vi.fn(() =>
      jsonResponse({ quotes: { '^SPX': { price: 5800 } }, errors: {} })
    );
    vi.stubGlobal('fetch', fetchMock);
    const { results } = await fetchMultipleQuotes(['^SPX']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results['^SPX'].price).toBe(5800);
  });
});
