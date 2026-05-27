// ═══════════════════════════════════════════════════════════════
//  computeCalmar — A2b (gated by yearsActive ≥ 1).
//
//  Calmar = annualised CAGR / |Max Drawdown %|. Since A2.2 the CAGR
//  primitive may return a CUMULATIVE value when 0 < years < 1 — feeding
//  that into a Calmar ratio breaks comparability with the annualised
//  bench (3.0). A2b therefore refuses to emit a Calmar under 1 year.
//
//  Sharpe / Sortino / Vol are NOT subject to this gate : they
//  annualise the dispersion of returns rather than a compound rate.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { computeCalmar } from '../computeCalmar';

describe('computeCalmar — A2b yearsActive gate', () => {
  it('years ≥ 1 + valid inputs → finite ratio', () => {
    const result = computeCalmar({
      cagrPct: 12.0,
      maxDrawdownPct: 4.0,
      yearsActive: 1.5,
    });
    expect(result).toBeCloseTo(3.0, 5);
  });

  it('years EXACTLY 1.0 → finite (inclusive boundary)', () => {
    const result = computeCalmar({
      cagrPct: 10,
      maxDrawdownPct: 5,
      yearsActive: 1,
    });
    expect(result).toBeCloseTo(2.0, 5);
  });

  it('years = 0.4 (cumulative regime) → null (Calmar requires annualised CAGR)', () => {
    // Tracker_TEST-2 case after A2.2 : CAGR cumulative = 118 % at 0.4 y.
    // 118/5=23.6 would mislead next to bench 3 → emit null instead.
    expect(
      computeCalmar({ cagrPct: 118, maxDrawdownPct: 5, yearsActive: 0.4 })
    ).toBeNull();
  });

  it('years missing → null', () => {
    expect(computeCalmar({ cagrPct: 10, maxDrawdownPct: 5 })).toBeNull();
  });

  it('years non-finite → null', () => {
    expect(
      computeCalmar({ cagrPct: 10, maxDrawdownPct: 5, yearsActive: NaN })
    ).toBeNull();
  });

  it('cagrPct=null → null (cascade)', () => {
    expect(
      computeCalmar({ cagrPct: null, maxDrawdownPct: 5, yearsActive: 2 })
    ).toBeNull();
  });

  it('maxDrawdownPct=null → null', () => {
    expect(
      computeCalmar({ cagrPct: 10, maxDrawdownPct: null, yearsActive: 2 })
    ).toBeNull();
  });

  it('maxDrawdownPct=0 → null (undefined ratio)', () => {
    expect(
      computeCalmar({ cagrPct: 50, maxDrawdownPct: 0, yearsActive: 2 })
    ).toBeNull();
  });

  it('maxDrawdownPct negative → null', () => {
    expect(
      computeCalmar({ cagrPct: 50, maxDrawdownPct: -3, yearsActive: 2 })
    ).toBeNull();
  });

  it('non-finite cagrPct → null', () => {
    expect(
      computeCalmar({ cagrPct: Infinity, maxDrawdownPct: 5, yearsActive: 2 })
    ).toBeNull();
    expect(
      computeCalmar({ cagrPct: NaN, maxDrawdownPct: 5, yearsActive: 2 })
    ).toBeNull();
  });
});
