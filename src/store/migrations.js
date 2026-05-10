// ═══════════════════════════════════════════════════════════════
//  DATA SCHEMA MIGRATIONS
//
//  Persisted data carries a schema version stored in localStorage under
//  `ibkr_schema_v`. On load we walk `MIGRATIONS` forward from the stored
//  version to CURRENT_SCHEMA_VERSION, applying each step in order.
//
//  Rules:
//   - Each migration is a pure `(state) => state` — do NOT mutate in place.
//   - Never delete a previous migration: users with old data depend on it.
//   - Bump CURRENT_SCHEMA_VERSION when adding a new migration, and append
//     it to MIGRATIONS at the next index.
//
// ───────────────────────────────────────────────────────────────
//  TRADE SHAPE — v2 (post Lot 2 / Brique 2)
//
//  Two entity types share most of their fields because both describe an
//  option or stock position. Open positions track the live book, closed
//  trades track the realized history. Any field not documented here is
//  legacy and should not be introduced in new code.
//
//  Shared core (Position AND ClosedTrade)
//  ──────────────────────────────────────
//  Field           | Type        | Nullable | Origin                      | Example
//  id              | string      | no       | reducer (ADD_*)             | "aB3kP9"
//  as              | 'Option' |  | no       | parser / v1 backfill        | "Option"
//                    'Action'                                              | "Action"
//  dir             | 'Long' |    | no       | parser / v1 backfill        | "Long"
//                    'Short'
//  tk              | string      | no       | parser (UnderlyingSymbol)   | "NVDA"
//  ty              | 'CALL' |    | no       | parser                      | "CALL"
//                    'PUT' | ''            (empty for stocks)
//  st              | string      | no       | parser                      | "500"
//                    (numeric-as-string;   (empty for stocks)
//                     legacy shape)
//  ex              | string      | no       | parser                      | "2026-01-16"
//                    ISO date              (empty for stocks)
//  ct              | string      | no       | parser                      | "1"
//  mu              | string      | no       | parser / v1 backfill        | "100"
//  pi              | string      | no       | parser                      | "5.25"
//                    (entry premium,
//                     option dollars per share)
//  fi              | string      | no       | parser                      | "0.65"
//                    (entry commission USD)
//  fxi             | string      | no       | parser / v1 backfill        | "0.89"
//                    (USD→CHF rate at entry)
//  dteAtEntry      | number|null | yes      | v2 migration / parser       | 128
//                    (days from di to ex)  (null when either date missing)
//  deltaAtEntry    | number|null | yes      | always null until the      | null
//                    Δ at entry             underlying spot is branched
//                                           (see FIELDS AWAITING SPOT below)
//  ivAtEntry       | number|null | yes      | always null, same reason   | null
//                    (σ fraction)
//  ivRankAtEntry   | number|null | yes      | always null, same reason   | null
//                    (0-100)
//  exitReason      | string|null | yes      | null until Lot 2 Brique 4  | null
//                    'tp_50' | 'sl_35' |
//                    'dte_45' | 'pre_earnings' |
//                    'stagnation' | 'manual' |
//                    'unknown'
//
//  Open Position only
//  ──────────────────
//  di              | string      | yes      | enrichment (first lot date) | "2025-03-15"
//                    ISO date              (empty when no matching trade)
//  pc              | string      | no       | parser (MarkPrice)          | "6.40"
//                    (current / mark price)
//  rk              | string      | yes      | legacy, '0' default         | "0"
//                    (risk placeholder)
//  su              | string      | yes      | legacy, '' default          | ""
//                    (strategy tag placeholder — unused)
//  lots            | Array<Lot>  | no       | parser / v1 backfill        | [{ct,pi,fi,di,fxi}]
//  _ibkrConid      | string      | yes      | parser, stripped on merge   | "12345"
//  _ibkrSymbol     | string      | yes      | parser, stripped on merge   | "NVDA 240119C00500000"
//  _ibkrUnrealized | number      | yes      | parser, stripped on merge   | 120.50
//  _level          | 'SUMMARY' | | yes      | parser, stripped after dedup | "SUMMARY"
//                    'LOT'
//
//  Closed Trade only
//  ─────────────────
//  di              | string      | no       | FIFO pairing (entry date)   | "2025-03-15"
//                    ISO date
//  do              | string      | no       | parser (close date)         | "2025-06-20"
//                    ISO date
//  po              | string      | no       | parser                      | "7.10"
//                    (exit premium)
//  fo              | string      | no       | parser                      | "0.65"
//                    (exit commission USD)
//  fxo             | string      | no       | parser / v1 backfill        | "0.90"
//                    (USD→CHF rate at exit)
//  pnl             | string      | no       | parser (FifoPnlRealized)    | "185.00"
//                    (USD, signed)
//  cm              | string      | no       | parser (fi + fo)            | "1.30"
//                    (total commissions USD)
//
//  v2 backfill flag (migration only, absent on parser output)
//  ───────────────────────────────────────────────────────────
//  _deltaApproximated | boolean | yes       | v1→v2 migration             | true
//                    The v1→v2 migration flags every pre-existing trade
//                    with this field to mark "Δ / IV backfill attempted
//                    but unavailable — re-run after spot source lands".
//                    Parser output on new imports deliberately omits this
//                    flag: absence means "not attempted", presence means
//                    "attempted, data missing". The distinction feeds a
//                    future re-migration when a historical-spot source
//                    (e.g. Finnhub) is wired in.
//
//  FIELDS AWAITING SPOT
//  ────────────────────
//  deltaAtEntry, ivAtEntry, ivRankAtEntry require the underlying spot
//  at trade time. IBKR Flex does NOT expose this field. Until an external
//  historical quote source is branched, these three stay null on BOTH
//  backfilled and newly imported trades. A later lot will add the fetch
//  + re-migration so old flagged trades get enriched retroactively.
// ═══════════════════════════════════════════════════════════════

import { todayDateString, dteAtEntry } from '../utils/dates';
import { detectExitReason } from '../utils/trades/detectExitReason';
import { generateId } from '../utils/math';

export const SCHEMA_VERSION_KEY = 'ibkr_schema_v';
export const CURRENT_SCHEMA_VERSION = 6;

// ─── Individual migration steps ───────────────────────────────

/**
 * v0 → v1: adds missing `as`, `dir`, `mu`, `fxi`, `lots` on positions and
 * `as`, `dir`, `mu`, `fxi`, `fxo` on closed trades. Purges duplicate cashFlows
 * by (date, type, a1) signature. This mirrors the behavior of the previous
 * ad-hoc logic in `loadInitialState`, so anyone's existing data migrates
 * losslessly on the first load after the upgrade.
 */
function migrateV0toV1(state) {
  const dr = state.settings?.liveRate ?? 0.88;

  const openPositions = state.openPositions.map((p) => {
    const next = { ...p };
    if (!next.as) next.as = next.ty === 'CALL' || next.ty === 'PUT' ? 'Option' : 'Action';
    if (!next.dir) next.dir = 'Long';
    if (!next.mu) next.mu = next.as === 'Option' ? '100' : '1';
    if (!next.fxi) next.fxi = String(dr);
    if (!next.lots) {
      next.lots = [
        {
          ct: next.ct,
          pi: next.pi,
          fi: next.fi || '0',
          di: next.di || todayDateString(),
          fxi: next.fxi,
        },
      ];
    }
    return next;
  });

  const closedTrades = state.closedTrades.map((t) => {
    const next = { ...t };
    if (!next.as) next.as = next.ty === 'CALL' || next.ty === 'PUT' ? 'Option' : 'Action';
    if (!next.dir) next.dir = 'Long';
    if (!next.mu) next.mu = next.as === 'Option' ? '100' : '1';
    if (!next.fxi) next.fxi = String(dr);
    if (!next.fxo) next.fxo = String(dr);
    return next;
  });

  // Purge duplicate cashFlows by (date, type, a1)
  const seen = new Set();
  const cashFlows = state.cashFlows.filter((f) => {
    const sig = `${f.da}_${f.ty}_${f.a1}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });

  return { ...state, openPositions, closedTrades, cashFlows };
}

/**
 * v1 → v2: adds the greeks-at-entry scaffolding to every trade and
 * position. Only `dteAtEntry` is actually reconstructible from stored
 * fields; delta / IV / IV-rank stay null because IBKR Flex doesn't
 * ship the underlying spot at trade time. Every migrated record is
 * tagged with `_deltaApproximated: true` so the UI can show an
 * explicit "—" placeholder and a later re-migration can lift the flag
 * once historical spot data is wired in.
 *
 * Idempotent: a record that already carries `dteAtEntry` (e.g. from a
 * new parser import that ran after the version bump) is passed through
 * unchanged.
 */
function migrateV1toV2(state) {
  function annotate(record) {
    if ('dteAtEntry' in record) return record;
    return {
      ...record,
      dteAtEntry: dteAtEntry(record.di, record.ex),
      deltaAtEntry: null,
      ivAtEntry: null,
      ivRankAtEntry: null,
      exitReason: null,
      _deltaApproximated: true,
    };
  }

  return {
    ...state,
    openPositions: state.openPositions.map(annotate),
    closedTrades: state.closedTrades.map(annotate),
  };
}

/**
 * v2 → v3: auto-detect an exit reason for every closed trade that
 * doesn't have one yet. Uses the Sniper OTM rule engine in
 * utils/trades/detectExitReason.js and flags each result with
 * `_exitReasonAutoDetected: true` so the UI can distinguish auto
 * detections from user-confirmed / user-overridden ones.
 *
 * Idempotent: a closed trade that already carries `exitReason != null`
 * is passed through unchanged. Positions are not touched — exit reason
 * is a closed-trade concept.
 */
function migrateV2toV3(state) {
  const closedTrades = state.closedTrades.map((t) => {
    if (t.exitReason != null) return t;
    const { reason } = detectExitReason(t);
    return { ...t, exitReason: reason, _exitReasonAutoDetected: true };
  });
  return { ...state, closedTrades };
}

/**
 * v3 → v4: assign an `id` to every persisted item that's missing one.
 * Earlier Flex imports skipped id generation on cashFlows, and older
 * JSON backups may have no ids either, which broke the per-row delete
 * actions added in the data-management UI pass. Idempotent — items
 * that already carry an id pass through unchanged.
 */
function migrateV3toV4(state) {
  const ensureIds = (arr) =>
    arr.map((item) => (item && item.id ? item : { ...item, id: generateId() }));
  return {
    ...state,
    openPositions: ensureIds(state.openPositions),
    closedTrades: ensureIds(state.closedTrades),
    cashFlows: ensureIds(state.cashFlows),
    journalEntries: ensureIds(state.journalEntries),
  };
}

/**
 * v4 → v5: repair open positions that ended up with an empty `tk`
 * (UnderlyingSymbol) field. Earlier import paths could land a position
 * in the store without populating `tk`, which then surfaces as `—` in the
 * Positions table since the JSX renders `{v || '—'}`.
 *
 * Recovery strategy when `tk` is falsy:
 *   1. If `_ibkrSymbol` survived (e.g. an `IMPORT_DATA` dispatch that
 *      bypassed `mergeIbkrData`'s underscore-stripping pass), parse the
 *      OCC symbol form `"TICKER  YYMMDDC00012345"` — the underlying ticker
 *      is the first whitespace-separated token. Promote it to `tk` and
 *      drop `_ibkrSymbol` so we converge on the canonical shape.
 *   2. Otherwise leave the record untouched. The UI's `—` fallback is the
 *      correct outcome when no source for the ticker exists.
 *
 * Idempotent: positions whose `tk` is already a non-empty string pass
 * through unchanged. Closed trades are not touched — they already carry
 * `tk` reliably and are not subject to the same import-path drift.
 */
function migrateV4toV5(state) {
  const openPositions = state.openPositions.map((pos) => {
    if (pos.tk && String(pos.tk).trim() !== '') return pos;
    if (pos._ibkrSymbol && typeof pos._ibkrSymbol === 'string') {
      const recovered = pos._ibkrSymbol.trim().split(/\s+/)[0];
      if (recovered) {
        const next = { ...pos, tk: recovered };
        delete next._ibkrSymbol;
        return next;
      }
    }
    return pos;
  });
  return { ...state, openPositions };
}

/**
 * v5 → v6: introduce FX state fields on settings.
 *   - fxMode = 'manual' (statu quo, opt-in to 'auto' via Settings UI)
 *   - fxLastUpdated = null (no timestamp until the first successful fetch)
 *   - fxSource = null (idem)
 *
 * `liveRate` is intentionally left untouched. Users with the historic 0.88
 * default keep it; the useFx hook (commit #4) decides whether to refresh
 * at boot based on `fxLastUpdated` being null.
 *
 * Idempotent: a state already carrying `fxMode='auto'` or any explicit
 * timestamp is passed through unchanged. The `== null` check matches both
 * null and undefined so the default kicks in only when truly absent;
 * `=== undefined` on the other two keys lets a user-set null pass through
 * without being re-assigned.
 */
function migrateV5toV6(state) {
  const settings = { ...state.settings };
  if (settings.fxMode == null) settings.fxMode = 'manual';
  if (settings.fxLastUpdated === undefined) settings.fxLastUpdated = null;
  if (settings.fxSource === undefined) settings.fxSource = null;
  return { ...state, settings };
}

// ─── Migration chain ─────────────────────────────────────────
// Index N contains the migration from version N → N+1.

const MIGRATIONS = [
  migrateV0toV1, // 0 → 1
  migrateV1toV2, // 1 → 2
  migrateV2toV3, // 2 → 3
  migrateV3toV4, // 3 → 4
  migrateV4toV5, // 4 → 5
  migrateV5toV6, // 5 → 6
];

// ─── Entry points ────────────────────────────────────────────

export function getStoredVersion() {
  try {
    const raw = localStorage.getItem(SCHEMA_VERSION_KEY);
    if (raw == null) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function setStoredVersion(version) {
  try {
    localStorage.setItem(SCHEMA_VERSION_KEY, String(version));
  } catch {
    /* quota — ignore, next load will retry */
  }
}

/**
 * Apply every migration from `fromVersion` up to CURRENT_SCHEMA_VERSION
 * to the given state and return the upgraded copy.
 */
export function runMigrations(state, fromVersion = 0) {
  let out = state;
  for (let v = fromVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (step) out = step(out);
  }
  return out;
}
