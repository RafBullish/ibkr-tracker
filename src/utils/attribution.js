// ═══════════════════════════════════════════════════════════════
//  attribution.js v5 Sprint 7 — closed-trade attribution by tier
//
//  Pure utils that group closed trades by Edge Tier (E0..E4) ×
//  Capital Tier (C1..C5) so PerformanceAttribution can render a
//  5×5 heatmap of per-bucket expectancy.
//
//  Tier resolution per trade :
//    1. Sidecar sniper meta at qc:sniperMeta:{tradeId} (override)
//    2. trade.edgeTier / trade.capitalTier (fixture compat)
//    3. deriveEdgeTier(trade.ivRankAtEntry) — auto E only ; no auto C
//
//  Untagged trades (no edgeTier OR no capitalTier resolvable) are
//  excluded from the matrix and reported as { untaggedCount } so
//  the UI can prompt the user to tag them.
// ═══════════════════════════════════════════════════════════════

import { tradePnlUsd } from './calculations';
import { deriveEdgeTier } from './positions';

const EDGE_KEYS = ['E0', 'E1', 'E2', 'E3', 'E4'];
const CAP_KEYS = ['C1', 'C2', 'C3', 'C4', 'C5'];

function emptyCell() {
  return {
    n: 0,
    totalPnl: 0,
    winCount: 0,
    lossCount: 0,
    avgPnl: 0,
    winRate: 0,
  };
}

/**
 * Build the E×C matrix from closed trades.
 *
 * @param {Array}    closedTrades   list of closed trade objects (shape : ibkr two-letter keys)
 * @param {Object}   [options]
 * @param {Object}   [options.sniperMetaMap] { [tradeId]: { edgeTier, capitalTier } }
 * @param {number}   [options.liveRate]      USD->CHF live rate (defaults 1)
 * @returns {{
 *   matrix: { [E0..E4]: { [C1..C5]: cell } },
 *   untaggedCount: number,
 *   decisive: number,                         // total trades that landed in a cell
 *   bestCell: { edge, cap, avgPnl, n } | null,
 *   worstCell: { edge, cap, avgPnl, n } | null,
 * }}
 */
export function computeEdgeCapitalMatrix(closedTrades, options = {}) {
  const sniperMetaMap = options.sniperMetaMap || {};
  const liveRate = options.liveRate || 1;

  // Initialize empty 5x5 matrix
  const matrix = {};
  for (const e of EDGE_KEYS) {
    matrix[e] = {};
    for (const c of CAP_KEYS) {
      matrix[e][c] = emptyCell();
    }
  }

  let untaggedCount = 0;
  let decisive = 0;

  for (const trade of closedTrades || []) {
    const sidecar = sniperMetaMap[trade.id] || null;
    const ivRank = Number.isFinite(trade.ivRankAtEntry) ? trade.ivRankAtEntry : null;
    const edge = sidecar?.edgeTier || trade.edgeTier || deriveEdgeTier(ivRank);
    const cap = sidecar?.capitalTier || trade.capitalTier || null;

    if (!edge || !cap || !EDGE_KEYS.includes(edge) || !CAP_KEYS.includes(cap)) {
      untaggedCount += 1;
      continue;
    }

    const pnl = tradePnlUsd(trade, liveRate);
    if (!Number.isFinite(pnl)) {
      untaggedCount += 1;
      continue;
    }

    const cell = matrix[edge][cap];
    cell.n += 1;
    cell.totalPnl += pnl;
    if (pnl > 0) cell.winCount += 1;
    else if (pnl < 0) cell.lossCount += 1;
    decisive += 1;
  }

  // Compute averages and win rates per cell
  let bestCell = null;
  let worstCell = null;
  for (const e of EDGE_KEYS) {
    for (const c of CAP_KEYS) {
      const cell = matrix[e][c];
      if (cell.n === 0) {
        cell.avgPnl = 0;
        cell.winRate = 0;
        continue;
      }
      cell.avgPnl = cell.totalPnl / cell.n;
      const decisiveN = cell.winCount + cell.lossCount;
      cell.winRate = decisiveN > 0 ? (cell.winCount / decisiveN) * 100 : 0;
      // Track bests/worsts only for cells with at least 3 trades (statistical
      // floor — single-trade extremes pollute the heatmap headline metrics).
      if (cell.n >= 3) {
        if (!bestCell || cell.avgPnl > bestCell.avgPnl) {
          bestCell = { edge: e, cap: c, avgPnl: cell.avgPnl, n: cell.n };
        }
        if (!worstCell || cell.avgPnl < worstCell.avgPnl) {
          worstCell = { edge: e, cap: c, avgPnl: cell.avgPnl, n: cell.n };
        }
      }
    }
  }

  return { matrix, untaggedCount, decisive, bestCell, worstCell };
}

export const ATTRIBUTION_EDGE_KEYS = EDGE_KEYS;
export const ATTRIBUTION_CAP_KEYS = CAP_KEYS;
