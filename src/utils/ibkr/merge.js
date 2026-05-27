// ═══════════════════════════════════════════════════════════════
//  Merge parsed IBKR data into the current tracker state.
//
//  Strategy: key each entity with a deterministic signature and drop
//  rows whose signature already exists in currentState. Metadata with
//  a leading underscore (internal IBKR identifiers) is stripped before
//  persisting so we don't leak it back to the user on subsequent loads.
//
//  A3a — closedTrades are rebuilt here with `currentState.openPositions`
//  as the historical opens pool, so a close in the current CSV can match
//  an open imported in a prior CSV. parseIbkrCsv produces `parsed
//  .closedTrades` with intra-CSV opens only (back-compat) ; mergeIbkrData
//  overrides it with the inter-CSV-aware version.
// ═══════════════════════════════════════════════════════════════

import { buildClosedTrades } from './closedTrades';

function positionKey(p) {
  return `${p.tk}|${p.as}|${p.dir}|${p.ty}|${p.st}|${p.ex}`;
}

function closedTradeKey(t) {
  return `${t.tk}|${t.ty}|${t.st}|${t.ex}|${t.do || ''}|${t.ct}`;
}

function cashFlowKey(cf) {
  return `${cf.da}|${cf.ty}|${cf.a1}`;
}

export function mergeIbkrData(parsed, currentState) {
  const stats = {
    positionsAdded: 0,
    positionsSkipped: 0,
    closedTradesAdded: 0,
    closedTradesSkipped: 0,
    cashFlowsAdded: 0,
    cashFlowsSkipped: 0,
    fxRateUpdated: false,
  };

  // ── Open positions ──
  const existingPosKeys = new Set(currentState.openPositions.map(positionKey));
  const newPositions = [];
  for (const pos of parsed.positions) {
    if (existingPosKeys.has(positionKey(pos))) {
      stats.positionsSkipped++;
    } else {
      const clean = { ...pos };
      delete clean._ibkrConid;
      delete clean._ibkrSymbol;
      delete clean._ibkrUnrealized;
      newPositions.push(clean);
      stats.positionsAdded++;
    }
  }

  // ── Cash flows ──
  const existingCfKeys = new Set(currentState.cashFlows.map(cashFlowKey));
  const newCashFlows = [];
  for (const cf of parsed.cashFlows) {
    if (existingCfKeys.has(cashFlowKey(cf))) {
      stats.cashFlowsSkipped++;
    } else {
      const clean = { ...cf };
      delete clean._ibkrTransactionId;
      newCashFlows.push(clean);
      stats.cashFlowsAdded++;
    }
  }

  // ── Closed trades ──
  // A3a — rebuild closedTrades with inter-CSV FIFO matching. The current
  // CSV's raw trades (parsed.trades) are paired with the union of
  // intra-CSV opens AND historical opens from currentState.openPositions.
  // This rescues closes that previously fell into the CostBasis fallback
  // because their matching open lived in a prior import.
  const rebuiltClosedTrades = Array.isArray(parsed.trades)
    ? buildClosedTrades(parsed.trades, currentState.openPositions)
    : parsed.closedTrades || [];
  const fifoStats = rebuiltClosedTrades.reduce(
    (acc, ct) => {
      if (ct._fifoFallbackReason) acc.fallback++;
      else acc.matched++;
      return acc;
    },
    { matched: 0, fallback: 0 }
  );
  stats.fifoMatched = fifoStats.matched;
  stats.fifoFallback = fifoStats.fallback;

  const existingTradeKeys = new Set(currentState.closedTrades.map(closedTradeKey));
  const newClosedTrades = [];
  for (const ct of rebuiltClosedTrades) {
    if (existingTradeKeys.has(closedTradeKey(ct))) {
      stats.closedTradesSkipped++;
    } else {
      // Strip the diagnostic field before persisting — it's a transient
      // marker for the import-time decision, not a long-lived attribute.
      const clean = { ...ct };
      delete clean._fifoFallbackReason;
      newClosedTrades.push(clean);
      stats.closedTradesAdded++;
    }
  }

  // ── FX rate: use the latest from parsed data ──
  const fxDates = Object.keys(parsed.fxRates).sort();
  let newLiveRate = null;
  if (fxDates.length > 0) {
    newLiveRate = parsed.fxRates[fxDates[fxDates.length - 1]];
    stats.fxRateUpdated = true;
  }

  // ── Cash report: store endingCash in settings ──
  const cashReportSettings = parsed.cashReport?.endingCash ? { cashReport: parsed.cashReport } : {};

  return {
    mergedData: {
      openPositions: [...currentState.openPositions, ...newPositions],
      closedTrades: [...currentState.closedTrades, ...newClosedTrades],
      cashFlows: [...currentState.cashFlows, ...newCashFlows],
      journalEntries: currentState.journalEntries,
      settings: {
        ...(newLiveRate ? { liveRate: newLiveRate } : {}),
        ...cashReportSettings,
      },
    },
    stats,
  };
}
