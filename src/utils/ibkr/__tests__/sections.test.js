// ═══════════════════════════════════════════════════════════════
//  sections.js — A2.2 parser test (Cash Transactions + Cash Report).
//
//  Locks the granular-type recognition that fixes the Tracker_TEST-2.csv
//  regression : Type="Deposits" was silently dropped, leaving
//  initialCapital=0 and the entire risk-adjusted card cluster at "—".
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { mapCashTxnRow, mapCashReportRow } from '../sections';

// Helper : turn { col: value } into (fields, headerMap) the way the
// real parser passes them.
function row(record) {
  const cols = Object.keys(record);
  const headerMap = Object.fromEntries(cols.map((c, i) => [c, i]));
  const fields = cols.map((c) => String(record[c] ?? ''));
  return { fields, headerMap };
}

describe('mapCashTxnRow — granular IBKR types (A2.2)', () => {
  it('Type="Deposits" + CHF + positive → dep_chf', () => {
    const { fields, headerMap } = row({
      LevelOfDetail: 'DETAIL',
      Type: 'Deposits',
      CurrencyPrimary: 'CHF',
      Amount: '1500',
      'Date/Time': '20251115;120000',
      TransactionID: 'T1',
    });
    const cf = mapCashTxnRow(fields, headerMap);
    expect(cf).not.toBeNull();
    expect(cf.ty).toBe('dep_chf');
    expect(cf.a1).toBe('1500');
  });

  it('Type="Withdrawals" + CHF + negative → wit_chf', () => {
    const { fields, headerMap } = row({
      LevelOfDetail: 'DETAIL',
      Type: 'Withdrawals',
      CurrencyPrimary: 'CHF',
      Amount: '-200',
      'Date/Time': '20260301;120000',
      TransactionID: 'T2',
    });
    const cf = mapCashTxnRow(fields, headerMap);
    expect(cf).not.toBeNull();
    expect(cf.ty).toBe('wit_chf');
    expect(cf.a1).toBe('200'); // magnitude
  });

  it('Type="Deposits" + USD + positive → dep_usd (new tag)', () => {
    const { fields, headerMap } = row({
      LevelOfDetail: 'DETAIL',
      Type: 'Deposits',
      CurrencyPrimary: 'USD',
      Amount: '500',
      'Date/Time': '20251201;120000',
      TransactionID: 'T3',
    });
    const cf = mapCashTxnRow(fields, headerMap);
    expect(cf.ty).toBe('dep_usd');
  });

  it('Type="Withdrawals" + USD + negative → wit_usd (new tag)', () => {
    const { fields, headerMap } = row({
      LevelOfDetail: 'DETAIL',
      Type: 'Withdrawals',
      CurrencyPrimary: 'USD',
      Amount: '-100',
      'Date/Time': '20251202;120000',
      TransactionID: 'T4',
    });
    const cf = mapCashTxnRow(fields, headerMap);
    expect(cf.ty).toBe('wit_usd');
  });

  it('Type="Deposits/Withdrawals" (legacy combined) — positive → dep_chf', () => {
    const { fields, headerMap } = row({
      LevelOfDetail: 'DETAIL',
      Type: 'Deposits/Withdrawals',
      CurrencyPrimary: 'CHF',
      Amount: '1000',
      'Date/Time': '20251101;120000',
      TransactionID: 'T5',
    });
    const cf = mapCashTxnRow(fields, headerMap);
    expect(cf.ty).toBe('dep_chf');
  });

  it('Type="Deposits/Withdrawals" (legacy combined) — negative → wit_chf', () => {
    const { fields, headerMap } = row({
      LevelOfDetail: 'DETAIL',
      Type: 'Deposits/Withdrawals',
      CurrencyPrimary: 'CHF',
      Amount: '-300',
      'Date/Time': '20251102;120000',
      TransactionID: 'T6',
    });
    const cf = mapCashTxnRow(fields, headerMap);
    expect(cf.ty).toBe('wit_chf');
  });

  it('Type="Dividends" → null (ignored, not funding)', () => {
    const { fields, headerMap } = row({
      LevelOfDetail: 'DETAIL',
      Type: 'Dividends',
      CurrencyPrimary: 'USD',
      Amount: '12.50',
      'Date/Time': '20251115;120000',
    });
    expect(mapCashTxnRow(fields, headerMap)).toBeNull();
  });

  it('Type="Broker Interest Received" → null', () => {
    const { fields, headerMap } = row({
      LevelOfDetail: 'DETAIL',
      Type: 'Broker Interest Received',
      CurrencyPrimary: 'USD',
      Amount: '3.20',
      'Date/Time': '20251115;120000',
    });
    expect(mapCashTxnRow(fields, headerMap)).toBeNull();
  });

  it('Type="Withholding Tax" → null', () => {
    const { fields, headerMap } = row({
      LevelOfDetail: 'DETAIL',
      Type: 'Withholding Tax',
      CurrencyPrimary: 'USD',
      Amount: '-1.50',
      'Date/Time': '20251115;120000',
    });
    expect(mapCashTxnRow(fields, headerMap)).toBeNull();
  });

  it('Unsupported currency (EUR) → null', () => {
    const { fields, headerMap } = row({
      LevelOfDetail: 'DETAIL',
      Type: 'Deposits',
      CurrencyPrimary: 'EUR',
      Amount: '1000',
      'Date/Time': '20251115;120000',
    });
    expect(mapCashTxnRow(fields, headerMap)).toBeNull();
  });

  it('amount = 0 → null', () => {
    const { fields, headerMap } = row({
      LevelOfDetail: 'DETAIL',
      Type: 'Deposits',
      CurrencyPrimary: 'CHF',
      Amount: '0',
      'Date/Time': '20251115;120000',
    });
    expect(mapCashTxnRow(fields, headerMap)).toBeNull();
  });

  it('LevelOfDetail !== "DETAIL" → null', () => {
    const { fields, headerMap } = row({
      LevelOfDetail: 'SUMMARY',
      Type: 'Deposits',
      CurrencyPrimary: 'CHF',
      Amount: '1500',
    });
    expect(mapCashTxnRow(fields, headerMap)).toBeNull();
  });

  it('preserves the date as `da` (for future IRR primitive)', () => {
    const { fields, headerMap } = row({
      LevelOfDetail: 'DETAIL',
      Type: 'Deposits',
      CurrencyPrimary: 'CHF',
      Amount: '1500',
      'Date/Time': '20251115;120000',
    });
    const cf = mapCashTxnRow(fields, headerMap);
    expect(cf.da).toBe('2025-11-15');
  });
});

describe('mapCashReportRow — base currency + per-currency deposits (A2.2)', () => {
  it('captures baseCurrency at BaseCurrency level', () => {
    const { fields, headerMap } = row({
      LevelOfDetail: 'BaseCurrency',
      CurrencyPrimary: 'CHF',
      StartingCash: '0',
      EndingCash: '19163',
      Deposits: '9000',
      Withdrawals: '-200',
      Commissions: '-13.45',
      NetTradesSales: '0',
      NetTradesPurchases: '0',
    });
    const report = {};
    mapCashReportRow(fields, headerMap, report);
    expect(report.baseCurrency).toBe('CHF');
    expect(report.startingCash).toBe(0);
    expect(report.deposits).toBe(9000);
    expect(report.withdrawals).toBe(-200);
  });

  it('captures per-currency deposits/withdrawals if columns present', () => {
    const { fields, headerMap } = row({
      LevelOfDetail: 'Currency',
      CurrencyPrimary: 'CHF',
      StartingCash: '0',
      EndingCash: '8587',
      Deposits: '9000',
      Withdrawals: '-200',
    });
    const report = {};
    mapCashReportRow(fields, headerMap, report);
    expect(report.currencies.CHF).toEqual({
      endingCash: 8587,
      startingCash: 0,
      deposits: 9000,
      withdrawals: -200,
    });
  });
});
