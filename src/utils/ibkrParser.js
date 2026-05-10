// ═══════════════════════════════════════════════════════════════
//  IBKR FLEX QUERY CSV PARSER — facade
//
//  The parsing logic is split across `./ibkr/`:
//    - csvReader.js     — RFC-4180-ish tokenizer + date/number helpers
//    - sections.js      — section detection + per-row mappers
//    - closedTrades.js  — FIFO O/C pairing + position enrichment
//    - merge.js         — dedup merge with the current tracker state
//
//  This file ties them together and exposes the public API consumed
//  by Import.jsx: `parseIbkrCsv` and `mergeIbkrData`.
// ═══════════════════════════════════════════════════════════════

import { parseCsvRows } from './ibkr/csvReader';
import {
  identifySection,
  mapPositionRow,
  mapTradeRow,
  mapCashTxnRow,
  mapCashReportRow,
  mapFxRateRow,
} from './ibkr/sections';
import { buildClosedTrades, enrichPositionsWithTrades } from './ibkr/closedTrades';

export { mergeIbkrData } from './ibkr/merge';

// ─── Main Parser ─────────────────────────────────────────────

/**
 * Parse an IBKR Flex Query CSV into structured sections.
 * @returns { positions[], trades[], closedTrades[], cashFlows[],
 *           fxRates{}, cashReport{}, errors[], stats{} }
 */
export function parseIbkrCsv(csvText) {
  const rows = parseCsvRows(csvText);
  const result = {
    positions: [],
    trades: [],
    closedTrades: [],
    cashFlows: [],
    fxRates: {},
    cashReport: null,
    errors: [],
    stats: {
      totalLines: rows.length,
      sectionsFound: [],
      tradesSkipped: 0,
      fxTradesExtracted: 0,
      fxConversionsImported: 0,
      closedTradesBuilt: 0,
      positionsSkipped: {
        byLevel: { LOT: 0, POSITION: 0, OTHER: 0 },
        byAssetClass: { STK: 0, OPT: 0, CASH: 0, OTHER: 0 },
      },
    },
  };

  const fxConversions = [];
  let currentSection = null;
  let headerMap = {};

  for (let i = 0; i < rows.length; i++) {
    const fields = rows[i];
    if (fields.length < 2) continue;

    const section = identifySection(fields);
    if (section) {
      currentSection = section;
      headerMap = {};
      fields.forEach((h, idx) => {
        headerMap[h] = idx;
      });
      if (!result.stats.sectionsFound.includes(section)) {
        result.stats.sectionsFound.push(section);
      }
      continue;
    }
    if (!currentSection) continue;

    try {
      if (currentSection === 'openPositions') {
        const pos = mapPositionRow(fields, headerMap, result.stats.positionsSkipped);
        if (pos) result.positions.push(pos);
      } else if (currentSection === 'trades') {
        const mapped = mapTradeRow(fields, headerMap);
        if (mapped.kind === 'trade') {
          result.trades.push(mapped.trade);
        } else if (mapped.kind === 'fx') {
          if (mapped.date && mapped.rate > 0) {
            result.fxRates[mapped.date] = mapped.rate;
            result.stats.fxTradesExtracted++;
          }
          if (mapped.date && mapped.usdQty > 0 && mapped.chfAmount !== 0) {
            fxConversions.push({
              date: mapped.date,
              usd: mapped.usdQty,
              chf: Math.abs(mapped.chfAmount),
            });
          }
          result.stats.tradesSkipped++;
        } else {
          result.stats.tradesSkipped++;
        }
      } else if (currentSection === 'cashTransactions') {
        const cf = mapCashTxnRow(fields, headerMap);
        if (cf) result.cashFlows.push(cf);
      } else if (currentSection === 'fxRates') {
        const fx = mapFxRateRow(fields, headerMap);
        if (fx) result.fxRates[fx.date] = fx.rate;
      } else if (currentSection === 'cashReport') {
        if (!result.cashReport) result.cashReport = {};
        mapCashReportRow(fields, headerMap, result.cashReport);
      }
    } catch (err) {
      result.errors.push(`Ligne ${i + 1}: ${err.message}`);
    }
  }

  // Aggregate FX conversions by date → one synthetic cash flow per date.
  if (fxConversions.length > 0) {
    const byDate = {};
    for (const conv of fxConversions) {
      if (!byDate[conv.date]) byDate[conv.date] = { usd: 0, chf: 0 };
      byDate[conv.date].usd += conv.usd;
      byDate[conv.date].chf += conv.chf;
    }
    for (const [date, totals] of Object.entries(byDate)) {
      result.cashFlows.push({
        da: date,
        ty: 'fx_buy_usd',
        a1: String(totals.chf.toFixed(2)),
        a2: String(totals.usd.toFixed(2)),
        _ibkrTransactionId: `fx_agg_${date}`,
      });
      result.stats.fxConversionsImported++;
    }
  }

  // Dedup positions: SUMMARY wins over LOT for same contract key.
  // For multi-LOT cases (rare), we keep the first LOT — works for the
  // one-LOT-per-position Flex Queries we actually use.
  if (result.positions.length > 0) {
    const byKey = new Map();
    for (const pos of result.positions) {
      const k = pos._ibkrConid || `${pos.tk}|${pos.as}|${pos.st}|${pos.ex}|${pos.ty}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(pos);
    }
    const deduped = [];
    for (const group of byKey.values()) {
      const summary = group.find((p) => p._level === 'SUMMARY');
      deduped.push(summary || group[0]);
    }
    for (const p of deduped) delete p._level;
    result.positions = deduped;
  }

  // Enrich positions with opening-trade lots + build closed trades.
  enrichPositionsWithTrades(result.positions, result.trades);
  result.closedTrades = buildClosedTrades(result.trades);
  result.stats.closedTradesBuilt = result.closedTrades.length;

  return result;
}
