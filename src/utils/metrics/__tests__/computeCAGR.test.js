// ═══════════════════════════════════════════════════════════════
//  computeCAGR — A2a golden master.
//
//  Significance gate enforces null below MIN_YEARS_ANNUALIZED (0.25)
//  OR MIN_TRADES_ANNUALIZED (20) OR MIN_CAPITAL_REF_USD (500). The
//  small-history aberration (~28 888 %) is no longer reachable.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { computeCAGR, cagrMode } from '../computeCAGR';

// A1 fixture — small-history scenario : gate now FAILS (n=10 < 20,
// years≈0.05 < 0.25) so the result is null.
const FX = 0.7825;
const SMALL_INIT = 1500 / FX; // 1916.93 USD
const SMALL_REALIZED = 71;
const SMALL_END = SMALL_INIT + SMALL_REALIZED;
const SMALL_YEARS = 18 / 365.25; // 0.0493
const SMALL_TRADES = 10;

// "Passes gate" fixture — n=40, years=1, init=2000 USD.
const BIG_INIT = 2000;
const BIG_END = 2200; // +200 over the year
const BIG_YEARS = 1;
const BIG_TRADES = 40;

describe('computeCAGR — gated (A2a)', () => {
  it('small-history fixture → null (n<20, years<0.25)', () => {
    const result = computeCAGR({
      initialCapital: SMALL_INIT,
      endCapital: SMALL_END,
      yearsActive: SMALL_YEARS,
      tradesCount: SMALL_TRADES,
    });
    expect(result).toBeNull();
  });

  it('explosion fixture (init=20, n=10, years=0.04) → null (capital<500, n<20, years<0.25)', () => {
    const result = computeCAGR({
      initialCapital: 20,
      endCapital: 40,
      yearsActive: 0.04,
      tradesCount: 10,
    });
    // The 28 888 % aberration is dead — the gate refuses to emit anything.
    expect(result).toBeNull();
  });

  it('passes gate (n=40, years=1, init=2000) → finite ~10%', () => {
    const result = computeCAGR({
      initialCapital: BIG_INIT,
      endCapital: BIG_END,
      yearsActive: BIG_YEARS,
      tradesCount: BIG_TRADES,
    });
    expect(result).not.toBeNull();
    expect(typeof result).toBe('number');
    expect(Number.isFinite(result)).toBe(true);
    // 2200/2000 = 1.10 → 10 % (years=1 → exponent 1).
    expect(result).toBeCloseTo(10, 1);
  });

  it('passes gate but losing portfolio → negative CAGR (not clamped)', () => {
    const result = computeCAGR({
      initialCapital: 2000,
      endCapital: 1800,
      yearsActive: 1,
      tradesCount: 40,
    });
    expect(result).toBeCloseTo(-10, 1);
  });

  it('init=0 → null (gate + guard)', () => {
    expect(
      computeCAGR({
        initialCapital: 0,
        endCapital: 100,
        yearsActive: 1,
        tradesCount: 40,
      })
    ).toBeNull();
  });

  it('boundary : years=0.25, trades=20, capitalRef=500 (inclusive) → finite', () => {
    const result = computeCAGR({
      initialCapital: 500,
      endCapital: 500 + 25, // tiny gain so endCapital > 0
      yearsActive: 0.25,
      tradesCount: 20,
    });
    expect(result).not.toBeNull();
    expect(typeof result).toBe('number');
  });

  it('non-finite inputs → null', () => {
    expect(
      computeCAGR({
        initialCapital: NaN,
        endCapital: 100,
        yearsActive: 1,
        tradesCount: 40,
      })
    ).toBeNull();
  });

  it('A2.1 — initialCapital=null (unknown) → null via gate', () => {
    // The gate's capitalRef branch trips on null (`i.capitalRef == null`)
    // → no honest annualisation possible.
    expect(
      computeCAGR({
        initialCapital: null,
        endCapital: null,
        yearsActive: 1,
        tradesCount: 40,
      })
    ).toBeNull();
  });

  it('A2.1 — small init (20) with otherwise-passing gate → null (capital<500)', () => {
    expect(
      computeCAGR({
        initialCapital: 20,
        endCapital: 40,
        yearsActive: 0.3, // years gate passes
        tradesCount: 25,  // trades gate passes
      })
    ).toBeNull();
  });

  // ─── A2.2 — cumulative branch (0 < years < 1) ─────────────────────

  it('A2.2 — years=0.4, init=11200, end=24400, n=100 → CUMULATIVE ~117.86%', () => {
    // Real-data fixture from Tracker_TEST-2.csv after parser fix.
    // (24400 / 11200) - 1 = 1.1786 → 117.86 %. NEVER 600 % (which is
    // what (24400/11200)^(1/0.4) - 1 would give if annualised).
    const result = computeCAGR({
      initialCapital: 11200,
      endCapital: 24400,
      yearsActive: 0.4,
      tradesCount: 100,
    });
    expect(result).toBeCloseTo(117.86, 1);
    // Sanity : NOT the annualised value.
    expect(result).not.toBeCloseTo(613, 0);
  });

  it('A2.2 — years=1.5 (≥1) → annualised geometric', () => {
    // (2400/2000)^(1/1.5) − 1 = 1.2^0.6667 − 1 ≈ 0.12924 → 12.92 %.
    const result = computeCAGR({
      initialCapital: 2000,
      endCapital: 2400,
      yearsActive: 1.5,
      tradesCount: 40,
    });
    expect(result).toBeCloseTo(12.92, 1);
  });

  it('A2.2 — years=0.4 but n<20 → null (trades gate enforced in both branches)', () => {
    expect(
      computeCAGR({
        initialCapital: 11200,
        endCapital: 24400,
        yearsActive: 0.4,
        tradesCount: 10,
      })
    ).toBeNull();
  });

  it('A2.2 — exact boundary years=1.0 → annualised branch (inclusive)', () => {
    // (1100/1000)^1 − 1 = 0.10 → 10 %. Annualised path.
    const result = computeCAGR({
      initialCapital: 1000,
      endCapital: 1100,
      yearsActive: 1,
      tradesCount: 40,
    });
    expect(result).toBeCloseTo(10, 5);
  });

  it('A2.2 — cumulative loss : years=0.4, init=10000, end=8000 → -20 %', () => {
    const result = computeCAGR({
      initialCapital: 10000,
      endCapital: 8000,
      yearsActive: 0.4,
      tradesCount: 40,
    });
    expect(result).toBeCloseTo(-20, 5);
  });
});

describe('cagrMode (helper)', () => {
  it('years ≥ 1 → "annualised"', () => {
    expect(cagrMode(1)).toBe('annualised');
    expect(cagrMode(2.5)).toBe('annualised');
  });
  it('0 < years < 1 → "cumulative"', () => {
    expect(cagrMode(0.4)).toBe('cumulative');
    expect(cagrMode(0.999)).toBe('cumulative');
  });
  it('years ≤ 0 or non-finite → null', () => {
    expect(cagrMode(0)).toBeNull();
    expect(cagrMode(-1)).toBeNull();
    expect(cagrMode(NaN)).toBeNull();
    expect(cagrMode(null)).toBeNull();
    expect(cagrMode(undefined)).toBeNull();
  });
});
