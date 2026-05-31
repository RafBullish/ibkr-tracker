// ═══════════════════════════════════════════════════════════════
//  Single source of truth for time-based magic numbers.
//  - POLLING:  setInterval refresh cadence
//  - DEBOUNCE: trailing edge for store persistence + UI input
//  - TIME:     human-readable durations re-used in calcs
// ═══════════════════════════════════════════════════════════════

export const TIME = {
  ONE_SECOND_MS: 1_000,
  ONE_MINUTE_MS: 60_000,
  TWO_MINUTES_MS: 120_000,
  ONE_HOUR_MS: 3_600_000,
};

export const POLLING = {
  // useApiStatus: how often we recheck the upstream health probe.
  API_STATUS_MS: TIME.TWO_MINUTES_MS,
  // Market quotes refresh — Positions, useMarketQuotes hook.
  MARKET_QUOTES_MS: TIME.ONE_MINUTE_MS,
  // Wall-clock NY time refresh (market status badge).
  NY_CLOCK_MS: TIME.ONE_MINUTE_MS,
  // Local IBKR bridge poll — useIbkrLive hook hits /ibkr/account (proxied to
  // bridge/serve.py on 127.0.0.1:8765). Aligned with bridge/ibkr_poller.py's
  // own 5 s refresh so the end-to-end cadence stays coherent.
  IBKR_LIVE_MS: 5_000,
};

export const DEBOUNCE = {
  // settings persist after a brief debounce so SYNC_IBKR's batched writes
  // collapse into a single localStorage call.
  SETTINGS_PERSIST_MS: 150,
  // larger arrays (positions, closedTrades, journalEntries) — debounce more
  // aggressively, JSON.stringify is expensive on big payloads.
  DATA_PERSIST_MS: 500,
};

// Live-data freshness threshold: any IBKR live snapshot older than this
// is treated as "stale" and the badge falls back to "real" / "paper".
export const FRESHNESS = {
  LIVE_DATA_MAX_AGE_MS: TIME.ONE_HOUR_MS,
};
