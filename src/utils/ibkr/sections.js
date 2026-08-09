// ═══════════════════════════════════════════════════════════════
//  Section detection + per-row mappers for IBKR Flex Query CSVs.
//
//  An IBKR Flex CSV is a concatenation of multiple tabular sections,
//  each introduced by a header row. `identifySection` recognizes a
//  header by its column signature; the row mappers (mapPositionRow,
//  mapTradeRow, mapCashTxnRow, mapCashReportRow, mapFxRateRow) then
//  turn individual rows into tracker-shaped records.
// ═══════════════════════════════════════════════════════════════

import { sf, isoDate, isoDateFromDateTime } from './csvReader';

/**
 * Return the section id for a header row, or null if the row isn't a
 * recognized section header.
 */
export function identifySection(headers) {
  // NAV (Net Asset Value / Change in NAV) : ReportDate + colonne de
  // valeur liquidative (Total ou EndingValue). Testée EN PREMIER : la
  // signature cashTransactions (Amount+Type) est vorace et plusieurs
  // sections portent ReportDate — les exclusions verrouillent le match.
  if (
    headers.includes('ReportDate') &&
    (headers.includes('Total') || headers.includes('EndingValue')) &&
    !headers.includes('TradeID') &&
    !headers.includes('MarkPrice') &&
    !headers.includes('Amount') &&
    !headers.includes('StartingCash')
  ) {
    return 'nav';
  }
  // FX Rates: "Date/Time","FromCurrency","ToCurrency","Rate"
  if (headers[0] === 'Date/Time' && headers.includes('FromCurrency') && headers.includes('Rate')) {
    return 'fxRates';
  }
  // Cash Transactions: has "Amount" + "Type" + no "TradePrice"
  if (headers.includes('Amount') && headers.includes('Type') && !headers.includes('TradePrice')) {
    return 'cashTransactions';
  }
  // Trades: has "TradeID" + "TradePrice"
  if (headers.includes('TradeID') && headers.includes('TradePrice')) {
    return 'trades';
  }
  // Open Positions: has "Quantity" + "MarkPrice" + "PositionValue"
  if (headers.includes('MarkPrice') && headers.includes('PositionValue')) {
    return 'openPositions';
  }
  // Cash Report: has "StartingCash" + "EndingCash"
  if (headers.includes('StartingCash') && headers.includes('EndingCash')) {
    return 'cashReport';
  }
  return null;
}

function makeGetter(headerMap, fields) {
  return (col) => {
    const idx = headerMap[col];
    return idx !== undefined ? fields[idx] || '' : '';
  };
}

/**
 * Map une row de section NAV → `{ date, total, currency }` en devise de
 * base, ou null. Le champ de valeur est Total (section « Net Asset
 * Value », une row par ReportDate) ou EndingValue (« Change in NAV »).
 */
export function mapNavRow(fields, headerMap) {
  const get = makeGetter(headerMap, fields);
  const date = isoDate(get('ReportDate'));
  const raw = get('Total') !== '' ? get('Total') : get('EndingValue');
  if (!date || raw === '') return null;
  return { date, total: sf(raw), currency: get('CurrencyPrimary') };
}

/** Map an Open Positions row into a tracker openPosition shape. Returns null if the row should be skipped. */
export function mapPositionRow(fields, headerMap, skipStats) {
  const get = makeGetter(headerMap, fields);
  const level = get('LevelOfDetail');
  const assetClass = get('AssetClass');
  if (level !== 'SUMMARY' && level !== 'LOT') {
    if (skipStats) {
      const bucket = level === 'POSITION' ? 'POSITION' : 'OTHER';
      skipStats.byLevel[bucket] = (skipStats.byLevel[bucket] || 0) + 1;
    }
    return null;
  }
  if (assetClass !== 'OPT' && assetClass !== 'STK') {
    if (skipStats) {
      const bucket = assetClass === 'CASH' ? 'CASH' : 'OTHER';
      skipStats.byAssetClass[bucket] = (skipStats.byAssetClass[bucket] || 0) + 1;
    }
    return null;
  }

  const isOption = assetClass === 'OPT';
  const putCall = get('Put/Call');
  const qty = sf(get('Quantity'));
  const side = get('Side');

  return {
    as: isOption ? 'Option' : 'Action',
    dir: side === 'Short' ? 'Short' : 'Long',
    tk: get('UnderlyingSymbol') || get('Symbol'),
    ty: isOption ? (putCall === 'P' ? 'PUT' : 'CALL') : '',
    st: isOption ? String(sf(get('Strike'))) : '',
    ex: isOption ? isoDate(get('Expiry')) : '',
    di: '',
    ct: String(Math.abs(qty)),
    mu: String(sf(get('Multiplier')) || (isOption ? 100 : 1)),
    pi: String(sf(get('CostBasisPrice'))),
    pc: String(sf(get('MarkPrice'))),
    fi: '0',
    fxi: String(sf(get('FXRateToBase'))),
    rk: '0',
    su: '',
    lots: [],
    // Greeks-at-entry scaffolding — see TRADE SHAPE doc in store/migrations.js.
    // dteAtEntry is filled by enrichPositionsWithTrades once `di` is set.
    dteAtEntry: null,
    deltaAtEntry: null,
    ivAtEntry: null,
    ivRankAtEntry: null,
    exitReason: null,
    _ibkrConid: get('Conid'),
    _ibkrSymbol: get('Symbol'),
    _ibkrUnrealized: sf(get('FifoPnlUnrealized')),
    _level: level,
  };
}

/**
 * Map a Trades row. Returns either `{ kind: 'trade', trade }` for OPT/STK,
 * `{ kind: 'fx', date, rate, usdQty, chfAmount }` for CASH USD.CHF conversions,
 * or `{ kind: 'skip' }` for anything else.
 */
export function mapTradeRow(fields, headerMap) {
  const get = makeGetter(headerMap, fields);
  const level = get('LevelOfDetail');
  if (level !== 'ORDER') return { kind: 'skip' };

  const assetClass = get('AssetClass');

  if (assetClass === 'CASH') {
    // Exécution forex : Symbol = paire `BASE.QUOTE`. La jambe QUOTE est
    // portée par Proceeds (+ IBCommission) en CurrencyPrimary, la jambe
    // BASE par Quantity (signée) — NetCash est à 0 sur ces rows.
    const symbol = get('Symbol');
    const [pairBase, pairQuote] = symbol.split('.');
    if (!pairBase || !pairQuote) return { kind: 'skip' };
    const price = sf(get('TradePrice'));
    const quoteCurrency = get('CurrencyPrimary') || pairQuote;
    // Taux USD→CHF daté, quel que soit le sens de la paire.
    let rate = 0;
    if (pairBase === 'USD' && pairQuote === 'CHF') rate = price;
    else if (pairBase === 'CHF' && pairQuote === 'USD' && price > 0) rate = 1 / price;
    return {
      kind: 'fx',
      date: isoDateFromDateTime(get('DateTime')),
      rate,
      pairBase,
      quoteCurrency,
      qty: sf(get('Quantity')),
      proceeds: sf(get('Proceeds')),
      commission: sf(get('IBCommission')),
      commissionCurrency: get('IBCommissionCurrency') || quoteCurrency,
      fxToBase: sf(get('FXRateToBase')),
      // Legacy fx_buy_usd (achats d'USD via USD.CHF uniquement) —
      // sémantique du flux synthétique inchangée.
      usdQty: pairBase === 'USD' ? sf(get('Quantity')) : 0,
      chfAmount: pairBase === 'USD' ? sf(get('TradeMoney')) : 0,
    };
  }

  if (assetClass !== 'OPT' && assetClass !== 'STK') return { kind: 'skip' };

  const isOption = assetClass === 'OPT';
  const putCall = get('Put/Call');
  const qty = sf(get('Quantity'));
  const buySell = get('Buy/Sell');
  const openClose = get('Open/CloseIndicator');

  return {
    kind: 'trade',
    trade: {
      as: isOption ? 'Option' : 'Action',
      dir: buySell === 'SELL' ? 'Short' : 'Long',
      tk: get('UnderlyingSymbol') || get('Symbol'),
      ty: isOption ? (putCall === 'P' ? 'PUT' : 'CALL') : '',
      st: isOption ? String(sf(get('Strike'))) : '',
      ex: isOption ? isoDate(get('Expiry')) : '',
      di: isoDateFromDateTime(get('DateTime')),
      ct: String(Math.abs(qty)),
      mu: String(sf(get('Multiplier')) || (isOption ? 100 : 1)),
      pi: String(sf(get('TradePrice'))),
      fi: String(Math.abs(sf(get('IBCommission')))),
      fxi: String(sf(get('FXRateToBase'))),
      pc: String(sf(get('ClosePrice'))),
      _ibkrTradeId: get('TradeID'),
      _ibkrTransactionId: get('TransactionID'),
      _ibkrOpenClose: openClose,
      _ibkrBuySell: buySell,
      _ibkrCostBasis: sf(get('CostBasis')),
      _ibkrProceeds: sf(get('Proceeds')),
      _ibkrFifoPnl: sf(get('FifoPnlRealized')),
      // Reconstruction NAV (navSeries) : effet cash exact de l'exécution
      // (commission incluse) + devise de la row. Transients — jamais
      // persistés (parsed.trades ne survit pas au merge).
      _ibkrNetCash: sf(get('NetCash')),
      _ibkrCurrency: get('CurrencyPrimary') || 'USD',
    },
  };
}

/**
 * Map a Cash Transactions row. Returns null if the row should be skipped.
 *
 * A2.2 — accepts the granular IBKR Flex `Type` values "Deposits" and
 * "Withdrawals" in addition to the older combined "Deposits/Withdrawals".
 * Real exports use the granular form (Tracker_TEST-2.csv : 6× Type="Deposits"
 * worth 1500 CHF each), so the older filter silently dropped all funding
 * → initialCapital=0 → CAGR/Sharpe/Sortino/Calmar/Vol = "—".
 *
 * Mapping (per currency × per direction) :
 *   CHF + deposit    → 'dep_chf'      (back-compat tag, calculations.js sums)
 *   CHF + withdrawal → 'wit_chf'
 *   USD + deposit    → 'dep_usd'      (NEW — was 'adj_usd' for ambiguous case)
 *   USD + withdrawal → 'wit_usd'      (NEW — was 'fee_usd', semantically wrong)
 *   other currency   → ignored
 *
 * 'adj_usd' / 'fee_usd' are NOT emitted by this mapper anymore but the
 * calculations.js cash-flow loop still recognises them for back-compat
 * with persisted state from previous imports.
 *
 * `da` (date) is preserved so a future IRR / money-weighted-return primitive
 * can honour the schedule of deposits.
 */
export function mapCashTxnRow(fields, headerMap) {
  const get = makeGetter(headerMap, fields);
  const level = get('LevelOfDetail');
  if (level !== 'DETAIL') return null;

  const type = get('Type');
  const currency = get('CurrencyPrimary');
  const amount = sf(get('Amount'));
  const date = isoDate(get('Date/Time'));

  if (amount === 0) return null;

  // Recognise funding rows : granular IBKR types ("Deposits" / "Withdrawals")
  // and the legacy combined type. Any other Type (Dividends, Broker Interest,
  // Withholding Tax, etc.) is intentionally skipped here — they may be
  // captured by future parsers, but they are not "initial capital".
  let direction = null;
  if (type === 'Deposits') direction = 'dep';
  else if (type === 'Withdrawals') direction = 'wit';
  else if (type === 'Deposits/Withdrawals') direction = amount > 0 ? 'dep' : 'wit';
  if (direction === null) return null;

  let cfType;
  if (currency === 'CHF') cfType = direction === 'dep' ? 'dep_chf' : 'wit_chf';
  else if (currency === 'USD') cfType = direction === 'dep' ? 'dep_usd' : 'wit_usd';
  else return null;

  return {
    da: date,
    ty: cfType,
    a1: String(Math.abs(amount)),
    a2: '0',
    _ibkrTransactionId: get('TransactionID'),
  };
}

/**
 * Map une row Cash Transactions vers le canal LEDGER de la reconstruction
 * NAV (navSeries) : TOUT mouvement de caisse daté (Deposits, Withdrawals,
 * Other Fees, Dividends, Broker Interest…), signé, avec sa devise et son
 * taux vers la devise de base. Canal SÉPARÉ de mapCashTxnRow : les
 * cashFlows persistés (ibkr_u_f) ne gardent que le funding — la
 * reconstruction a besoin du cash granulaire complet, en mémoire d'import
 * seulement.
 */
export function mapCashLedgerRow(fields, headerMap) {
  const get = makeGetter(headerMap, fields);
  if (get('LevelOfDetail') !== 'DETAIL') return null;
  const amount = sf(get('Amount'));
  const currency = get('CurrencyPrimary');
  const date = isoDate(get('Date/Time'));
  if (!date || !currency || amount === 0) return null;
  return {
    date,
    currency,
    amount,
    type: get('Type'),
    fxToBase: sf(get('FXRateToBase')),
  };
}

/** Map a Cash Report row. Mutates the supplied `report` accumulator. */
export function mapCashReportRow(fields, headerMap, report) {
  const get = makeGetter(headerMap, fields);
  const level = get('LevelOfDetail');
  const currency = get('CurrencyPrimary');

  // Période du relevé (identité du dataset) : présente sur chaque row
  // du Cash Report — première valeur non vide capturée.
  if (!report.fromDate) {
    const from = isoDate(get('FromDate'));
    if (from) report.fromDate = from;
  }
  if (!report.toDate) {
    const to = isoDate(get('ToDate'));
    if (to) report.toDate = to;
  }

  if (level === 'Currency' && currency) {
    if (!report.currencies) report.currencies = {};
    report.currencies[currency] = {
      endingCash: sf(get('EndingCash')),
      startingCash: sf(get('StartingCash')),
      // A2.2 — preserve per-currency Deposits/Withdrawals when present.
      // Some IBKR Flex layouts expose them at the Currency level too.
      deposits: sf(get('Deposits')),
      withdrawals: sf(get('Withdrawals')),
    };
  } else if (level === 'BaseCurrency') {
    // A2.2 — capture the base currency code so downstream consumers know
    // whether the BaseCurrency aggregates are in CHF or USD (or other).
    // CurrencyPrimary may be set at BaseCurrency rows by some Flex exports.
    if (currency) report.baseCurrency = currency;
    report.startingCash = sf(get('StartingCash'));
    report.endingCash = sf(get('EndingCash'));
    report.deposits = sf(get('Deposits'));
    report.withdrawals = sf(get('Withdrawals'));
    report.commissions = sf(get('Commissions'));
    report.netTradesSales = sf(get('NetTradesSales'));
    report.netTradesPurchases = sf(get('NetTradesPurchases'));
  }
}

/** Map an FX Rates row. Returns null if the row isn't a USD→CHF entry. */
export function mapFxRateRow(fields, headerMap) {
  const get = makeGetter(headerMap, fields);
  const from = get('FromCurrency');
  const to = get('ToCurrency');
  const rate = sf(get('Rate'));
  const date = isoDate(get('Date/Time'));
  if (from === 'USD' && to === 'CHF' && rate > 0 && date) return { date, rate };
  return null;
}
