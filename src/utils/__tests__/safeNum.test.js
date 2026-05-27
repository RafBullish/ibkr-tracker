// ═══════════════════════════════════════════════════════════════
//  safeNum + roundTo2Safe — golden master (A1.5)
//
//  Boundary numeric guards used at metric output sites. Wraps NaN /
//  Infinity / non-number inputs into an explicit fallback (null by
//  default) so downstream tone/display logic never sees junk.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { safeNum, roundTo2Safe } from '../safeNum';

describe('safeNum', () => {
  it('passes through finite numbers', () => {
    expect(safeNum(42)).toBe(42);
    expect(safeNum(0)).toBe(0);
    expect(safeNum(-3.14)).toBe(-3.14);
    expect(safeNum(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('NaN → null (default fallback)', () => {
    expect(safeNum(NaN)).toBeNull();
  });

  it('Infinity → null', () => {
    expect(safeNum(Infinity)).toBeNull();
  });

  it('-Infinity → null', () => {
    expect(safeNum(-Infinity)).toBeNull();
  });

  it('non-number types → null', () => {
    expect(safeNum('42')).toBeNull(); // strings rejected (not auto-coerced)
    expect(safeNum(null)).toBeNull();
    expect(safeNum(undefined)).toBeNull();
    expect(safeNum({})).toBeNull();
    expect(safeNum([])).toBeNull();
    expect(safeNum(true)).toBeNull();
  });

  it('custom fallback respected for invalid inputs', () => {
    expect(safeNum(NaN, 0)).toBe(0);
    expect(safeNum(Infinity, 'N/A')).toBe('N/A');
    expect(safeNum(undefined, -1)).toBe(-1);
  });

  it('custom fallback NOT applied to finite numbers', () => {
    expect(safeNum(42, 'fallback')).toBe(42);
    expect(safeNum(0, -1)).toBe(0);
  });
});

describe('roundTo2Safe', () => {
  it('rounds finite numbers to 2 decimals (EPSILON-correct)', () => {
    expect(roundTo2Safe(1.005)).toBe(1.01); // EPSILON trick keeps banker rounding sane
    expect(roundTo2Safe(2.345)).toBe(2.35);
    expect(roundTo2Safe(0)).toBe(0);
    expect(roundTo2Safe(-3.146)).toBe(-3.15);
  });

  it('NaN / Infinity → null', () => {
    expect(roundTo2Safe(NaN)).toBeNull();
    expect(roundTo2Safe(Infinity)).toBeNull();
    expect(roundTo2Safe(-Infinity)).toBeNull();
  });

  it('custom fallback for invalid inputs', () => {
    expect(roundTo2Safe(NaN, 0)).toBe(0);
    expect(roundTo2Safe(Infinity, '—')).toBe('—');
  });
});
