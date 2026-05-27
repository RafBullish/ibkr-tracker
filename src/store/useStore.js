// ═══════════════════════════════════════════════════════════════
//  ZUSTAND STORE — Central state with localStorage persistence
//  Granular selectors only — pages subscribe to the slice they need.
// ═══════════════════════════════════════════════════════════════

import { create } from 'zustand';
import {
  CURRENT_SCHEMA_VERSION,
  getStoredVersion,
  setStoredVersion,
  runMigrations,
} from './migrations';
import { applyAction } from './reducer';
import { DEBOUNCE } from '../constants/timing';

// ─── Storage Keys ────────────────────────────────────────────

const STORAGE_KEYS = {
  openPositions: 'ibkr_u_o',
  closedTrades: 'ibkr_u_c',
  cashFlows: 'ibkr_u_f',
  journalEntries: 'ibkr_u_j',
  settings: 'ibkr_u_s',
};

function safeParse(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

// ─── Load from localStorage ──────────────────────────────────

function loadInitialState() {
  const openPositions = safeParse(STORAGE_KEYS.openPositions, []);
  const closedTrades = safeParse(STORAGE_KEYS.closedTrades, []);
  const cashFlows = safeParse(STORAGE_KEYS.cashFlows, []);
  const journalEntries = safeParse(STORAGE_KEYS.journalEntries, []);

  const settings = {
    liveRate: 0.88,
    fxMode: 'manual',
    fxLastUpdated: null,
    fxSource: null,
    dailySnapshots: [],
  };
  const s = safeParse(STORAGE_KEYS.settings, null);
  if (s) {
    if (s.r) settings.liveRate = s.r;
    if (s.rm) settings.fxMode = s.rm;
    if (s.rt) settings.fxLastUpdated = s.rt;
    if (s.rs) settings.fxSource = s.rs;
    if (s.cashReport) settings.cashReport = s.cashReport;
    if (s.lastSync) settings.lastSync = s.lastSync;
    if (s.ibkrLiveData) settings.ibkrLiveData = s.ibkrLiveData;
    if (s.ibkrSummary) settings.ibkrSummary = s.ibkrSummary;
    if (s.ibkrLedger) settings.ibkrLedger = s.ibkrLedger;
    if (s.gwAutoConnect !== undefined) settings.gwAutoConnect = s.gwAutoConnect;
    // Daily snapshots (4K refonte Phase B). Persisté sous le key court `ds`
    // pour économiser quelques octets sur le payload settings global.
    if (Array.isArray(s.ds)) settings.dailySnapshots = s.ds;
    // B4 — capital de référence manuel saisi en CHF. Stocké brut (la
    // conversion CHF→USD se fait au moment du calcul avec liveRate
    // courant, pour rester fidèle si le taux bouge).
    if (typeof s.ic === 'number' && Number.isFinite(s.ic) && s.ic > 0) {
      settings.initialCapitalChf = s.ic;
    }
  }

  // Walk the migration chain from the stored version up to CURRENT_SCHEMA_VERSION.
  const fromVersion = getStoredVersion();
  const migrated = runMigrations(
    { openPositions, closedTrades, cashFlows, journalEntries, settings },
    fromVersion
  );
  if (fromVersion < CURRENT_SCHEMA_VERSION) setStoredVersion(CURRENT_SCHEMA_VERSION);

  return migrated;
}

// ─── Zustand Store ──────────────────────────────────────────

const initial = loadInitialState();

const useZustandStore = create((set) => ({
  // State slices
  openPositions: initial.openPositions,
  closedTrades: initial.closedTrades,
  cashFlows: initial.cashFlows,
  journalEntries: initial.journalEntries,
  settings: initial.settings,

  // Dispatch — backward-compatible with useReducer pattern
  dispatch: (action) => {
    set((zuState) => {
      const currentState = {
        openPositions: zuState.openPositions,
        closedTrades: zuState.closedTrades,
        cashFlows: zuState.cashFlows,
        journalEntries: zuState.journalEntries,
        settings: zuState.settings,
      };
      const nextState = applyAction(currentState, action);
      return nextState;
    });
  },
}));

// ─── localStorage Persistence (subscribe outside React) ─────
// Both settings AND data writes are reference-gated (skip when nothing changed)
// and debounced. Previously settings were rewritten on every store tick — including
// every UPDATE_LIVE_PRICE — which serialized the whole settings blob unnecessarily.

let dataTimer = null;
let settingsTimer = null;
let prevSnapshot = {
  o: initial.openPositions,
  c: initial.closedTrades,
  f: initial.cashFlows,
  j: initial.journalEntries,
  s: initial.settings,
};

function persistSettings(settings) {
  try {
    const toSave = { r: settings.liveRate };
    // Persist fxMode only when non-default ('auto') to save bytes;
    // absence of `rm` on load means 'manual'.
    if (settings.fxMode && settings.fxMode !== 'manual') toSave.rm = settings.fxMode;
    // Persist timestamp/source only when set (null = default = skip).
    if (settings.fxLastUpdated) toSave.rt = settings.fxLastUpdated;
    if (settings.fxSource) toSave.rs = settings.fxSource;
    if (settings.cashReport) toSave.cashReport = settings.cashReport;
    if (settings.lastSync) toSave.lastSync = settings.lastSync;
    if (settings.ibkrLiveData) toSave.ibkrLiveData = settings.ibkrLiveData;
    if (settings.ibkrSummary) toSave.ibkrSummary = settings.ibkrSummary;
    if (settings.ibkrLedger) toSave.ibkrLedger = settings.ibkrLedger;
    if (settings.gwAutoConnect !== undefined) toSave.gwAutoConnect = settings.gwAutoConnect;
    if (Array.isArray(settings.dailySnapshots) && settings.dailySnapshots.length > 0) {
      toSave.ds = settings.dailySnapshots;
    }
    // B4 — capital manuel en CHF (clé courte `ic`).
    if (
      typeof settings.initialCapitalChf === 'number' &&
      Number.isFinite(settings.initialCapitalChf) &&
      settings.initialCapitalChf > 0
    ) {
      toSave.ic = settings.initialCapitalChf;
    }
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(toSave));
  } catch {
    console.warn('Storage full — settings not persisted');
  }
}

function persistData(zuState) {
  try {
    localStorage.setItem(STORAGE_KEYS.openPositions, JSON.stringify(zuState.openPositions));
    localStorage.setItem(STORAGE_KEYS.closedTrades, JSON.stringify(zuState.closedTrades));
    localStorage.setItem(STORAGE_KEYS.cashFlows, JSON.stringify(zuState.cashFlows));
    localStorage.setItem(STORAGE_KEYS.journalEntries, JSON.stringify(zuState.journalEntries));
  } catch {
    console.warn('Storage full — data not persisted');
  }
}

useZustandStore.subscribe((zuState) => {
  // Settings: only rewrite when the object reference actually changed (debounced
  // briefly to coalesce bursts like SYNC_IBKR which touches multiple settings keys).
  if (prevSnapshot.s !== zuState.settings) {
    prevSnapshot.s = zuState.settings;
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(
      () => persistSettings(zuState.settings),
      DEBOUNCE.SETTINGS_PERSIST_MS
    );
  }

  // Data: debounced more aggressively — large payloads, expensive to serialize.
  const dataChanged =
    prevSnapshot.o !== zuState.openPositions ||
    prevSnapshot.c !== zuState.closedTrades ||
    prevSnapshot.f !== zuState.cashFlows ||
    prevSnapshot.j !== zuState.journalEntries;
  if (!dataChanged) return;
  prevSnapshot.o = zuState.openPositions;
  prevSnapshot.c = zuState.closedTrades;
  prevSnapshot.f = zuState.cashFlows;
  prevSnapshot.j = zuState.journalEntries;

  clearTimeout(dataTimer);
  dataTimer = setTimeout(() => persistData(zuState), DEBOUNCE.DATA_PERSIST_MS);
});

// ─── Granular selectors ─────────────────────────────────────

export const useSettings = () => useZustandStore((s) => s.settings);
export const useOpenPositions = () => useZustandStore((s) => s.openPositions);
export const useClosedTrades = () => useZustandStore((s) => s.closedTrades);
export const useCashFlows = () => useZustandStore((s) => s.cashFlows);
export const useJournalEntries = () => useZustandStore((s) => s.journalEntries);
export const useDispatch = () => useZustandStore((s) => s.dispatch);
