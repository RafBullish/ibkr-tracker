// ═══════════════════════════════════════════════════════════════
//  Merge parsed IBKR data into the current tracker state.
//
//  Strategy: key each entity with a deterministic signature and drop
//  rows whose signature already exists in currentState. Metadata with
//  a leading underscore (internal IBKR identifiers) is stripped before
//  persisting so we don't leak it back to the user on subsequent loads.
// ═══════════════════════════════════════════════════════════════

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
  const existingTradeKeys = new Set(currentState.closedTrades.map(closedTradeKey));
  const newClosedTrades = [];
  for (const ct of parsed.closedTrades || []) {
    if (existingTradeKeys.has(closedTradeKey(ct))) {
      stats.closedTradesSkipped++;
    } else {
      newClosedTrades.push(ct);
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
