// ═══════════════════════════════════════════════════════════════
//  deriveInitialFromCashReport — A2.2 hierarchy step #1.
//
//  Locks the priority "Cash Report" branch of initialCapital
//  resolution. Per-currency aggregation wins over BaseCurrency when
//  available ; missing data falls through to null so the caller can
//  proceed to lower-priority sources (cashFlows → settings → null).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { deriveInitialFromCashReport } from '../calculations';

const LIVE_RATE = 0.7825; // CHF per USD

describe('deriveInitialFromCashReport', () => {
  it('null / undefined input → null', () => {
    expect(deriveInitialFromCashReport(null, LIVE_RATE)).toBeNull();
    expect(deriveInitialFromCashReport(undefined, LIVE_RATE)).toBeNull();
  });

  it('Tracker_TEST-2 fixture — CHF base, 9000 deposits, -200 withdrawal → 8800 CHF ≈ $11247', () => {
    const cashReport = {
      baseCurrency: 'CHF',
      startingCash: 0,
      deposits: 9000,
      withdrawals: -200,
      endingCash: 8587,
      currencies: {
        CHF: { startingCash: 0, endingCash: 8587, deposits: 0, withdrawals: 0 },
      },
    };
    const result = deriveInitialFromCashReport(cashReport, LIVE_RATE);
    // No per-currency funding data (deposits/withdrawals 0) → falls back to
    // BaseCurrency aggregate : 0 + 9000 + (-200) = 8800 CHF / 0.7825 ≈ 11246.96 USD.
    // 8800 / 0.7825 = 11246.006...
    expect(result).toBeCloseTo(11246, 0);
  });

  it('per-currency CHF funding present → wins over BaseCurrency aggregate', () => {
    // Same totals, but exposed at Currency level.
    const cashReport = {
      baseCurrency: 'CHF',
      startingCash: 0,
      deposits: 9000,
      withdrawals: -200,
      currencies: {
        CHF: { startingCash: 0, endingCash: 8587, deposits: 9000, withdrawals: -200 },
      },
    };
    const result = deriveInitialFromCashReport(cashReport, LIVE_RATE);
    // 8800 / 0.7825 = 11246.006...
    expect(result).toBeCloseTo(11246, 0);
  });

  it('USD-base aggregate → no liveRate conversion', () => {
    const cashReport = {
      baseCurrency: 'USD',
      startingCash: 0,
      deposits: 10000,
      withdrawals: -500,
    };
    expect(deriveInitialFromCashReport(cashReport, LIVE_RATE)).toBe(9500);
  });

  it('mixed per-currency (USD + CHF) → sums in USD', () => {
    const cashReport = {
      currencies: {
        USD: { startingCash: 1000, endingCash: 0, deposits: 1000, withdrawals: 0 },
        CHF: { startingCash: 0, endingCash: 0, deposits: 1565, withdrawals: 0 },
      },
    };
    // USD net = 1000 + 1000 + 0 = 2000
    // CHF net = 0 + 1565 + 0 = 1565 / 0.7825 = 2000.00
    // Total ≈ 4000 USD
    const result = deriveInitialFromCashReport(cashReport, LIVE_RATE);
    expect(result).toBeCloseTo(4000, 0);
  });

  it('no funding data at all (only endingCash) → null', () => {
    const cashReport = {
      baseCurrency: 'CHF',
      startingCash: 0,
      deposits: 0,
      withdrawals: 0,
      currencies: {
        CHF: { startingCash: 0, endingCash: 100, deposits: 0, withdrawals: 0 },
      },
    };
    expect(deriveInitialFromCashReport(cashReport, LIVE_RATE)).toBeNull();
  });

  it('liveRate=0 + CHF base → null (cannot convert)', () => {
    const cashReport = {
      baseCurrency: 'CHF',
      startingCash: 0,
      deposits: 9000,
      withdrawals: -200,
    };
    expect(deriveInitialFromCashReport(cashReport, 0)).toBeNull();
  });

  it('missing baseCurrency code + liveRate available → assumes CHF (heuristic)', () => {
    const cashReport = {
      // no baseCurrency code
      startingCash: 0,
      deposits: 9000,
      withdrawals: -200,
    };
    const result = deriveInitialFromCashReport(cashReport, LIVE_RATE);
    // 8800 / 0.7825 = 11246.006...
    expect(result).toBeCloseTo(11246, 0);
  });

  it('negative net (withdrawals exceed deposits) → null (not "initial capital")', () => {
    const cashReport = {
      baseCurrency: 'CHF',
      startingCash: 0,
      deposits: 100,
      withdrawals: -500,
    };
    expect(deriveInitialFromCashReport(cashReport, LIVE_RATE)).toBeNull();
  });
});
