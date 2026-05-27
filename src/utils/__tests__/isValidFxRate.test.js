// ═══════════════════════════════════════════════════════════════
//  isValidFxRate + usdToChf null-safety (A3a)
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { isValidFxRate, usdToChf, chfToUsd } from '../fx/helpers';

describe('isValidFxRate', () => {
  it('accepts plausible USD/CHF rates', () => {
    expect(isValidFxRate(0.7825)).toBe(true);
    expect(isValidFxRate(0.85)).toBe(true);
    expect(isValidFxRate(1.0)).toBe(true);
    expect(isValidFxRate(1.4)).toBe(true);
  });

  it('rejects undefined / null / NaN / Infinity', () => {
    expect(isValidFxRate(undefined)).toBe(false);
    expect(isValidFxRate(null)).toBe(false);
    expect(isValidFxRate(NaN)).toBe(false);
    expect(isValidFxRate(Infinity)).toBe(false);
    expect(isValidFxRate(-Infinity)).toBe(false);
  });

  it('rejects zero and negative', () => {
    expect(isValidFxRate(0)).toBe(false);
    expect(isValidFxRate(-0.7825)).toBe(false);
  });

  it('rejects absurd magnitudes (< 0.01 or ≥ 100)', () => {
    expect(isValidFxRate(0.001)).toBe(false);
    expect(isValidFxRate(100)).toBe(false);
    expect(isValidFxRate(1e6)).toBe(false);
  });

  it('rejects non-number types (string "0.7825" not auto-coerced)', () => {
    expect(isValidFxRate('0.7825')).toBe(false);
    expect(isValidFxRate({})).toBe(false);
    expect(isValidFxRate([])).toBe(false);
    expect(isValidFxRate(true)).toBe(false);
  });
});

describe('usdToChf — null-safe (A3a)', () => {
  it('valid amount × valid rate → product', () => {
    expect(usdToChf(100, 0.7825)).toBeCloseTo(78.25, 5);
  });

  it('invalid rate → null (no silent 1:1)', () => {
    expect(usdToChf(100, 0)).toBeNull();
    expect(usdToChf(100, NaN)).toBeNull();
    expect(usdToChf(100, undefined)).toBeNull();
    expect(usdToChf(100, null)).toBeNull();
    expect(usdToChf(100, -1)).toBeNull();
    expect(usdToChf(100, 0.001)).toBeNull(); // out of bounds
  });

  it('invalid amount → null', () => {
    expect(usdToChf(NaN, 0.7825)).toBeNull();
    expect(usdToChf(Infinity, 0.7825)).toBeNull();
    expect(usdToChf(undefined, 0.7825)).toBeNull();
  });
});

describe('chfToUsd — throws on invalid rate', () => {
  it('valid → quotient', () => {
    expect(chfToUsd(78.25, 0.7825)).toBeCloseTo(100, 5);
  });

  it('invalid rate → throws (asymmetric with usdToChf : invalid quotient is more dangerous)', () => {
    expect(() => chfToUsd(100, 0)).toThrow();
    expect(() => chfToUsd(100, NaN)).toThrow();
    expect(() => chfToUsd(100, -1)).toThrow();
  });
});
