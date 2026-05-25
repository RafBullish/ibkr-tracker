// ═══════════════════════════════════════════════════════════════
//  buildClosedTrades — A3a inter-CSV FIFO matching.
//
//  Verifies that a close in the "current CSV" pool can match an open
//  living in `historicalOpens` (the tracker's persisted openPositions),
//  instead of dropping into the CostBasis fallback.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { buildClosedTrades } from '../closedTrades';

// Build a raw IBKR-shaped trade row.
function trade(o) {
  return {
    as: 'Action',
    dir: o.dir || 'Long',
    tk: o.tk,
    ty: o.ty || '',
    st: o.st || '',
    ex: o.ex || '',
    di: o.di || '2026-01-15',
    ct: String(o.ct),
    mu: String(o.mu ?? 1),
    pi: String(o.pi),
    fi: String(o.fi ?? 0),
    fxi: String(o.fxi ?? 0.78),
    _ibkrTradeId: o.id || 'T',
    _ibkrOpenClose: o.oc,
    _ibkrBuySell: o.bs || 'BUY',
    _ibkrCostBasis: o.cb ?? 0,
    _ibkrFifoPnl: o.fpnl ?? 0,
  };
}

// Build a tracker-shaped open position (the `historicalOpens` input).
function pos(o) {
  return {
    as: 'Action',
    dir: o.dir || 'Long',
    tk: o.tk,
    ty: o.ty || '',
    st: o.st || '',
    ex: o.ex || '',
    di: o.di || '2025-12-01',
    ct: String(o.ct),
    mu: String(o.mu ?? 1),
    pi: String(o.pi),
    fi: String(o.fi ?? 0),
    fxi: String(o.fxi ?? 0.78),
  };
}

describe('buildClosedTrades — historical opens pool (A3a)', () => {
  it('a close with no intra-CSV open matches a historical open → not a fallback', () => {
    const closes = [
      trade({
        tk: 'AAPL',
        ct: 10,
        pi: 200,
        fi: 1,
        oc: 'C',
        bs: 'SELL',
        cb: 1500,
      }),
    ];
    const historicalOpens = [
      pos({ tk: 'AAPL', ct: 10, pi: 150, fi: 1, di: '2025-12-01' }),
    ];
    const result = buildClosedTrades(closes, historicalOpens);
    expect(result).toHaveLength(1);
    const ct = result[0];
    // entryDate comes from the historical open, NOT the close date.
    expect(ct.di).toBe('2025-12-01');
    // entryPrice = 150 from historical open (not reconstructed from CostBasis).
    expect(parseFloat(ct.pi)).toBeCloseTo(150, 5);
    // fallback marker = null (matched FIFO).
    expect(ct._fifoFallbackReason).toBeNull();
  });

  it('intra-CSV open + historical open : intra-CSV is consumed first when FIFO order is respected', () => {
    // Historical (older, 2025-12) and intra-CSV (newer, 2026-01) opens of
    // 10 ct each. A close for 10 ct must consume the OLDEST first.
    const closes = [
      trade({
        tk: 'MSFT',
        ct: 10,
        pi: 220,
        oc: 'C',
        bs: 'SELL',
        di: '2026-02-01',
      }),
    ];
    const intraOpens = [
      trade({
        tk: 'MSFT',
        ct: 10,
        pi: 200,
        di: '2026-01-15',
        oc: 'O',
        bs: 'BUY',
      }),
    ];
    const historicalOpens = [
      pos({ tk: 'MSFT', ct: 10, pi: 180, di: '2025-12-01' }),
    ];
    const result = buildClosedTrades(
      [...intraOpens, ...closes],
      historicalOpens
    );
    expect(result).toHaveLength(1);
    // Should match against the OLDEST = historical open (entryPrice=180).
    expect(parseFloat(result[0].pi)).toBeCloseTo(180, 5);
    expect(result[0].di).toBe('2025-12-01');
  });

  it('no historical, no intra-CSV → fallback CostBasis, reason flagged', () => {
    const closes = [
      trade({
        tk: 'NVDA',
        ct: 5,
        pi: 600,
        mu: 1,
        oc: 'C',
        bs: 'SELL',
        cb: 2500,
        di: '2026-02-15',
      }),
    ];
    const result = buildClosedTrades(closes, []);
    expect(result).toHaveLength(1);
    const ct = result[0];
    expect(ct._fifoFallbackReason).toBe('no_matching_open');
    // Fallback entry date = close date (a known limitation, now flagged).
    expect(ct.di).toBe('2026-02-15');
    // Fallback entryPrice = costBasis / (qty × mul) = 2500 / 5 = 500.
    expect(parseFloat(ct.pi)).toBeCloseTo(500, 5);
  });

  it('fallback with mu=0 → entryPrice=0 + explicit reason (mu<=0)', () => {
    const closes = [
      trade({
        tk: 'WEIRD',
        ct: 5,
        pi: 100,
        mu: 0,
        oc: 'C',
        bs: 'SELL',
        cb: 500,
      }),
    ];
    const result = buildClosedTrades(closes, []);
    expect(result).toHaveLength(1);
    expect(parseFloat(result[0].pi)).toBe(0);
    expect(result[0]._fifoFallbackReason).toMatch(/mu/);
  });

  it('back-compat : buildClosedTrades(trades) without historicalOpens → still works', () => {
    const intra = [
      trade({
        tk: 'X',
        ct: 5,
        pi: 50,
        di: '2026-01-10',
        oc: 'O',
        bs: 'BUY',
      }),
      trade({
        tk: 'X',
        ct: 5,
        pi: 60,
        di: '2026-02-10',
        oc: 'C',
        bs: 'SELL',
      }),
    ];
    const result = buildClosedTrades(intra);
    expect(result).toHaveLength(1);
    expect(parseFloat(result[0].pi)).toBeCloseTo(50, 5);
    expect(result[0]._fifoFallbackReason).toBeNull();
  });

  it('non-array historicalOpens → safely treated as empty', () => {
    const closes = [
      trade({ tk: 'X', ct: 5, pi: 100, oc: 'C', bs: 'SELL', cb: 250 }),
    ];
    const result = buildClosedTrades(closes, null);
    expect(result[0]._fifoFallbackReason).toBe('no_matching_open');
  });
});
