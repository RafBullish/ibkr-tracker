// ═══════════════════════════════════════════════════════════════
//  significance — golden master (A1.5)
//
//  The module is CREATED but NOT wired into the metric pipeline yet.
//  This suite locks the constants and the pure significanceCheck()
//  helper so A2 can adopt it with confidence. Boundary tests
//  document inclusive (>=) vs exclusive (>) semantics as implemented.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  MIN_TRADES_ANNUALIZED,
  MIN_YEARS_ANNUALIZED,
  MIN_OBS_RATIO,
  MIN_LOSSES_PF,
  MIN_CAPITAL_REF_USD,
  MIN_DECISIVE_WINRATE,
  significanceCheck,
} from '../significance';

describe('significance — thresholds (constants)', () => {
  it('locks the canonical threshold values', () => {
    expect(MIN_TRADES_ANNUALIZED).toBe(20);
    expect(MIN_YEARS_ANNUALIZED).toBe(0.25);
    expect(MIN_OBS_RATIO).toBe(30);
    expect(MIN_LOSSES_PF).toBe(3);
    expect(MIN_CAPITAL_REF_USD).toBe(500);
    expect(MIN_DECISIVE_WINRATE).toBe(10);
  });
});

describe('significanceCheck — happy path', () => {
  it('all inputs above all requirements → ok=true', () => {
    const r = significanceCheck(
      { trades: 50, years: 1, obs: 100, losses: 10, capitalRef: 5000 },
      {
        trades: MIN_TRADES_ANNUALIZED,
        years: MIN_YEARS_ANNUALIZED,
        obs: MIN_OBS_RATIO,
        losses: MIN_LOSSES_PF,
        capitalRef: MIN_CAPITAL_REF_USD,
      }
    );
    expect(r).toEqual({ ok: true, reason: null });
  });

  it('requirement key absent from inputs → not validated (no error)', () => {
    // No `trades` requirement → no check on trades.
    const r = significanceCheck({ years: 1 }, { years: 0.25 });
    expect(r.ok).toBe(true);
  });
});

describe('significanceCheck — failure cases', () => {
  it('trades below threshold → ok=false', () => {
    const r = significanceCheck(
      { trades: 5 },
      { trades: MIN_TRADES_ANNUALIZED }
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/n_trades<20/);
    expect(r.reason).toContain('5');
  });

  it('years below threshold → ok=false', () => {
    const r = significanceCheck({ years: 0.05 }, { years: MIN_YEARS_ANNUALIZED });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/years<0\.25/);
  });

  it('obs below threshold → ok=false', () => {
    const r = significanceCheck({ obs: 10 }, { obs: MIN_OBS_RATIO });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/n_obs<30/);
  });

  it('losses below threshold → ok=false', () => {
    const r = significanceCheck({ losses: 1 }, { losses: MIN_LOSSES_PF });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/n_losses<3/);
  });

  it('capitalRef below threshold → ok=false', () => {
    const r = significanceCheck({ capitalRef: 100 }, { capitalRef: MIN_CAPITAL_REF_USD });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/capitalRef<500/);
  });

  it('missing input when required → ok=false with reason', () => {
    const r = significanceCheck({}, { trades: 20 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/n_trades<20/);
    expect(r.reason).toContain('n/a');
  });
});

describe('significanceCheck — exact boundary semantics (>= vs >)', () => {
  // Implementation uses `i.x < r.x` for the failure branch, so the
  // boundary itself (i.x === r.x) is INCLUSIVE → ok=true.

  it('years EXACTLY 0.25 → INCLUSIVE (ok=true)', () => {
    const r = significanceCheck({ years: 0.25 }, { years: MIN_YEARS_ANNUALIZED });
    expect(r.ok).toBe(true);
  });

  it('trades EXACTLY 20 → INCLUSIVE (ok=true)', () => {
    const r = significanceCheck({ trades: 20 }, { trades: MIN_TRADES_ANNUALIZED });
    expect(r.ok).toBe(true);
  });

  it('obs EXACTLY 30 → INCLUSIVE (ok=true)', () => {
    const r = significanceCheck({ obs: 30 }, { obs: MIN_OBS_RATIO });
    expect(r.ok).toBe(true);
  });

  it('losses EXACTLY 3 → INCLUSIVE (ok=true)', () => {
    const r = significanceCheck({ losses: 3 }, { losses: MIN_LOSSES_PF });
    expect(r.ok).toBe(true);
  });

  it('capitalRef EXACTLY 500 → INCLUSIVE (ok=true)', () => {
    const r = significanceCheck({ capitalRef: 500 }, { capitalRef: MIN_CAPITAL_REF_USD });
    expect(r.ok).toBe(true);
  });

  // A2b — `decisive` branch is now wired in significanceCheck.
  it('decisive EXACTLY 10 → INCLUSIVE (ok=true)', () => {
    const r = significanceCheck({ decisive: 10 }, { decisive: MIN_DECISIVE_WINRATE });
    expect(r.ok).toBe(true);
  });

  it('decisive=9 → ok=false with reason mentioning the threshold', () => {
    const r = significanceCheck({ decisive: 9 }, { decisive: MIN_DECISIVE_WINRATE });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/n_decisive<10/);
  });
});

describe('significanceCheck — null/undefined inputs', () => {
  it('null inputs object → uses {} default', () => {
    const r = significanceCheck(null, { trades: 5 });
    expect(r.ok).toBe(false);
  });

  it('null requirements object → ok=true (nothing to validate)', () => {
    const r = significanceCheck({ trades: 0 }, null);
    expect(r.ok).toBe(true);
  });
});
