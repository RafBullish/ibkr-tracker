// ═══════════════════════════════════════════════════════════════
//  buildEquitySeries — A2a foundation tests.
//
//  Verifies : capitalRef floor, fractional returns shape, USD maxDD
//  unchanged, maxDDPct on REAL equity bounded [0, 100], null sentinel
//  when no usable equity sample.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { buildEquitySeries } from '../equitySeries';
import { MIN_CAPITAL_REF_USD } from '../../significance';

const PNLS = [12, -8, 25, 18, -15, 9, -6, 32, 14, -10];

describe('buildEquitySeries — capitalRef floor', () => {
  it('initialCapital ≥ MIN → capitalRef = initialCapital', () => {
    const r = buildEquitySeries({ initialCapital: 2000, pnls: PNLS });
    expect(r.capitalRef).toBe(2000);
  });

  it('initialCapital < MIN → capitalRef = MIN (500)', () => {
    const r = buildEquitySeries({ initialCapital: 20, pnls: PNLS });
    expect(r.capitalRef).toBe(MIN_CAPITAL_REF_USD);
    expect(r.capitalRef).toBe(500);
  });

  it('initialCapital=0 → capitalRef = MIN, hasKnownInitial=false', () => {
    const r = buildEquitySeries({ initialCapital: 0, pnls: PNLS });
    expect(r.capitalRef).toBe(500);
    expect(r.hasKnownInitial).toBe(false);
  });

  it('non-finite initialCapital → capitalRef = MIN (safeNum guard, no NaN)', () => {
    const r = buildEquitySeries({ initialCapital: NaN, pnls: PNLS });
    expect(r.capitalRef).toBe(500);
    expect(Number.isFinite(r.capitalRef)).toBe(true);
    expect(r.hasKnownInitial).toBe(false);
  });

  it('initialCapital=null → capitalRef = MIN, hasKnownInitial=false', () => {
    const r = buildEquitySeries({ initialCapital: null, pnls: PNLS });
    expect(r.capitalRef).toBe(500);
    expect(Number.isFinite(r.capitalRef)).toBe(true);
    expect(r.hasKnownInitial).toBe(false);
  });

  it('initialCapital=undefined → capitalRef = MIN, hasKnownInitial=false', () => {
    const r = buildEquitySeries({ initialCapital: undefined, pnls: PNLS });
    expect(r.capitalRef).toBe(500);
    expect(Number.isFinite(r.capitalRef)).toBe(true);
    expect(r.hasKnownInitial).toBe(false);
  });
});

describe('buildEquitySeries — equity and returns shapes', () => {
  it('equity[0] = initialCapital, length = n+1', () => {
    const r = buildEquitySeries({ initialCapital: 2000, pnls: PNLS });
    expect(r.equity).toHaveLength(PNLS.length + 1);
    expect(r.equity[0]).toBe(2000);
    expect(r.equity[r.equity.length - 1]).toBe(2071); // 2000 + Σ pnls = 71
  });

  it('returns has same length as pnls', () => {
    const r = buildEquitySeries({ initialCapital: 2000, pnls: PNLS });
    expect(r.returns).toHaveLength(PNLS.length);
  });

  it('returns[0] = pnl[0] / max(capitalRef, equity_0)', () => {
    const r = buildEquitySeries({ initialCapital: 2000, pnls: PNLS });
    // equity_0 = 2000, capitalRef = 2000, denom = 2000
    // returns[0] = 12 / 2000 = 0.006
    expect(r.returns[0]).toBeCloseTo(0.006, 5);
  });

  it('returns are dampened by capitalRef floor at small init', () => {
    // init=20, capitalRef=500 → returns[0] = 12/500 = 0.024
    // (vs 12/20 = 0.6 if we used real equity — that's the per-trade
    // noise problem the floor solves).
    const r = buildEquitySeries({ initialCapital: 20, pnls: PNLS });
    expect(r.returns[0]).toBeCloseTo(0.024, 5);
  });
});

describe('buildEquitySeries — maxDD (USD) and maxDDPct', () => {
  it('A1 pnls + init=2000 → maxDD=15 USD, peak=81', () => {
    const r = buildEquitySeries({ initialCapital: 2000, pnls: PNLS });
    expect(r.maxDD).toBe(15);
  });

  it('maxDDPct computed on REAL peak equity, bounded [0,100]', () => {
    // peak equity = init + 81 = 2081 ; maxDD = 15 ; maxDDPct = 15/2081*100 ≈ 0.72
    const r = buildEquitySeries({ initialCapital: 2000, pnls: PNLS });
    expect(r.maxDDPct).not.toBeNull();
    expect(r.maxDDPct).toBeCloseTo(0.72, 1);
    expect(r.maxDDPct).toBeGreaterThanOrEqual(0);
    expect(r.maxDDPct).toBeLessThanOrEqual(100);
  });

  it('maxDDPct bounded to 100 % even with extreme losses on tiny capital', () => {
    // init=10, losses much larger than initial. Real equity goes deeply
    // negative ; the per-step ddPct is clipped to 100.
    const r = buildEquitySeries({ initialCapital: 10, pnls: [-500, -500, -500] });
    expect(r.maxDDPct).toBeLessThanOrEqual(100);
  });

  it('empty pnls → maxDDPct=null (no sample)', () => {
    const r = buildEquitySeries({ initialCapital: 2000, pnls: [] });
    expect(r.maxDDPct).toBeNull();
    expect(r.maxDD).toBe(0);
  });

  it('all-positive pnls → maxDD=0 and maxDDPct=0', () => {
    const r = buildEquitySeries({ initialCapital: 2000, pnls: [5, 10, 15] });
    expect(r.maxDD).toBe(0);
    expect(r.maxDDPct).toBe(0);
  });

  it('A2.1 — initialCapital unknown (null) → maxDDPct=null (cannot anchor %)', () => {
    // Even with a real drawdown in cumPnL, we refuse to emit a %
    // because the equity base is unknown. Was -100 % in production
    // when the Flex CSV had no Cash Transactions section.
    const r = buildEquitySeries({ initialCapital: null, pnls: PNLS });
    expect(r.maxDD).toBe(15); // USD magnitude still accurate
    expect(r.maxDDPct).toBeNull();
  });

  it('A2.1 — initialCapital unknown + heavy drawdown → maxDDPct still null (no -100 %)', () => {
    const r = buildEquitySeries({
      initialCapital: undefined,
      pnls: [100, 200, -250, -50], // peakCum=300, trough cum=0, would be 100 % on cumPnL base
    });
    expect(r.maxDDPct).toBeNull();
  });
});

describe('buildEquitySeries — robustness', () => {
  it('non-array pnls → empty series', () => {
    const r = buildEquitySeries({ initialCapital: 2000, pnls: null });
    expect(r.returns).toEqual([]);
    expect(r.equity).toEqual([2000]);
  });

  it('non-finite pnl is skipped (no NaN bleed)', () => {
    const r = buildEquitySeries({ initialCapital: 2000, pnls: [10, NaN, 5] });
    expect(r.returns).toHaveLength(2);
    expect(r.returns.every((v) => Number.isFinite(v))).toBe(true);
  });
});
