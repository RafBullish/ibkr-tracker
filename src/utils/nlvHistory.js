// ═══════════════════════════════════════════════════════════════
//  NLV HISTORY — magasins d'historique NLV ISOLÉS PAR DATASET. PUR.
//
//  Défaut de conception soldé : l'historique NLV vivait dans un magasin
//  UNIQUE (settings.dailySnapshots + qc:nlvIntraday), non lié au CSV
//  importé → des relevés du compte de test cohabitaient avec ceux du
//  compte réel (falaises 24'000 → 13 $). Désormais TOUTES les clés
//  d'historique NLV sont préfixées par datasetId (utils/ibkr/datasetId) :
//
//    qc:nlvCsv:{datasetId}    série NAV dérivée du CSV (write à l'import)
//    qc:nlvDaily:{datasetId}  snapshots quotidiens écrits par l'app
//    qc:nlvIntraday:{datasetId}  buffer intraday (utils/nlvIntraday)
//
//  Changer de CSV = basculer sur l'historique de CE dataset, dans les
//  deux sens. Avant tout import, le seau sentinelle `local` est utilisé.
//
//  MIGRATION (one-shot, AUCUNE destruction) : l'ancien historique global
//  pollué est ARCHIVÉ sous *:legacy (archiveLegacyDailySnapshots, appelée
//  par useStore au boot ; l'intraday legacy est archivé par nlvIntraday).
//
//  Doctrine clés dédiées hors ibkr_u_* (cf. nlvIntraday) : enveloppes
//  versionnées { v: 1, … }, écriture try/catch quota, événement
//  NLV_HISTORY_EVENT pour re-render des lecteurs.
// ═══════════════════════════════════════════════════════════════

// Seau sentinelle avant tout import (aucun dataset actif).
export const DATASET_LOCAL = 'local';

export const NLV_CSV_KEY_PREFIX = 'qc:nlvCsv:';
export const NLV_DAILY_KEY_PREFIX = 'qc:nlvDaily:';
export const NLV_DAILY_LEGACY_KEY = 'qc:nlvDaily:legacy';
export const NLV_HISTORY_EVENT = 'qc:nlvHistory:change';

// Rétention des snapshots quotidiens (~10 ans) — sémantique reprise de
// l'ex-UPDATE_DAILY_SNAPSHOT du reducer (FF-données), désormais par dataset.
export const NLV_DAILY_MAX_DAYS = 3650;

const csvKey = (datasetId) => NLV_CSV_KEY_PREFIX + (datasetId || DATASET_LOCAL);
const dailyKey = (datasetId) => NLV_DAILY_KEY_PREFIX + (datasetId || DATASET_LOCAL);

function emitChange() {
  if (typeof window === 'undefined') return;
  if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent(NLV_HISTORY_EVENT));
  }
}

function safeRead(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function safeWrite(key, payload) {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
    emitChange();
    return true;
  } catch {
    /* quota / storage désactivé — échec silencieux, zéro dégradation */
    return false;
  }
}

// ─── Cœur PUR (testable hors navigateur) ────────────────────────

/**
 * Fusionne un snapshot quotidien dans la liste (sémantique de
 * l'ex-UPDATE_DAILY_SNAPSHOT) : idempotent par date — mêmes valeurs →
 * MÊME référence (aucune écriture) ; merge partiel par date ; sinon
 * append + rétention FIFO après tri par date.
 */
export function mergeDailySnapshot(days, snap) {
  const list = Array.isArray(days) ? days : [];
  if (!snap || !snap.date) return list;
  const idx = list.findIndex((s) => s.date === snap.date);
  if (idx !== -1) {
    const existing = list[idx];
    const same = Object.keys(snap).every((k) => existing[k] === snap[k]);
    if (same) return list;
    const merged = list.slice();
    merged[idx] = { ...existing, ...snap };
    return merged;
  }
  let appended = [...list, snap];
  if (appended.length > NLV_DAILY_MAX_DAYS) {
    appended = appended
      .slice()
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(appended.length - NLV_DAILY_MAX_DAYS);
  }
  return appended;
}

// ─── Série CSV du dataset (qc:nlvCsv:*) ─────────────────────────

/**
 * Lit la série NAV dérivée du CSV pour un dataset. Toujours sûr :
 * null si absente/corrompue. Shape : { v:1, meta, source, baseCurrency,
 * days:[{d, base}], flows, reconciliation }.
 */
export function readCsvSeries(datasetId) {
  return safeRead(csvKey(datasetId));
}

/** Écrit la série NAV du dataset (à l'import). */
export function writeCsvSeries(datasetId, payload) {
  return safeWrite(csvKey(datasetId), { v: 1, ...payload });
}

// ─── Snapshots quotidiens du dataset (qc:nlvDaily:*) ────────────

/** Lit les snapshots quotidiens du dataset, triés par date. */
export function readDailySnapshots(datasetId) {
  const parsed = safeRead(dailyKey(datasetId));
  if (!parsed || !Array.isArray(parsed.days)) return [];
  return parsed.days
    .filter((s) => s && typeof s.date === 'string')
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Ajoute/merge le snapshot du jour dans le seau du dataset. No-op
 * (aucune écriture, aucun événement) si rien ne change.
 */
export function appendDailySnapshot(datasetId, snap) {
  const days = readDailySnapshots(datasetId);
  const next = mergeDailySnapshot(days, snap);
  if (next === days) return days;
  safeWrite(dailyKey(datasetId), { v: 1, days: next });
  return next;
}

// ─── Archivage legacy (migration one-shot, aucune destruction) ──

/**
 * Archive l'ancien historique global (settings.dailySnapshots, pollué
 * test/réel) sous qc:nlvDaily:legacy — une seule fois, jamais écrasé.
 * Appelée par useStore.loadInitialState avant d'abandonner la clé `ds`.
 */
export function archiveLegacyDailySnapshots(snapshots) {
  if (typeof window === 'undefined') return false;
  if (!Array.isArray(snapshots) || snapshots.length === 0) return false;
  try {
    if (window.localStorage.getItem(NLV_DAILY_LEGACY_KEY) != null) return false;
    window.localStorage.setItem(
      NLV_DAILY_LEGACY_KEY,
      JSON.stringify({ v: 1, archivedAt: new Date().toISOString(), days: snapshots })
    );
    return true;
  } catch {
    return false;
  }
}
