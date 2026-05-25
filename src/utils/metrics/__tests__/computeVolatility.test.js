// ═══════════════════════════════════════════════════════════════
//  computeVolatility — A2a new primitive tests.
//
//  std(returns) × sqrt(min(252, n/years)) × 100. Same gate as
//  Sharpe/Sortino. Replaces the legacy vol30dAnnualized (per-trade-
//  treated-as-daily + initialCapital denominator).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { computeVolatility } from '../computeVolatility';

describe('computeVolatility — gated, returns-based (A2a)', () => {
  it('small-sample (n=10, years=0.05) → null', () => {
    const result = computeVolatility({
      returns: [0.005, -0.003, 0.01, 0.008, -0.007, 0.004, -0.002, 0.015, 0.006, -0.004],
      yearsActive: 0.05,
      capitalRef: 1917,
    });
    expect(result).toBeNull();
  });

  it('passes gate (n=40, years=1, capital=2000) → finite, positive %', () => {
    const result = computeVolatility({
      returns: Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 0.01 : -0.005)),
      yearsActive: 1,
      capitalRef: 2000,
    });
    expect(result).not.toBeNull();
    expect(typeof result).toBe('number');
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  it('all-identical returns at an exactly-representable value → 0 (no variance)', () => {
    // 0.5 is exact in IEEE-754 ; variance is mathematically AND numerically
    // zero. (0.01 would drift to ~3e-15 due to float arithmetic.)
    const result = computeVolatility({
      returns: Array.from({ length: 40 }, () => 0.5),
      yearsActive: 1,
      capitalRef: 2000,
    });
    expect(result).toBe(0);
  });

  it('gate fails on small capital → null', () => {
    expect(
      computeVolatility({
        returns: Array.from({ length: 40 }, (_, i) => (i % 2 ? 0.01 : -0.005)),
        yearsActive: 1,
        capitalRef: 100,
      })
    ).toBeNull();
  });

  it('gate fails on short window → null', () => {
    expect(
      computeVolatility({
        returns: Array.from({ length: 40 }, (_, i) => (i % 2 ? 0.01 : -0.005)),
        yearsActive: 0.1,
        capitalRef: 2000,
      })
    ).toBeNull();
  });

  it('non-array returns → null (via gate obs=0)', () => {
    expect(
      computeVolatility({ returns: null, yearsActive: 1, capitalRef: 2000 })
    ).toBeNull();
  });

  it('non-finite return → null', () => {
    expect(
      computeVolatility({
        returns: [...Array.from({ length: 40 }, () => 0.01), NaN],
        yearsActive: 1,
        capitalRef: 2000,
      })
    ).toBeNull();
  });
});
