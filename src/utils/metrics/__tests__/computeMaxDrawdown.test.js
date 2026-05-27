// ═══════════════════════════════════════════════════════════════
//  computeMaxDrawdown — golden master (A1.5)
//
//  Current behaviour : running-peak on cumulative P&L (in USD).
//  Peak starts at 0 (not initialCapital). Output : { maxDD, peak, cum }.
//  maxDD is a magnitude (≥ 0).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { computeMaxDrawdown } from '../computeMaxDrawdown';

const PNLS = [12, -8, 25, 18, -15, 9, -6, 32, 14, -10];

describe('computeMaxDrawdown', () => {
  it('A1 fixture → maxDD=15, peak=81, cum=71 (USD only)', () => {
    const r = computeMaxDrawdown(PNLS);
    // A2a resolved : the % derivation (on REAL peak equity, bounded
    // [0,100]) now lives in src/utils/metrics/equitySeries.js. This
    // primitive remains USD-only and unchanged.
    expect(r.maxDD).toBe(15);
    expect(r.peak).toBe(81);
    expect(r.cum).toBe(71);
  });

  it('all-positive series → maxDD=0', () => {
    const r = computeMaxDrawdown([5, 10, 15, 20]);
    expect(r.maxDD).toBe(0);
    expect(r.peak).toBe(50);
    expect(r.cum).toBe(50);
  });

  it('all-negative series → maxDD=|sum|, peak=0', () => {
    const r = computeMaxDrawdown([-5, -10, -3]);
    expect(r.maxDD).toBe(18);
    expect(r.peak).toBe(0);
    expect(r.cum).toBe(-18);
  });

  it('empty array → all zeros', () => {
    const r = computeMaxDrawdown([]);
    expect(r).toEqual({ maxDD: 0, peak: 0, cum: 0 });
  });

  it('non-array → safe defaults', () => {
    const r = computeMaxDrawdown(null);
    expect(r).toEqual({ maxDD: 0, peak: 0, cum: 0 });
  });

  it('non-finite pnls are skipped (no NaN bleed)', () => {
    const r = computeMaxDrawdown([10, NaN, -5, Infinity, 3]);
    // Only 10, -5, 3 are accounted for: cum trail 10, 5, 8; peak=10; maxDD=5.
    expect(r.cum).toBe(8);
    expect(r.peak).toBe(10);
    expect(r.maxDD).toBe(5);
  });
});
