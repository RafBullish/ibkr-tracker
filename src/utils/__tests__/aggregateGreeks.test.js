// ═══════════════════════════════════════════════════════════════
//  aggregateGreeks — golden master (A1.5)
//
//  Locks the sign semantics for both directions. The brief said it
//  best : "Mon book réel est long-only → ma theta agrégée doit être
//  négative." These four tests verrouillent that contract — any
//  future regression that ignores `pos.dir` will surface here.
//
//  Unit conventions verified :
//    - theta is BSM per-share / per-YEAR ; aggregate divides by 365
//      to emit USD per-day.
//    - vega is BSM per-share / per 1.00 sigma ; aggregate divides
//      by 100 to emit USD per 1 %-IV change.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { aggregateGreeks } from '../greeks';

const LONG_CALL = {
  id: 'lc',
  as: 'Option',
  dir: 'Long',
  ct: '1',
  mu: '100',
  tk: 'AAPL',
  ty: 'CALL',
};
const SHORT_CALL = {
  id: 'sc',
  as: 'Option',
  dir: 'Short',
  ct: '1',
  mu: '100',
  tk: 'TSLA',
  ty: 'CALL',
};
const LONG_STOCK = {
  id: 'ls',
  as: 'Action',
  dir: 'Long',
  ct: '50',
  mu: '1',
  pc: '25',
  tk: 'AAPL',
};

// BSM-style snapshot : theta per share per YEAR (negative for option
// holder), vega per share per 1.00 sigma.
const CALL_GREEKS = {
  delta: 0.35,
  gamma: 0.02,
  theta: -45,
  vega: 12.5,
  spot: 100,
};

describe('aggregateGreeks — sign semantics', () => {
  it('LONG call → thetaDaily < 0 AND vegaPer1Pct > 0 (buyer reality)', () => {
    const map = new Map([[LONG_CALL.id, CALL_GREEKS]]);
    const r = aggregateGreeks([LONG_CALL], map);
    expect(r.thetaDaily).toBeLessThan(0); // pays the decay
    expect(r.vegaPer1Pct).toBeGreaterThan(0); // long vol
    expect(r.sumDelta).toBeCloseTo(35, 1); // 0.35 × 1 × 100
    expect(r.optionsCount).toBe(1);
  });

  it('SHORT call → thetaDaily > 0 AND vegaPer1Pct < 0 (sign-aware)', () => {
    const map = new Map([[SHORT_CALL.id, CALL_GREEKS]]);
    const r = aggregateGreeks([SHORT_CALL], map);
    expect(r.thetaDaily).toBeGreaterThan(0); // encaisse le decay
    expect(r.vegaPer1Pct).toBeLessThan(0); // short vol
    expect(r.sumDelta).toBeCloseTo(-35, 1); // sign-flipped
    expect(r.optionsCount).toBe(1);
  });

  it('LONG stock 50 sh → sumDelta=+50, zero contribution to other greeks', () => {
    const r = aggregateGreeks([LONG_STOCK], new Map());
    expect(r.sumDelta).toBe(50);
    expect(r.sumGamma).toBe(0);
    expect(r.thetaDaily).toBe(0);
    expect(r.vegaPer1Pct).toBe(0);
    expect(r.optionsCount).toBe(0); // stock doesn't bump optionsCount
  });

  it("position with g.source='unavailable' → skipped cleanly (no NaN)", () => {
    const map = new Map([[LONG_CALL.id, { source: 'unavailable', delta: null }]]);
    const r = aggregateGreeks([LONG_CALL], map);
    expect(r.sumDelta).toBe(0);
    expect(r.sumGamma).toBe(0);
    expect(r.thetaDaily).toBe(0);
    expect(r.vegaPer1Pct).toBe(0);
    expect(r.optionsCount).toBe(0);
    expect(Number.isNaN(r.sumDelta)).toBe(false);
    expect(Number.isNaN(r.thetaDaily)).toBe(false);
    // Position is still listed in the table-friendly array, with null fields.
    expect(r.positions).toHaveLength(1);
    expect(r.positions[0].delta).toBeNull();
    expect(r.positions[0].theta).toBeNull();
  });
});

describe('aggregateGreeks — A3c runtime regression guards', () => {
  it('all positions unavailable (api down) → zero aggregates, no NaN', () => {
    // Models the runtime case observed Brick A3c : /api/cboe 403 →
    // every position lands `source: 'unavailable'`. Aggregates stay
    // zero, no NaN pollutes downstream tone / display logic.
    const positions = [
      { ...LONG_CALL, id: 'p1' },
      { ...SHORT_CALL, id: 'p2' },
      { ...LONG_CALL, id: 'p3', tk: 'NVDA' },
    ];
    const map = new Map([
      ['p1', { source: 'unavailable', delta: null, gamma: null, theta: null, vega: null }],
      ['p2', { source: 'unavailable', delta: null }],
      ['p3', { source: 'unavailable', delta: null }],
    ]);
    const r = aggregateGreeks(positions, map);
    expect(r.sumDelta).toBe(0);
    expect(r.sumGamma).toBe(0);
    expect(r.thetaDaily).toBe(0);
    expect(r.vegaPer1Pct).toBe(0);
    expect(r.optionsCount).toBe(0);
    // Defence : never let NaN bleed to tone/display.
    expect(Number.isNaN(r.sumDelta)).toBe(false);
    expect(Number.isNaN(r.thetaDaily)).toBe(false);
    expect(r.positions).toHaveLength(3);
    for (const p of r.positions) {
      expect(p.delta).toBeNull();
      expect(p.theta).toBeNull();
    }
  });

  it('mixed book (long call + short call + long stock) → sign-aware aggregate', () => {
    // Verrouille le bug latent fixé en A3c : sur un book mixte,
    // l'ancien aggregat sign-agnostic (Positions.jsx summary, retiré)
    // donnait des signes WRONG pour la short. Le canonique sign-aware
    // doit produire :
    //   - Σ Delta non nul (long call 35 + short call -35 + stock +50 = +50)
    //   - Theta net (long −12.3 + short +12.3 = 0 → mais avec autres greeks)
    const map = new Map([
      [LONG_CALL.id, CALL_GREEKS],
      [SHORT_CALL.id, CALL_GREEKS],
    ]);
    const r = aggregateGreeks([LONG_CALL, SHORT_CALL, LONG_STOCK], map);
    // Long call delta + short call delta = +35 − 35 = 0. Long stock 50 → +50.
    expect(r.sumDelta).toBeCloseTo(50, 1);
    // Long θ + short θ (opposite signs, same magnitude) → net 0.
    expect(Math.abs(r.thetaDaily)).toBeLessThan(0.01);
    // Long ν + short ν (opposite signs) → net 0.
    expect(Math.abs(r.vegaPer1Pct)).toBeLessThan(0.01);
    expect(r.optionsCount).toBe(2);
  });
});

describe('aggregateGreeks — composite books', () => {
  it('Long call + Short call (same greeks) → cancels out', () => {
    const map = new Map([
      [LONG_CALL.id, CALL_GREEKS],
      [SHORT_CALL.id, CALL_GREEKS],
    ]);
    const r = aggregateGreeks([LONG_CALL, SHORT_CALL], map);
    expect(r.sumDelta).toBe(0);
    expect(r.thetaDaily).toBe(0);
    expect(r.vegaPer1Pct).toBe(0);
    expect(r.optionsCount).toBe(2);
  });

  it('Long-only book → thetaDaily strictly negative (book reality check)', () => {
    // Two long calls with non-trivial greeks.
    const second = { ...LONG_CALL, id: 'lc2', tk: 'MSFT' };
    const map = new Map([
      [LONG_CALL.id, CALL_GREEKS],
      [second.id, { ...CALL_GREEKS, theta: -30, vega: 8 }],
    ]);
    const r = aggregateGreeks([LONG_CALL, second], map);
    expect(r.thetaDaily).toBeLessThan(0);
    expect(r.vegaPer1Pct).toBeGreaterThan(0);
  });
});
