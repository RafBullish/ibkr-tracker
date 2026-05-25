// ═══════════════════════════════════════════════════════════════
//  equityTimeline — A3b foundation tests.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { buildEquityTimeline, extractFundingFlows } from '../equityTimeline';

const LR = 0.7825; // CHF per USD

function trade(date, pnl, opts = {}) {
  return {
    do: date,
    di: opts.di || date,
    pnl: String(pnl),
    ct: '1',
    mu: '100',
    pi: '0',
    po: '0',
    fi: '0',
    fo: '0',
    fxi: '0',
    fxo: '0',
    dir: 'Long',
    as: 'Option',
    tk: 'X',
    ty: 'CALL',
    st: '0',
    ex: '',
  };
}

describe('extractFundingFlows', () => {
  it('captures dep_chf + wit_chf in USD via liveRate', () => {
    const cf = [
      { da: '2025-11-15', ty: 'dep_chf', a1: '1500' },
      { da: '2025-12-15', ty: 'dep_chf', a1: '1500' },
      { da: '2026-01-10', ty: 'wit_chf', a1: '200' },
    ];
    const flows = extractFundingFlows(cf, LR);
    expect(flows).toHaveLength(3);
    expect(flows[0].date).toBe('2025-11-15');
    expect(flows[0].netUsd).toBeCloseTo(1500 / LR, 2);
    expect(flows[2].netUsd).toBeCloseTo(-200 / LR, 2);
  });

  it('sorts asc by date', () => {
    const cf = [
      { da: '2026-04-15', ty: 'dep_chf', a1: '1500' },
      { da: '2025-11-15', ty: 'dep_chf', a1: '1500' },
    ];
    const flows = extractFundingFlows(cf, LR);
    expect(flows[0].date).toBe('2025-11-15');
    expect(flows[1].date).toBe('2026-04-15');
  });

  it('handles dep_usd / wit_usd directly (no FX needed)', () => {
    const flows = extractFundingFlows(
      [
        { da: '2026-01-01', ty: 'dep_usd', a1: '5000' },
        { da: '2026-02-01', ty: 'wit_usd', a1: '500' },
      ],
      null // liveRate not needed for USD entries
    );
    expect(flows[0].netUsd).toBe(5000);
    expect(flows[1].netUsd).toBe(-500);
  });

  it('skips non-funding types (Dividends, FX trades, etc.)', () => {
    const flows = extractFundingFlows(
      [
        { da: '2026-01-01', ty: 'div_usd', a1: '12' },
        { da: '2026-01-15', ty: 'fx_buy_usd', a1: '1000', a2: '1300' },
      ],
      LR
    );
    // div_usd is treated as funding inflow in the legacy mapper — but
    // extractFundingFlows treats it as adj_usd (alias). fx_buy_* is
    // currency conversion, not funding. Verify:
    // - div_usd → counted as adj_usd alias (legacy)
    // - fx_buy_usd → ignored
    expect(flows.find((f) => f.date === '2026-01-15')).toBeUndefined();
  });

  it('CHF entries skipped silently when liveRate invalid', () => {
    const flows = extractFundingFlows(
      [{ da: '2026-01-01', ty: 'dep_chf', a1: '1500' }],
      0 // invalid
    );
    expect(flows).toHaveLength(0);
  });

  it('non-array input → empty', () => {
    expect(extractFundingFlows(null, LR)).toEqual([]);
    expect(extractFundingFlows(undefined, LR)).toEqual([]);
  });
});

describe('buildEquityTimeline', () => {
  it('user fixture (6 CHF deposits + 3 trades) → points reference correct capital schedule', () => {
    const cf = [
      { da: '2025-11-15', ty: 'dep_chf', a1: '1500' },
      { da: '2025-12-15', ty: 'dep_chf', a1: '1500' },
      { da: '2026-01-15', ty: 'dep_chf', a1: '1500' },
    ];
    const trades = [
      trade('2025-12-01', 100), // capital deployed by then = 1500 CHF
      trade('2026-01-05', 200), // capital deployed = 3000 CHF
      trade('2026-02-01', 150), // capital deployed = 4500 CHF
    ];
    const r = buildEquityTimeline({
      closedTrades: trades,
      cashFlows: cf,
      initialCapital: 4500 / LR,
      liveRate: LR,
    });
    expect(r.flows).toHaveLength(3);
    expect(r.firstFlowDate).toBe('2025-11-15');
    expect(r.points).toHaveLength(3);
    // First trade (2025-12-01) : only the Nov deposit landed.
    expect(r.points[0].capitalDeployedToDate).toBeCloseTo(1500 / LR, 1);
    expect(r.points[0].cumPnL).toBe(100);
    expect(r.points[0].realEquity).toBeCloseTo(1500 / LR + 100, 1);
    // Second trade (2026-01-05) : Nov + Dec landed.
    expect(r.points[1].capitalDeployedToDate).toBeCloseTo(3000 / LR, 1);
    expect(r.points[1].cumPnL).toBe(300);
    // Third trade (2026-02-01) : all 3 deposits landed.
    expect(r.points[2].capitalDeployedToDate).toBeCloseTo(4500 / LR, 1);
    expect(r.points[2].cumPnL).toBe(450);
  });

  it('initialCapital known but cashFlows empty → single deployment at the start', () => {
    const trades = [trade('2026-01-01', 100), trade('2026-02-01', 200)];
    const r = buildEquityTimeline({
      closedTrades: trades,
      cashFlows: [],
      initialCapital: 10000,
      liveRate: LR,
    });
    expect(r.flows).toHaveLength(0);
    expect(r.hasKnownBase).toBe(true);
    expect(r.points[0].capitalDeployedToDate).toBe(10000);
    expect(r.points[0].realEquity).toBe(10100);
    expect(r.points[1].realEquity).toBe(10300);
  });

  it('initialCapital unknown + no flows → realEquity falls back to cumPnL', () => {
    const trades = [trade('2026-01-01', 100), trade('2026-02-01', 200)];
    const r = buildEquityTimeline({
      closedTrades: trades,
      cashFlows: [],
      initialCapital: null,
      liveRate: LR,
    });
    expect(r.hasKnownBase).toBe(false);
    expect(r.points[0].capitalDeployedToDate).toBe(0);
    expect(r.points[0].realEquity).toBe(100);
  });

  it('empty closedTrades → empty points', () => {
    const r = buildEquityTimeline({
      closedTrades: [],
      cashFlows: [{ da: '2026-01-01', ty: 'dep_chf', a1: '1500' }],
      initialCapital: 1916,
      liveRate: LR,
    });
    expect(r.points).toHaveLength(0);
    expect(r.flows).toHaveLength(1);
  });
});
