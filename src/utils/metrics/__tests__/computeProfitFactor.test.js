// ═══════════════════════════════════════════════════════════════
//  computeProfitFactor — golden master (A1.5)
//
//  Current behaviour : grossProfit / grossLoss. Returns Infinity
//  when grossLoss=0 and grossProfit>0 (perfect run). Returns 0 when
//  both sides are zero. No significance gating on lossCount.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { computeProfitFactor } from '../computeProfitFactor';

const PNLS = [12, -8, 25, 18, -15, 9, -6, 32, 14, -10];

describe('computeProfitFactor', () => {
  it('A1 fixture (4 losses ≥ MIN_LOSSES_PF) → PF ≈ 2.82', () => {
    const r = computeProfitFactor(PNLS);
    expect(r.grossProfit).toBe(110);
    expect(r.grossLoss).toBe(39);
    expect(r.lossCount).toBe(4);
    expect(r.profitFactor).toBeCloseTo(2.8205, 3);
  });

  it('A2b — no losses, has gains → null (was Infinity)', () => {
    // Storage layer never emits Infinity now : the display layer decides
    // between "∞" and "—" using its own preference.
    const r = computeProfitFactor([5, 10, 20]);
    expect(r.profitFactor).toBeNull();
    expect(r.grossLoss).toBe(0);
    expect(r.lossCount).toBe(0);
  });

  it('A2b — lossCount < MIN_LOSSES_PF (3) → null', () => {
    const r = computeProfitFactor([10, 20, -5, 30, -8]);
    expect(r.lossCount).toBe(2);
    expect(r.profitFactor).toBeNull();
  });

  it('A2b — lossCount EXACTLY 3 → finite ratio (inclusive boundary)', () => {
    const r = computeProfitFactor([10, 20, -5, 30, -8, -3]);
    expect(r.lossCount).toBe(3);
    expect(r.profitFactor).toBeCloseTo(60 / 16, 3);
  });

  it('only losses + lossCount ≥ 3 → PF=0 (legitimate zero ratio)', () => {
    // Math : 0 grossProfit / 18 grossLoss = 0. The gate (lossCount<3)
    // doesn't trip, so the real value is emitted. Display layer paints
    // tone "loss" — meaningful for a purely losing run.
    const r = computeProfitFactor([-5, -10, -3]);
    expect(r.profitFactor).toBe(0);
    expect(r.grossProfit).toBe(0);
    expect(r.grossLoss).toBe(18);
  });

  it('all break-even (zeros) → null (no losses)', () => {
    const r = computeProfitFactor([0, 0, 0]);
    expect(r.profitFactor).toBeNull();
  });

  it('empty array → null', () => {
    const r = computeProfitFactor([]);
    expect(r.profitFactor).toBeNull();
    expect(r.grossProfit).toBe(0);
    expect(r.grossLoss).toBe(0);
  });

  it('non-array input → null', () => {
    const r = computeProfitFactor(null);
    expect(r.profitFactor).toBeNull();
  });

  it('non-finite pnls are skipped', () => {
    const r = computeProfitFactor([10, NaN, -5, Infinity, 3, -2, -1]);
    expect(r.grossProfit).toBe(13);
    expect(r.grossLoss).toBe(8);
    expect(r.lossCount).toBe(3);
    expect(r.profitFactor).toBeCloseTo(13 / 8, 3);
  });
});
