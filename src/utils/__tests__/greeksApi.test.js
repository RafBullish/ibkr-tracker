// ═══════════════════════════════════════════════════════════════
//  getGreeksForAllPositions — local Black-Scholes pipeline (B2)
//
//  Mocks /api/quote/[ticker] via vi.stubGlobal('fetch'). Verifies
//  the Map shape, source flags, and that bad inputs (spot missing,
//  mark=0, expiry passed) produce 'unavailable' cleanly.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getGreeksForAllPositions,
  __resetGreeksApiForTests,
} from '../greeksApi';

// Plausible spot map. Mock fetch reads this then returns a Finnhub-shaped
// quote response. Test can mutate to simulate missing tickers.
const spots = {
  CVX: 160,
  XOM: 110,
};

beforeEach(() => {
  __resetGreeksApiForTests();
  vi.stubGlobal('fetch', async (url) => {
    // /api/quote/[ticker]
    const m = String(url).match(/\/api\/quote\/([^?]+)/);
    if (!m) throw new Error('unexpected url ' + url);
    const tk = decodeURIComponent(m[1]);
    const price = spots[tk];
    if (!Number.isFinite(price)) {
      return new Response(JSON.stringify({ error: 'not found' }), { status: 502 });
    }
    return new Response(
      JSON.stringify({
        price,
        change: 0,
        changePercent: 0,
        source: 'finnhub',
        timestamp: new Date().toISOString(),
        stale: false,
      }),
      { status: 200 }
    );
  });
});

// Generate a position 60 days out, with a plausible mark.
function futureExpiry(daysOut = 60) {
  const d = new Date(Date.now() + daysOut * 86_400_000);
  return d.toISOString().slice(0, 10);
}

describe('getGreeksForAllPositions — B2 local BSM', () => {
  it('option position with valid spot + mark → source "computed", greeks finite', async () => {
    const positions = [
      {
        id: 'p1',
        as: 'Option',
        dir: 'Long',
        tk: 'CVX',
        ty: 'CALL',
        st: '165',
        ex: futureExpiry(45),
        ct: '1',
        mu: '100',
        pi: '3.00',
        pc: '3.50', // mark
      },
    ];
    const map = await getGreeksForAllPositions(positions);
    expect(map.size).toBe(1);
    const g = map.get('p1');
    expect(g.source).toBe('computed');
    expect(Number.isFinite(g.delta)).toBe(true);
    expect(Number.isFinite(g.gamma)).toBe(true);
    expect(Number.isFinite(g.theta)).toBe(true);
    expect(Number.isFinite(g.vega)).toBe(true);
    expect(Number.isFinite(g.iv)).toBe(true);
    expect(g.spot).toBe(160);
    // ⭐ Backlog phase A : long call → theta < 0 (acheteur paie le decay).
    expect(g.theta).toBeLessThan(0);
    expect(g.vega).toBeGreaterThan(0);
    expect(g.delta).toBeGreaterThan(0);
    expect(g.delta).toBeLessThan(1);
  });

  it('spot missing (502 on /api/quote) → "unavailable"', async () => {
    const positions = [
      {
        id: 'p1',
        as: 'Option',
        dir: 'Long',
        tk: 'ZZZUNKNOWN', // not in spots → 502
        ty: 'CALL',
        st: '50',
        ex: futureExpiry(30),
        ct: '1',
        mu: '100',
        pi: '1',
        pc: '1',
      },
    ];
    const map = await getGreeksForAllPositions(positions);
    expect(map.get('p1').source).toBe('unavailable');
    expect(map.get('p1').delta).toBeNull();
  });

  it('mark = 0 → "unavailable" (spot still recorded for context)', async () => {
    const positions = [
      {
        id: 'p1',
        as: 'Option',
        dir: 'Long',
        tk: 'CVX',
        ty: 'CALL',
        st: '165',
        ex: futureExpiry(45),
        ct: '1',
        mu: '100',
        pi: '0',
        pc: '0',
      },
    ];
    const map = await getGreeksForAllPositions(positions);
    expect(map.get('p1').source).toBe('unavailable');
    expect(map.get('p1').spot).toBe(160);
    expect(map.get('p1').delta).toBeNull();
  });

  it('expiry passée → "unavailable"', async () => {
    const positions = [
      {
        id: 'p1',
        as: 'Option',
        dir: 'Long',
        tk: 'CVX',
        ty: 'CALL',
        st: '165',
        ex: '2020-01-15', // past
        ct: '1',
        mu: '100',
        pi: '3',
        pc: '3.50',
      },
    ];
    const map = await getGreeksForAllPositions(positions);
    expect(map.get('p1').source).toBe('unavailable');
  });

  it('stock positions filtered out (not in Map)', async () => {
    const positions = [
      {
        id: 'p1',
        as: 'Action',
        dir: 'Long',
        tk: 'CVX',
        ty: '',
        st: '',
        ex: '',
        ct: '50',
        mu: '1',
        pc: '160',
      },
    ];
    const map = await getGreeksForAllPositions(positions);
    expect(map.size).toBe(0);
  });

  it('multiple positions same underlying → 1 spot fetch (dedup module-scope)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const positions = [
      {
        id: 'p1',
        as: 'Option',
        dir: 'Long',
        tk: 'CVX',
        ty: 'CALL',
        st: '165',
        ex: futureExpiry(30),
        ct: '1',
        mu: '100',
        pi: '3',
        pc: '3.50',
      },
      {
        id: 'p2',
        as: 'Option',
        dir: 'Long',
        tk: 'CVX',
        ty: 'CALL',
        st: '170',
        ex: futureExpiry(60),
        ct: '1',
        mu: '100',
        pi: '2',
        pc: '2.20',
      },
      {
        id: 'p3',
        as: 'Option',
        dir: 'Long',
        tk: 'CVX',
        ty: 'CALL',
        st: '175',
        ex: futureExpiry(90),
        ct: '1',
        mu: '100',
        pi: '1',
        pc: '1.30',
      },
    ];
    const map = await getGreeksForAllPositions(positions);
    expect(map.size).toBe(3);
    // Each one computed (CVX spot 160 known).
    for (const id of ['p1', 'p2', 'p3']) {
      expect(map.get(id).source).toBe('computed');
    }
    // Exactly 1 network call for CVX (not 3).
    const cvxCalls = fetchSpy.mock.calls.filter((c) =>
      String(c[0]).includes('/api/quote/CVX')
    );
    expect(cvxCalls.length).toBe(1);
  });

  it('empty / null positions → empty Map (no throw)', async () => {
    expect((await getGreeksForAllPositions([])).size).toBe(0);
    expect((await getGreeksForAllPositions(null)).size).toBe(0);
    expect((await getGreeksForAllPositions(undefined)).size).toBe(0);
  });
});
