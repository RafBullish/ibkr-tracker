// ═══════════════════════════════════════════════════════════════
//  getGreeksForAllPositions — local Black-Scholes pipeline (B2)
//
//  Mocks /api/quote/[ticker] via vi.stubGlobal('fetch'). Verifies
//  the Map shape, source flags, and the cascade σ (a)→(b)→(c) :
//
//    source: 'mark'        IV inversée depuis le mark CSV
//    source: 'chain'       IV depuis cache localStorage qc:chainIv
//    source: 'default'     fallback σ=0.30 + ivEstimated:true
//    source: 'unavailable' spot KO (réseau down) ou contrat invalide
//
//  Le mark=0 ou mark<intrinsic ne fail plus — il tombe sur (c). Seul
//  cas 'unavailable' restant : spot manquant (502 /api/quote) ou
//  expiry passée / strike absent.
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
  it('option position with valid spot + mark → source "mark", greeks finite', async () => {
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
    expect(g.source).toBe('mark');
    expect(g.ivEstimated).toBe(false);
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

  it('mark = 0 → fallback (c) σ=0.30, source "default", ivEstimated:true', async () => {
    // Nouveau contrat cascade : mark=0 = (a) KO → (b) pas de cache → (c) σ=0.30.
    // Plus de bleed 'unavailable' silencieux ; UI marque "~" via ivEstimated.
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
    const g = map.get('p1');
    expect(g.source).toBe('default');
    expect(g.ivEstimated).toBe(true);
    expect(g.spot).toBe(160);
    expect(g.sigma).toBeCloseTo(0.3, 5);
    expect(Number.isFinite(g.delta)).toBe(true);
    expect(Number.isFinite(g.theta)).toBe(true);
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
    // Each one computed via cascade (a) IV inversion from mark (CVX spot 160 known).
    for (const id of ['p1', 'p2', 'p3']) {
      expect(map.get(id).source).toBe('mark');
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

  it('B2C — 0 open option positions → empty Map AND zero network calls', async () => {
    // Le compte fraichement importé du user U23437309 a 15 closed trades
    // mais 0 open position. Le pipeline doit produire une Map vide sans
    // crasher ET sans déclencher de fetch /api/quote inutile.
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockClear();
    const map = await getGreeksForAllPositions([]);
    expect(map.size).toBe(0);
    // Zero spot fetch (no underlyings to resolve).
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('B2C — only stock positions (no options) → empty Map, no spot fetch', async () => {
    // Stocks sont filtrés en amont (filter p.as === 'Option'). Pas de
    // calcul Greeks à faire, donc pas de spot à récupérer.
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockClear();
    const positions = [
      {
        id: 'stk1',
        as: 'Action',
        dir: 'Long',
        tk: 'CVX',
        ty: '',
        st: '',
        ex: '',
        ct: '100',
        mu: '1',
        pc: '160',
      },
    ];
    const map = await getGreeksForAllPositions(positions);
    expect(map.size).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
