// ═══════════════════════════════════════════════════════════════
//  computeSortino — A2a golden master.
//
//  Mirror of computeSharpe : { returns, yearsActive, capitalRef } gate,
//  N_TOTAL divisor, NO CLAMP.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { computeSortino } from '../computeSortino';

describe('computeSortino — gated, returns-based, N_total (A2a)', () => {
  it('small-sample (n=10) → null', () => {
    const result = computeSortino({
      returns: [0.005, -0.003, 0.01, 0.008, -0.007, 0.004, -0.002, 0.015, 0.006, -0.004],
      yearsActive: 0.05,
      capitalRef: 1917,
    });
    expect(result).toBeNull();
  });

  it('all-positive returns (no downside) → null (dStd=0)', () => {
    const result = computeSortino({
      returns: Array.from({ length: 40 }, () => 0.01),
      yearsActive: 1,
      capitalRef: 2000,
    });
    expect(result).toBeNull();
  });

  it('passes gate, mixed returns → finite, not clamped', () => {
    const result = computeSortino({
      returns: Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? -0.005 : 0.01)),
      yearsActive: 1,
      capitalRef: 2000,
    });
    expect(result).not.toBeNull();
    expect(typeof result).toBe('number');
    expect(Number.isFinite(result)).toBe(true);
  });

  it('extreme mean / tiny downside — value not clamped', () => {
    // 30 large positives + 1 tiny dip ; old code clamped to +10.
    const fixture = {
      returns: [...Array.from({ length: 30 }, () => 1.0), -0.0001],
      yearsActive: 1,
      capitalRef: 2000,
    };
    const result = computeSortino(fixture);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(10); // clamp removed
  });

  it('gate fails (capitalRef<500) → null', () => {
    expect(
      computeSortino({
        returns: Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? -0.005 : 0.01)),
        yearsActive: 1,
        capitalRef: 100,
      })
    ).toBeNull();
  });

  it('non-finite return → null', () => {
    expect(
      computeSortino({
        returns: [...Array.from({ length: 40 }, () => 0.01), NaN],
        yearsActive: 1,
        capitalRef: 2000,
      })
    ).toBeNull();
  });
});
