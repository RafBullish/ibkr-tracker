// ═══════════════════════════════════════════════════════════════
//  api/quotes.js — endpoint BATCH (1.G-c · D2).
//
//  Preuve serveur : symboles normalisés + dédupliqués + TRIÉS (URL
//  déterministe = clé de cache CDN unique), en-tête Cache-Control
//  PARTAGEABLE (`public, s-maxage`), plafond dur, forme de réponse.
//  Les sources amont sont mockées (aucun appel réseau réel).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock des sources amont : resolveQuote renvoie une quote factice ;
// sanitizeSymbol garde le vrai comportement (charset broker/indice).
vi.mock('../../../api/_quoteSources.js', () => ({
  resolveQuote: vi.fn(async (sym) => (sym === 'DEAD' ? null : { price: 1, source: 'mock', symEcho: sym })),
  sanitizeSymbol: (raw) =>
    String(raw || '')
      .toUpperCase()
      .replace(/[^A-Z0-9.^=-]/g, ''),
}));

import handler from '../../../api/quotes.js';
import { resolveQuote } from '../../../api/_quoteSources.js';
import { __resetRateLimitForTests } from '../../../api/_rateLimit.js';

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: null };
  res.setHeader = (k, v) => {
    res.headers[k.toLowerCase()] = v;
  };
  res.status = (c) => {
    res.statusCode = c;
    return res;
  };
  res.json = (b) => {
    res.body = b;
    return res;
  };
  res.end = () => res;
  return res;
}
function mockReq(query, method = 'GET') {
  return { method, headers: {}, socket: { remoteAddress: `ip-${Math.round(query.__ip || 0)}` }, query };
}

beforeEach(() => {
  __resetRateLimitForTests();
  resolveQuote.mockClear();
});

describe('api/quotes — batch', () => {
  it('symboles vides → 400', async () => {
    const res = mockRes();
    await handler(mockReq({ symbols: '' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('OPTIONS → 200 (préflight)', async () => {
    const res = mockRes();
    await handler(mockReq({ symbols: 'AAPL' }, 'OPTIONS'), res);
    expect(res.statusCode).toBe(200);
  });

  it('normalise + déduplique + TRIE les symboles (URL/traitement déterministe)', async () => {
    const res = mockRes();
    await handler(mockReq({ symbols: 'msft,aapl,AAPL,nvda' }), res);
    const called = resolveQuote.mock.calls.map((c) => c[0]);
    expect(called).toEqual(['AAPL', 'MSFT', 'NVDA']); // trié, dédupliqué, une seule fois AAPL
  });

  it('en-tête Cache-Control PARTAGEABLE (public + s-maxage + SWR)', async () => {
    const res = mockRes();
    await handler(mockReq({ symbols: 'AAPL' }), res);
    expect(res.headers['cache-control']).toBe('public, s-maxage=30, stale-while-revalidate=60');
  });

  it('forme { quotes, errors, ts } ; source morte → errors', async () => {
    const res = mockRes();
    await handler(mockReq({ symbols: 'AAPL,DEAD' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.quotes.AAPL).toMatchObject({ price: 1 });
    expect(res.body.quotes.DEAD).toBeUndefined();
    expect(res.body.errors.DEAD).toBe('unavailable');
    expect(typeof res.body.ts).toBe('number');
  });

  it('plafonné à 40 symboles', async () => {
    const many = Array.from({ length: 60 }, (_, i) => `S${i}`).join(',');
    const res = mockRes();
    await handler(mockReq({ symbols: many }), res);
    expect(resolveQuote.mock.calls.length).toBe(40);
  });
});
