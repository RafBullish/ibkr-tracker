// ═══════════════════════════════════════════════════════════════
//  FIFO pairing of opening and closing IBKR trades.
//
//  A Flex CSV exports each execution separately ("ORDER" level). To
//  reconstruct what the user sees as a "closed trade" on the tracker,
//  we pair opens (O) with closes (C) in FIFO order per contract key.
//
//  A3a — buildClosedTrades now accepts a `historicalOpens` pool : the
//  open positions persisted from previous imports (currentState
//  .openPositions). They are normalized and merged into the FIFO bucket
//  alongside the intra-CSV opens so that a close in the current CSV can
//  match an open that arrived in a separate import. Before A3a, such
//  closes silently dropped into the CostBasis fallback (entryDate
//  reconstructed as close.di — WRONG — and entryFee lost).
// ═══════════════════════════════════════════════════════════════

import { sf } from './csvReader';
import { dteAtEntry } from '../dates';

function contractKey(t) {
  return `${t.tk}|${t.ty}|${t.st}|${t.ex}`;
}

/**
 * Convert tracker-shaped open positions (currentState.openPositions) into
 * the trade-row shape consumed by `matchOpens`. Stocks and options both
 * use a single-lot synthetic trade with `_remaining = ct`.
 *
 * Side effect : the synthetic open carries `_isHistorical = true` so the
 * downstream consumer can flag it in logs / UI if needed.
 */
function normalizeHistoricalOpens(openPositions) {
  if (!Array.isArray(openPositions)) return [];
  return openPositions.map((p) => ({
    tk: p.tk,
    ty: p.ty,
    st: p.st,
    ex: p.ex,
    di: p.di,
    pi: p.pi,
    fi: p.fi,
    ct: p.ct,
    mu: p.mu,
    fxi: p.fxi,
    _ibkrOpenClose: 'O',
    _remaining: sf(p.ct),
    _isHistorical: true,
  }));
}

/** Bucket raw trades by contract key, tagged as open or close. */
function bucketize(trades, historicalOpens = []) {
  const opensByKey = {};
  const closes = [];
  // Seed the bucket with historical opens first so intra-CSV opens are
  // appended AFTER them. FIFO order then naturally consumes the oldest
  // (historical) open before the newer (intra-CSV) one — matches the
  // tracker's "first in, first out" semantics across imports.
  for (const o of historicalOpens) {
    const key = contractKey(o);
    if (!opensByKey[key]) opensByKey[key] = [];
    opensByKey[key].push(o);
  }
  for (const t of trades) {
    const key = contractKey(t);
    let oc = t._ibkrOpenClose;
    if (!oc || (oc !== 'O' && oc !== 'C')) {
      // Fallback for stocks when IBKR doesn't emit an Open/CloseIndicator.
      oc = t._ibkrBuySell === 'SELL' ? 'C' : 'O';
    }
    if (oc === 'O') {
      if (!opensByKey[key]) opensByKey[key] = [];
      opensByKey[key].push({ ...t, _remaining: sf(t.ct) });
    } else if (oc === 'C') {
      closes.push(t);
    }
  }
  return { opensByKey, closes };
}

/** Run FIFO matching against the opens array for one close. */
function matchOpens(close, opens) {
  const closeQty = sf(close.ct);
  let entryPriceSum = 0,
    entryFxSum = 0,
    entryFee = 0,
    entryDate = '';
  let totalMatched = 0,
    remaining = closeQty;

  for (const open of opens) {
    if (remaining <= 0) break;
    if (open._remaining <= 0) continue;
    const matched = Math.min(remaining, open._remaining);
    const openQty = sf(open.ct);
    entryPriceSum += sf(open.pi) * matched;
    entryFxSum += sf(open.fxi) * matched;
    entryFee += sf(open.fi) * (openQty > 0 ? matched / openQty : 0);
    if (!entryDate) entryDate = open.di;
    totalMatched += matched;
    open._remaining -= matched;
    remaining -= matched;
  }

  if (totalMatched > 0) {
    return {
      entryPrice: entryPriceSum / totalMatched,
      entryFx: entryFxSum / totalMatched,
      entryFee,
      entryDate,
      matched: true,
    };
  }
  // A3a — Fallback when no open survives in the bucket (neither
  // intra-CSV nor historical). Reconstruct from CostBasis with explicit
  // guards : `mu === 0` is anomalous (an option without multiplier) and
  // previously yielded a silent 0 entryPrice → massively wrong pnl when
  // _ibkrFifoPnl was also 0. We now log to `_fallbackReason` so the
  // synthetic closed-trade row carries the explanation downstream.
  const mul = sf(close.mu);
  const costBasis = Math.abs(close._ibkrCostBasis);
  let entryPrice = 0;
  let fallbackReason;
  if (!(closeQty > 0)) {
    fallbackReason = 'closeQty<=0';
  } else if (!(mul > 0)) {
    fallbackReason = 'mu<=0 (anomalous : option without multiplier)';
  } else {
    entryPrice = costBasis / (closeQty * mul);
    fallbackReason = 'no_matching_open';
  }
  return {
    entryPrice,
    entryFx: sf(close.fxi),
    entryFee: 0,
    entryDate: close.di,
    matched: false,
    fallbackReason,
  };
}

/**
 * Build the list of closed trades from the raw ORDER-level trades.
 * Output matches the tracker's closedTrade shape.
 *
 * @param {Array} trades — current-CSV trade rows.
 * @param {Array} [historicalOpens] — opens persisted from previous imports
 *   (e.g. currentState.openPositions). Optional ; pass [] from contexts
 *   that don't have access to the current state (back-compat).
 */
export function buildClosedTrades(trades, historicalOpens = []) {
  const normalizedHistorical = normalizeHistoricalOpens(historicalOpens);
  const { opensByKey, closes } = bucketize(trades, normalizedHistorical);
  const closedTrades = [];

  for (const close of closes) {
    const opens = opensByKey[contractKey(close)] || [];
    const m = matchOpens(close, opens);

    const dir = close._ibkrBuySell === 'SELL' ? 'Long' : 'Short';
    const exitFee = sf(close.fi);
    const totalCommissions = m.entryFee + exitFee;

    // Prefer IBKR's authoritative FifoPnlRealized when available.
    let pnlUsd;
    if (close._ibkrFifoPnl !== 0) {
      pnlUsd = close._ibkrFifoPnl;
    } else {
      const gross = (sf(close.pi) - m.entryPrice) * sf(close.ct) * sf(close.mu);
      pnlUsd = dir === 'Short' ? -gross - totalCommissions : gross - totalCommissions;
    }

    closedTrades.push({
      as: close.as,
      dir,
      tk: close.tk,
      ty: close.ty,
      st: close.st,
      ex: close.ex,
      di: m.entryDate,
      do: close.di, // close date
      ct: String(sf(close.ct)),
      mu: close.mu,
      pi: String(m.entryPrice),
      po: close.pi,
      fi: String(m.entryFee),
      fo: String(exitFee),
      fxi: String(m.entryFx),
      fxo: close.fxi,
      pnl: String(pnlUsd),
      cm: String(totalCommissions),
      // Greeks-at-entry — see TRADE SHAPE doc in store/migrations.js.
      // dteAtEntry computed here from the FIFO-paired entry date.
      // delta/iv/ivRank stay null until a historical-spot source is branched.
      dteAtEntry: dteAtEntry(m.entryDate, close.ex),
      deltaAtEntry: null,
      ivAtEntry: null,
      ivRankAtEntry: null,
      exitReason: null,
      // A3a — when this row falls back to CostBasis reconstruction, the
      // reason is preserved so consumers (or future stats) can surface
      // how many trades are partially reconstructed.
      _fifoFallbackReason: m.matched ? null : m.fallbackReason || 'no_matching_open',
    });
  }

  return closedTrades;
}

/** Enrich each open position with its opening trade lots + aggregate fees/FX. */
export function enrichPositionsWithTrades(positions, trades) {
  const openingTrades = trades.filter((t) => t._ibkrOpenClose === 'O');

  for (const pos of positions) {
    const matching = openingTrades.filter(
      (t) =>
        t.tk === pos.tk && t.as === pos.as && t.ty === pos.ty && t.st === pos.st && t.ex === pos.ex
    );
    if (matching.length === 0) continue;

    pos.lots = matching.map((t) => ({
      ct: t.ct,
      pi: t.pi,
      fi: t.fi,
      di: t.di,
      fxi: t.fxi,
    }));
    pos.di = matching[0].di;
    pos.fi = String(matching.reduce((s, t) => s + sf(t.fi), 0).toFixed(5));
    // Now that `di` is known, compute the DTE-at-entry for this position.
    pos.dteAtEntry = dteAtEntry(pos.di, pos.ex);

    const mul = sf(pos.mu);
    let tw = 0,
      wfs = 0;
    matching.forEach((t) => {
      const w = Math.abs(sf(t.pi) * mul * sf(t.ct));
      tw += w;
      wfs += sf(t.fxi) * w;
    });
    if (tw > 0) pos.fxi = String((wfs / tw).toFixed(5));
  }
}
