// @ts-check
// ═══════════════════════════════════════════════════════════════
//  metrics — barrel export of the canonical risk-adjusted-performance
//  primitives. Single source per metric, owned by these modules.
//  Consumed by src/utils/calculations.js and src/hooks/useTradingMetrics.js.
// ═══════════════════════════════════════════════════════════════

export { computeMaxDrawdown } from './computeMaxDrawdown';
export { computeWinRate } from './computeWinRate';
export { computeProfitFactor } from './computeProfitFactor';
export { computeSharpe } from './computeSharpe';
export { computeSortino } from './computeSortino';
export { computeCAGR, cagrMode } from './computeCAGR';
export { computeCalmar } from './computeCalmar';
export { computeRecoveryFactor } from './computeRecoveryFactor';
// A2a additions — equity-curve cluster
export { buildEquitySeries } from './equitySeries';
export { computeVolatility } from './computeVolatility';
// A3b additions — equity timeline + TWR
export { buildEquityTimeline, extractFundingFlows } from './equityTimeline';
export { computeTWR } from './computeTWR';
