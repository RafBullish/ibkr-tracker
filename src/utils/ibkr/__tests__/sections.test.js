// ═══════════════════════════════════════════════════════════════
//  sections.js — A2.2 parser test (Cash Transactions + Cash Report).
//
//  Locks the granular-type recognition that fixes the Tracker_TEST-2.csv
//  regression : Type="Deposits" was silently dropped, leaving
//  initialCapital=0 and the entire risk-adjusted card cluster at "—".
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  identifySection,
  mapCashTxnRow,
  mapCashLedgerRow,
  mapCashReportRow,
  mapNavRow,
  mapTradeRow,
} from '../sections';

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

  it('capture la période du relevé (FromDate/ToDate) — identité du dataset', () => {
    const { fields, headerMap } = row({
      LevelOfDetail: 'BaseCurrency',
      CurrencyPrimary: 'BASE_SUMMARY',
      FromDate: '20250808',
      ToDate: '20260807',
      StartingCash: '0',
      EndingCash: '10.01',
    });
    const report = {};
    mapCashReportRow(fields, headerMap, report);
    expect(report.fromDate).toBe('2025-08-08');
    expect(report.toDate).toBe('2026-08-07');
  });
});

describe('identifySection — section NAV (chantier NLV)', () => {
  it('ReportDate + Total → nav, testée AVANT la signature vorace cashTransactions', () => {
    expect(identifySection(['ClientAccountID', 'CurrencyPrimary', 'ReportDate', 'Cash', 'Options', 'Total', 'TWR'])).toBe('nav');
    expect(identifySection(['ClientAccountID', 'FromDate', 'ToDate', 'StartingValue', 'EndingValue', 'ReportDate'])).toBe('nav');
  });

  it('les sections existantes qui portent ReportDate ne matchent PAS nav', () => {
    // Trades (TradeID), Open Positions (MarkPrice), Cash Transactions (Amount).
    expect(identifySection(['ReportDate', 'TradeID', 'TradePrice', 'Total'])).toBe('trades');
    expect(identifySection(['ReportDate', 'MarkPrice', 'PositionValue'])).toBe('openPositions');
    expect(identifySection(['ReportDate', 'Amount', 'Type', 'Date/Time'])).toBe('cashTransactions');
  });
});

describe('mapNavRow', () => {
  it('ReportDate + Total → point daté en devise de base', () => {
    const { fields, headerMap } = row({ ReportDate: '20260101', Total: '1234.56', CurrencyPrimary: 'CHF' });
    expect(mapNavRow(fields, headerMap)).toEqual({ date: '2026-01-01', total: 1234.56, currency: 'CHF' });
  });

  it('fallback EndingValue ; row sans date ou sans valeur → null', () => {
    const ok = row({ ReportDate: '20260101', EndingValue: '99' });
    expect(mapNavRow(ok.fields, ok.headerMap).total).toBe(99);
    const noDate = row({ ReportDate: '', Total: '5' });
    expect(mapNavRow(noDate.fields, noDate.headerMap)).toBeNull();
    const noVal = row({ ReportDate: '20260101', Total: '' });
    expect(mapNavRow(noVal.fields, noVal.headerMap)).toBeNull();
  });
});

describe('mapCashLedgerRow — canal reconstruction (fees INCLUS)', () => {
  it('capture tout mouvement DETAIL daté, signé, avec devise et taux', () => {
    const { fields, headerMap } = row({
      LevelOfDetail: 'DETAIL',
      Type: 'Other Fees',
      CurrencyPrimary: 'CHF',
      FXRateToBase: '1',
      Amount: '-11',
      'Date/Time': '20260312;103102',
    });
    expect(mapCashLedgerRow(fields, headerMap)).toEqual({
      date: '2026-03-12',
      currency: 'CHF',
      amount: -11,
      type: 'Other Fees',
      fxToBase: 1,
    });
  });

  it('non-DETAIL ou montant nul → null', () => {
    const sum = row({ LevelOfDetail: 'SUMMARY', Type: 'Other Fees', CurrencyPrimary: 'CHF', Amount: '-11', 'Date/Time': '20260312;103102' });
    expect(mapCashLedgerRow(sum.fields, sum.headerMap)).toBeNull();
    const zero = row({ LevelOfDetail: 'DETAIL', Type: 'Deposits', CurrencyPrimary: 'CHF', Amount: '0', 'Date/Time': '20260312;103102' });
    expect(mapCashLedgerRow(zero.fields, zero.headerMap)).toBeNull();
  });
});

describe('mapTradeRow — forex généralisé (les deux sens de paire)', () => {
  const fxRow = (over = {}) => row({
    LevelOfDetail: 'ORDER',
    AssetClass: 'CASH',
    Symbol: 'USD.CHF',
    CurrencyPrimary: 'CHF',
    FXRateToBase: '1',
    DateTime: '20251219;100241',
    Quantity: '0.95',
    TradePrice: '0.79588',
    TradeMoney: '0.756086',
    Proceeds: '-0.756086',
    IBCommission: '0',
    ...over,
  });

  it('USD.CHF : jambes quote (Proceeds) et base (Quantity), taux direct + legacy', () => {
    const { fields, headerMap } = fxRow();
    const fx = mapTradeRow(fields, headerMap);
    expect(fx.kind).toBe('fx');
    expect(fx.pairBase).toBe('USD');
    expect(fx.quoteCurrency).toBe('CHF');
    expect(fx.qty).toBe(0.95);
    expect(fx.proceeds).toBe(-0.756086);
    expect(fx.rate).toBe(0.79588);
    expect(fx.usdQty).toBe(0.95); // legacy fx_buy_usd préservé
    expect(fx.chfAmount).toBe(0.756086);
  });

  it('CHF.USD : taux USD→CHF inversé, PAS de flux legacy', () => {
    const { fields, headerMap } = fxRow({
      Symbol: 'CHF.USD',
      CurrencyPrimary: 'USD',
      Quantity: '-90',
      TradePrice: '1.2578',
      Proceeds: '113.202',
      IBCommission: '-1.5882',
    });
    const fx = mapTradeRow(fields, headerMap);
    expect(fx.kind).toBe('fx');
    expect(fx.pairBase).toBe('CHF');
    expect(fx.quoteCurrency).toBe('USD');
    expect(fx.qty).toBe(-90);
    expect(fx.rate).toBeCloseTo(1 / 1.2578, 6);
    expect(fx.usdQty).toBe(0); // le flux legacy reste USD.CHF only
  });

  it('OPT : NetCash et devise capturés (transients reconstruction)', () => {
    const { fields, headerMap } = row({
      LevelOfDetail: 'ORDER',
      AssetClass: 'OPT',
      'Put/Call': 'C',
      'Buy/Sell': 'BUY',
      'Open/CloseIndicator': 'O',
      Symbol: 'BAC 260618C00055000',
      UnderlyingSymbol: 'BAC',
      CurrencyPrimary: 'USD',
      FXRateToBase: '0.77731',
      DateTime: '20260309;151251',
      Quantity: '7',
      Multiplier: '100',
      Strike: '55',
      Expiry: '20260618',
      TradePrice: '0.65',
      IBCommission: '-4.88565',
      NetCash: '-459.88565',
      CostBasis: '459.88565',
      Proceeds: '-455',
      FifoPnlRealized: '0',
      TradeID: 'T1',
      TransactionID: 'X1',
      ClosePrice: '0.7',
    });
    const mapped = mapTradeRow(fields, headerMap);
    expect(mapped.kind).toBe('trade');
    expect(mapped.trade._ibkrNetCash).toBe(-459.88565);
    expect(mapped.trade._ibkrCurrency).toBe('USD');
  });
});
