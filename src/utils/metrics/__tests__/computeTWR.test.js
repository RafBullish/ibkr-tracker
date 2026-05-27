// ═══════════════════════════════════════════════════════════════
//  computeTWR — A3b tests.
//
//  Verifies that the TWR chain neutralises the timing of cash flows :
//  identical cumulative dollar profit yields different TWR depending on
//  WHEN the deposits arrived.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { computeTWR } from '../computeTWR';

function point(date, cumPnL, capitalDeployedToDate) {
  return { date, cumPnL, capitalDeployedToDate };
}

describe('computeTWR — chain on sub-periods (A3b)', () => {
  it('single deposit + 20 % year → TWR ≈ 20 % annualised', () => {
    const flows = [{ date: '2025-01-01', netUsd: 10000 }];
    const points = [
      point('2025-06-30', 1000, 10000),
      point('2025-12-31', 2000, 10000),
    ];
    const r = computeTWR({
      points,
      flows,
      yearsActive: 1,
      tradesCount: 40,
      initialCapital: 10000,
    });
    expect(r.value).toBeCloseTo(20, 1);
    expect(r.mode).toBe('annualised');
    expect(r.subPeriods).toBe(1);
  });

  it('STAGGERED deposits : TWR ≠ naive cumulative', () => {
    // t0 : $10000 deposit. At t=6 mo, $1000 PnL → MV=$11000.
    // t6 : $10000 second deposit lands. MV jumps to $21000 (no rendement).
    // t12 : +$1000 PnL → MV=$22000.
    // Naive : total PnL $2000 / init $10000 = 20 %.
    // TWR :   r1 = 11000/10000 − 1 = 10 %
    //         r2 = 22000/21000 − 1 ≈ 4.76 %
    //         TWR = (1.10 × 1.0476) − 1 ≈ 15.24 %
    const flows = [
      { date: '2025-01-01', netUsd: 10000 },
      { date: '2025-07-01', netUsd: 10000 },
    ];
    const points = [
      point('2025-06-30', 1000, 10000),
      point('2025-07-01', 1000, 20000),
      point('2025-12-31', 2000, 20000),
    ];
    const r = computeTWR({
      points,
      flows,
      yearsActive: 1,
      tradesCount: 40,
      initialCapital: 10000,
    });
    expect(r.subPeriods).toBe(2);
    // 1.10 × (22000/21000) − 1 = 0.15238 → 15.24 % at years=1.
    expect(r.value).toBeCloseTo(15.24, 1);
    // NOT the naive 20 % — the late deposit doesn't count as performance.
    expect(r.value).not.toBeCloseTo(20, 1);
  });

  it('under 1 year (years=0.4) + gate OK → cumulative label', () => {
    const flows = [{ date: '2025-01-01', netUsd: 10000 }];
    const points = [
      point('2025-04-01', 500, 10000),
      point('2025-06-01', 1000, 10000),
    ];
    const r = computeTWR({
      points,
      flows,
      yearsActive: 0.4,
      tradesCount: 25,
      initialCapital: 10000,
    });
    expect(r.mode).toBe('cumulative');
    // (11000/10000 − 1) × 100 = 10 %
    expect(r.value).toBeCloseTo(10, 1);
  });

  it('trades < 20 → null (gate)', () => {
    const flows = [{ date: '2025-01-01', netUsd: 10000 }];
    const points = [point('2025-06-30', 1000, 10000)];
    const r = computeTWR({
      points,
      flows,
      yearsActive: 1,
      tradesCount: 10,
      initialCapital: 10000,
    });
    expect(r.value).toBeNull();
  });

  it('initialCapital unknown + no flows → null (no anchor)', () => {
    const points = [point('2025-06-30', 100, 0)];
    const r = computeTWR({
      points,
      flows: [],
      yearsActive: 1,
      tradesCount: 40,
      initialCapital: null,
    });
    expect(r.value).toBeNull();
  });

  it('empty points → null', () => {
    const r = computeTWR({
      points: [],
      flows: [{ date: '2025-01-01', netUsd: 10000 }],
      yearsActive: 1,
      tradesCount: 40,
      initialCapital: 10000,
    });
    expect(r.value).toBeNull();
  });

  it('totalRaw exposed alongside annualised value (for debug)', () => {
    const flows = [{ date: '2025-01-01', netUsd: 10000 }];
    const points = [
      point('2025-12-31', 2000, 10000),
    ];
    const r = computeTWR({
      points,
      flows,
      yearsActive: 2,
      tradesCount: 40,
      initialCapital: 10000,
    });
    // Raw (non-annualised) TWR = (12000/10000 − 1) × 100 = 20 %.
    // Annualised over 2 years : (1.20)^0.5 − 1 ≈ 9.54 %.
    expect(r.totalRaw).toBeCloseTo(20, 1);
    expect(r.value).toBeCloseTo(9.54, 1);
  });
});
