// ═══════════════════════════════════════════════════════════════
//  computeSharpe — A2a golden master.
//
//  New signature : { returns (fractional), yearsActive, capitalRef }.
//  Annualisation : sqrt(min(252, n/years)). NO CLAMP. Gate refuses
//  to emit a value below MIN_OBS_RATIO (30) / MIN_YEARS_ANNUALIZED
//  (0.25) / MIN_CAPITAL_REF_USD (500).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { computeSharpe } from '../computeSharpe';

// Build a returns array that passes the gate (n=40, years=1, capital=2000).
const GATED_OK_FIXTURE = {
  returns: Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 0.01 : -0.005) + (i * 0.0003)),
  yearsActive: 1,
  capitalRef: 2000,
};

describe('computeSharpe — gated, returns-based (A2a)', () => {
  it('small-sample (n=10) → null (gate fails on obs)', () => {
    const result = computeSharpe({
      returns: [0.005, -0.003, 0.01, 0.008, -0.007, 0.004, -0.002, 0.015, 0.006, -0.004],
      yearsActive: 0.05,
      capitalRef: 1917,
    });
    expect(result).toBeNull();
  });

  it('passes gate → finite, NOT clamped to [-5, +10]', () => {
    const result = computeSharpe(GATED_OK_FIXTURE);
    expect(result).not.toBeNull();
    expect(typeof result).toBe('number');
    expect(Number.isFinite(result)).toBe(true);
  });

  it('extreme positive mean / tiny stddev — value not clamped', () => {
    // 30 obs, all near +1 with one tiny dip. The OLD code would clamp
    // Sharpe to +10 ; A2a returns the raw (very large) value.
    const fixture = {
      returns: Array.from({ length: 30 }, (_, i) => (i === 0 ? 0.999 : 1.0)),
      yearsActive: 1,
      capitalRef: 2000,
    };
    const result = computeSharpe(fixture);
    expect(result).not.toBeNull();
    // No clamp — value is large. Just verify it's > 10 (above the old cap).
    expect(result).toBeGreaterThan(10);
  });

  it('gate fails on capitalRef<500 → null', () => {
    const result = computeSharpe({
      returns: Array.from({ length: 40 }, (_, i) => (i % 2 ? 0.01 : -0.005)),
      yearsActive: 1,
      capitalRef: 100,
    });
    expect(result).toBeNull();
  });

  it('gate fails on years<0.25 → null', () => {
    const result = computeSharpe({
      returns: Array.from({ length: 50 }, (_, i) => (i % 2 ? 0.01 : -0.005)),
      yearsActive: 0.1,
      capitalRef: 2000,
    });
    expect(result).toBeNull();
  });

  it('stddev=0 (all-identical returns at an exactly-representable value) → null', () => {
    // 0.5 is exact in IEEE-754 ; the variance is therefore mathematically
    // AND numerically zero. (Avoid 0.01 — its float drift produces a
    // tiny non-zero stddev that yields an astronomical Sharpe.)
    const result = computeSharpe({
      returns: Array.from({ length: 40 }, () => 0.5),
      yearsActive: 1,
      capitalRef: 2000,
    });
    expect(result).toBeNull();
  });

  it('non-array returns → null', () => {
    expect(computeSharpe({ returns: null, yearsActive: 1, capitalRef: 2000 })).toBeNull();
  });

  it('non-finite return → null', () => {
    const result = computeSharpe({
      returns: [...Array.from({ length: 40 }, () => 0.01), NaN],
      yearsActive: 1,
      capitalRef: 2000,
    });
    expect(result).toBeNull();
  });
});
