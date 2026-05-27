// ═══════════════════════════════════════════════════════════════
//  computeWinRate — golden master (A1.5)
//
//  Current behaviour : winRate = wins / (wins + losses) × 100.
//  Break-even (pnl===0) trades excluded from the denominator.
//  No significance gating on `decisive`.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { computeWinRate } from '../computeWinRate';

const PNLS = [12, -8, 25, 18, -15, 9, -6, 32, 14, -10];

describe('computeWinRate', () => {
  it('A1 fixture (decisive=10 ≥ MIN) → 60 % gated value emitted', () => {
    const r = computeWinRate(PNLS);
    expect(r.winCount).toBe(6);
    expect(r.lossCount).toBe(4);
    expect(r.breakEvenCount).toBe(0);
    expect(r.decisive).toBe(10);
    expect(r.winRate).toBe(60);
    expect(r.lossRate).toBe(40);
  });

  it('A2b — n=1 winning trade → winRate null, raw counts preserved', () => {
    // Display fallback : the consumer shows "1/1" from winCount+decisive
    // instead of painting the donut "100 % profit".
    const r = computeWinRate([42]);
    expect(r.winRate).toBeNull();
    expect(r.lossRate).toBeNull();
    expect(r.winCount).toBe(1);
    expect(r.lossCount).toBe(0);
    expect(r.decisive).toBe(1);
  });

  it('A2b — n=1 losing trade → winRate null, counts preserved', () => {
    const r = computeWinRate([-42]);
    expect(r.winRate).toBeNull();
    expect(r.lossRate).toBeNull();
    expect(r.winCount).toBe(0);
    expect(r.lossCount).toBe(1);
  });

  it('A2b — boundary : decisive EXACTLY 10 → emits the % (inclusive)', () => {
    const r = computeWinRate([1, 1, 1, 1, 1, 1, 1, -1, -1, -1]);
    expect(r.decisive).toBe(10);
    expect(r.winRate).toBe(70);
  });

  it('A2b — decisive=9 → null (one short of threshold)', () => {
    const r = computeWinRate([1, 1, 1, 1, 1, 1, 1, -1, -1]);
    expect(r.decisive).toBe(9);
    expect(r.winRate).toBeNull();
  });

  it('all break-even → winRate=null, decisive=0', () => {
    const r = computeWinRate([0, 0, 0]);
    expect(r.winRate).toBeNull();
    expect(r.lossRate).toBeNull();
    expect(r.decisive).toBe(0);
    expect(r.breakEvenCount).toBe(3);
  });

  it('empty array → all zeros except winRate/lossRate=null', () => {
    const r = computeWinRate([]);
    expect(r).toEqual({
      winRate: null,
      lossRate: null,
      winCount: 0,
      lossCount: 0,
      breakEvenCount: 0,
      decisive: 0,
    });
  });

  it('non-array input → safe defaults', () => {
    expect(computeWinRate(null).winRate).toBeNull();
    expect(computeWinRate(undefined).decisive).toBe(0);
  });

  it('non-finite pnls are skipped', () => {
    const r = computeWinRate([10, NaN, -5, Infinity, 0]);
    expect(r.winCount).toBe(1);
    expect(r.lossCount).toBe(1);
    expect(r.breakEvenCount).toBe(1);
  });
});
