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
  // Addendum 2 (21.08) — porte du writer du pic : la fraîcheur jugée est
  // celle de la SOURCE du pc (provenance d'écriture, settings.pcSyncedAt —
  // l'import qui a posé le mark), plus jamais ibkrLiveData.timestamp
  // (bridge ≠ source du pc). Un mid de clôture vieux de 59 min n'est pas
  // un mid de clôture : 1 h est abandonné, 5 min.
  PC_SOURCE_MAX_AGE_MS: 5 * TIME.ONE_MINUTE_MS,
};

// Âge d'AFFICHAGE du dernier point NLV (pastille cockpit + StatusBar, Phase B).
// Distinct de FRESHNESS (seuil bridge, 1 h) : ici c'est la fraîcheur d'un tick
// de flux. < 60 s = LIVE licite ; ≥ 60 s = ambre ; ≥ 5 min = le LIBELLÉ passe
// à « FLUX PÉRIMÉ », la couleur RESTE ambre (le rouge = perte d'argent, jamais
// une péremption — pré-vol Héros 1 LIVE). Hors séance : neutre, « MARCHÉ
// FERMÉ · dernier tick » (cf. utils/formatAge.nlvFluxBadge).
// Addendum 2 (21.08) — seuil LIVE selon la PHASE : LIVE = âge < écriture
// bridge + sondage + 20 s. RTH : 21+20+20 ≈ 60 s. Pré/post : 90+90+20 =
// 200 s (à cadence 90 s, un flux sain peut afficher 3 min d'âge sans
// mentir). « FLUX PÉRIMÉ » à 5 min partout.
export const NLV_AGE = {
  LIVE_MS: TIME.ONE_MINUTE_MS, // RTH : < 60 s → vert (LIVE)
  LIVE_PREPOST_MS: 200_000, // pré/post : < 200 s → vert (LIVE)
  EST_MS: 5 * TIME.ONE_MINUTE_MS, // ≥ 5 min → libellé « FLUX PÉRIMÉ » (ambre)
};

// Fraîcheur FX (seuil ambre 1.G-c, partagé MarketDeck ↔ swap du producteur
// FX) : une ligne fx_rates bridge plus jeune que ce seuil devient LE taux
// (useFxLiveSync) ; plus vieille → repli sur la quote actuelle.
export const FX_AGE = {
  STALE_MS: 10 * TIME.ONE_MINUTE_MS,
};
