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

describe('aggregateGreeks — B2C 0-position book', () => {
  it('empty openPositions + empty greeksMap → zeros, optionsCount=0, no NaN', () => {
    // Cas runtime confirmé sur le compte U23437309 (15 closed trades,
    // 0 open position). Le cockpit doit afficher "no options" propre,
    // pas un faux 0 tonifié ni un NaN.
    const r = aggregateGreeks([], new Map());
    expect(r.sumDelta).toBe(0);
    expect(r.sumGamma).toBe(0);
    expect(r.thetaDaily).toBe(0);
    expect(r.vegaPer1Pct).toBe(0);
    expect(r.optionsCount).toBe(0);
    expect(r.positions).toEqual([]);
    expect(Number.isNaN(r.sumDelta)).toBe(false);
    expect(Number.isNaN(r.thetaDaily)).toBe(false);
  });

  it('only stock positions → stockDelta only, optionsCount=0', () => {
    // optionsCount=0 pilote les états « no options » des consommateurs
    // (page Greeks, bande CAPITAL) — vérifier que ce signal reste
    // accurate avec QUE des stocks (contribuent à sumDelta seulement).
    // (L'ex-GreeksStrip de RiskMatrix est morte en É3 §4.2.3.)
    const r = aggregateGreeks(
      [
        {
          id: 'stk1',
          as: 'Action',
          dir: 'Long',
          ct: '50',
          mu: '1',
          pc: '160',
          tk: 'CVX',
        },
      ],
      new Map()
    );
    expect(r.sumDelta).toBe(50);
    expect(r.optionsCount).toBe(0); // ← signal « no options » cross-app
    expect(r.thetaDaily).toBe(0);
    expect(r.vegaPer1Pct).toBe(0);
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

// ═══════════════════════════════════════════════════════════════
//  S5 · RECETTE É4-a — TÉMOIN DE PLAUSIBILITÉ DES GRECS
//  Trois garanties demandées par l'architecte :
//   (1) signe correct pour un BOOK LONG : θ < 0, Γ > 0, ν > 0 ;
//   (2) multiplicateur ×100 appliqué UNE SEULE fois (jamais ×100²,
//       jamais oublié) ;
//   (3) somme des positions == agrégat AFFICHÉ (aucune fuite de
//       facteur d'échelle entre le détail par position et l'agrégat).
// ═══════════════════════════════════════════════════════════════
describe('aggregateGreeks — S5 plausibilité (recette É4-a)', () => {
  // Deux options LONG aux grecs choisis pour une arithmétique exacte
  // (θ/365 et ν/100 tombent juste). mul = 100 (contrat standard).
  const A = { id: 'A', as: 'Option', dir: 'Long', ct: '2', mu: '100', tk: 'AAPL', ty: 'CALL' };
  const B = { id: 'B', as: 'Option', dir: 'Long', ct: '1', mu: '100', tk: 'MSFT', ty: 'PUT' };
  const gA = { delta: 0.45, gamma: 0.02, theta: -18.25, vega: 12, spot: 100 }; // θ/365 = -0.05, ν/100 = 0.12
  const gB = { delta: -0.3, gamma: 0.015, theta: -10.95, vega: 8, spot: 100 }; // θ/365 = -0.03, ν/100 = 0.08
  const book = [A, B];
  const map = new Map([['A', gA], ['B', gB]]);

  it('(1) book LONG : θ < 0, Γ > 0, ν > 0 ; delta net dominé par le call', () => {
    const r = aggregateGreeks(book, map);
    expect(r.sumTheta).toBeLessThan(0); // long premium paie la décote
    expect(r.thetaDaily).toBeLessThan(0);
    expect(r.sumGamma).toBeGreaterThan(0); // long gamma
    expect(r.sumVega).toBeGreaterThan(0); // long vol
    expect(r.vegaPer1Pct).toBeGreaterThan(0);
    // Σ Δ = 0.45×2×100 + (−0.30)×1×100 = 90 − 30 = 60 (net long).
    expect(r.sumDelta).toBeCloseTo(60, 2);
  });

  it('(2) ×100 appliqué UNE SEULE fois (ni ×100², ni oublié)', () => {
    const single = { id: 'S', as: 'Option', dir: 'Long', ct: '1', mu: '100', tk: 'X', ty: 'CALL' };
    const r = aggregateGreeks([single], new Map([['S', { delta: 0.5, gamma: 0.02, theta: -36.5, vega: 10, spot: 100 }]]));
    // delta 0.5 × 1 contrat × 100 = 50. PAS 0.5 (mul oublié), PAS 5000 (×100²).
    expect(r.sumDelta).toBeCloseTo(50, 6);
    expect(r.sumDelta).not.toBe(0.5);
    expect(r.sumDelta).not.toBe(5000);
    // θ/jour = (−36.5/365) × 100 = −10. ν/1% = (10/100) × 100 = 10.
    expect(r.thetaDaily).toBeCloseTo(-10, 6);
    expect(r.vegaPer1Pct).toBeCloseTo(10, 6);
    expect(r.sumGamma).toBeCloseTo(2, 6); // 0.02 × 100
  });

  it('(3) somme des positions == agrégat affiché (aucune fuite d’échelle)', () => {
    const r = aggregateGreeks(book, map);
    const MUL = 100;
    // Reconstitue l'agrégat depuis le DÉTAIL par position (valeurs
    // per-share signées × contrats × mul) — doit égaler l'agrégat.
    const recon = (key) =>
      r.positions.reduce((s, p) => s + (p[key] ?? 0) * p.contracts * MUL, 0);
    expect(recon('delta')).toBeCloseTo(r.sumDelta, 2);
    expect(recon('gamma')).toBeCloseTo(r.sumGamma, 2);
    expect(recon('theta')).toBeCloseTo(r.thetaDaily, 2);
    expect(recon('vega')).toBeCloseTo(r.vegaPer1Pct, 2);
    expect(r.optionsCount).toBe(2);
  });
});
