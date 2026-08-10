// ═══════════════════════════════════════════════════════════════
//  nlvHistory — magasins d'historique NLV isolés par dataset.
//  Reprend les verrous de l'ex-UPDATE_DAILY_SNAPSHOT du reducer
//  (idempotence par date, merge partiel, rétention FIFO 3650, no-op
//  sans date) sur le cœur pur mergeDailySnapshot, + les wrappers
//  storage (isolation par dataset, archive legacy one-shot).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mergeDailySnapshot,
  appendDailySnapshot,
  readDailySnapshots,
  readCsvSeries,
  writeCsvSeries,
  archiveLegacyDailySnapshots,
  pruneDatasetHistory,
  NLV_DAILY_MAX_DAYS,
  NLV_DAILY_LEGACY_KEY,
  NLV_HISTORY_EVENT,
  NLV_CSV_KEY_PREFIX,
  NLV_DAILY_KEY_PREFIX,
  NLV_INTRADAY_KEY_PREFIX,
} from '../nlvHistory';

const DS = 'U1:20250101-20251231:abcd1234';

const dateAt = (i) => {
  const d = new Date(Date.UTC(2016, 0, 1) + i * 86_400_000);
  return d.toISOString().slice(0, 10);
};
const snap = (i, extra = {}) => ({ date: dateAt(i), nlv: 10_000 + i, ...extra });

describe('mergeDailySnapshot (cœur pur — sémantique ex-UPDATE_DAILY_SNAPSHOT)', () => {
  it('idempotent par date : mêmes valeurs → MÊME référence', () => {
    const days = [snap(1)];
    expect(mergeDailySnapshot(days, snap(1))).toBe(days);
  });

  it('merge partiel par date : les champs non fournis survivent', () => {
    const days = [snap(1, { winRate: 55 })];
    const next = mergeDailySnapshot(days, { date: dateAt(1), nlv: 10_500 });
    expect(next).toHaveLength(1);
    expect(next[0].nlv).toBe(10_500);
    expect(next[0].winRate).toBe(55);
  });

  it('rétention FIFO au cap (le plus ancien droppé après tri par date)', () => {
    const full = Array.from({ length: NLV_DAILY_MAX_DAYS }, (_, i) => snap(i + 1));
    const next = mergeDailySnapshot(full, snap(NLV_DAILY_MAX_DAYS + 1));
    expect(next).toHaveLength(NLV_DAILY_MAX_DAYS);
    expect(next[0].date).toBe(dateAt(2));
    expect(next[next.length - 1].date).toBe(dateAt(NLV_DAILY_MAX_DAYS + 1));
  });

  it('payload sans date → même référence (no-op)', () => {
    const days = [snap(1)];
    expect(mergeDailySnapshot(days, { nlv: 1 })).toBe(days);
  });
});

describe('wrappers storage (isolation par dataset)', () => {
  let events;

  function makeStorage(initial = {}) {
    const m = new Map(Object.entries(initial));
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
      key: (i) => Array.from(m.keys())[i] ?? null,
      get length() {
        return m.size;
      },
      _map: m,
    };
  }

  beforeEach(() => {
    events = [];
    vi.stubGlobal('CustomEvent', class {
      constructor(type) {
        this.type = type;
      }
    });
    vi.stubGlobal('window', {
      localStorage: makeStorage(),
      dispatchEvent: (e) => events.push(e.type),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('appendDailySnapshot : écrit sous la clé du dataset, événement, tri en lecture', () => {
    appendDailySnapshot(DS, snap(2));
    appendDailySnapshot(DS, snap(1));
    const days = readDailySnapshots(DS);
    expect(days.map((d) => d.date)).toEqual([dateAt(1), dateAt(2)]);
    expect(events).toEqual([NLV_HISTORY_EVENT, NLV_HISTORY_EVENT]);
  });

  it('appendDailySnapshot idempotent : aucune écriture/événement si rien ne change', () => {
    appendDailySnapshot(DS, snap(1));
    appendDailySnapshot(DS, snap(1));
    expect(events).toHaveLength(1);
  });

  it('isolation : deux datasets ne partagent RIEN', () => {
    appendDailySnapshot(DS, snap(1));
    appendDailySnapshot('autre', snap(5, { nlv: 24_000 }));
    expect(readDailySnapshots(DS)).toHaveLength(1);
    expect(readDailySnapshots('autre')[0].nlv).toBe(24_000);
    expect(readDailySnapshots('vierge')).toEqual([]);
  });

  it('writeCsvSeries/readCsvSeries : enveloppe v1, lecture défensive', () => {
    const payload = { source: 'recon', baseCurrency: 'CHF', days: [{ d: dateAt(1), base: 10 }] };
    writeCsvSeries(DS, payload);
    expect(readCsvSeries(DS)).toMatchObject(payload);
    expect(readCsvSeries('vierge')).toBeNull();
    window.localStorage.setItem('qc:nlvCsv:corrompu', '{oops');
    expect(readCsvSeries('corrompu')).toBeNull();
  });

  it('pruneDatasetHistory : garde l’actif + les plus récents du compte, épargne legacy/local/autres comptes', () => {
    const mk = (id, importedAt) =>
      writeCsvSeries(id, { source: 'recon', days: [], meta: { importedAt } });
    // 4 datasets du même compte U1 (actif = d4), 1 autre compte, legacy, local.
    mk('U1:p1:aaaa0001', '2026-01-01T00:00:00Z');
    mk('U1:p2:aaaa0002', '2026-02-01T00:00:00Z');
    mk('U1:p3:aaaa0003', '2026-03-01T00:00:00Z');
    mk('U1:p4:aaaa0004', '2026-04-01T00:00:00Z');
    mk('U2:p1:bbbb0001', '2020-01-01T00:00:00Z');
    appendDailySnapshot('U1:p1:aaaa0001', snap(1));
    appendDailySnapshot('local', snap(1));
    window.localStorage.setItem(NLV_INTRADAY_KEY_PREFIX + 'U1:p1:aaaa0001', '{"v":1,"days":[]}');
    window.localStorage.setItem(NLV_INTRADAY_KEY_PREFIX + 'legacy', '{"v":1,"days":[]}');

    const dropped = pruneDatasetHistory('U1:p4:aaaa0004'); // keep = 3 → actif + 2 récents
    expect(dropped).toEqual(['U1:p1:aaaa0001']); // le plus ancien purgé, triplet complet
    const keys = Array.from(window.localStorage._map.keys());
    expect(keys).not.toContain(NLV_CSV_KEY_PREFIX + 'U1:p1:aaaa0001');
    expect(keys).not.toContain(NLV_DAILY_KEY_PREFIX + 'U1:p1:aaaa0001');
    expect(keys).not.toContain(NLV_INTRADAY_KEY_PREFIX + 'U1:p1:aaaa0001');
    // Survivants : actif, 2 récents, autre compte, seau local, archive legacy.
    expect(keys).toContain(NLV_CSV_KEY_PREFIX + 'U1:p4:aaaa0004');
    expect(keys).toContain(NLV_CSV_KEY_PREFIX + 'U1:p3:aaaa0003');
    expect(keys).toContain(NLV_CSV_KEY_PREFIX + 'U1:p2:aaaa0002');
    expect(keys).toContain(NLV_CSV_KEY_PREFIX + 'U2:p1:bbbb0001');
    expect(keys).toContain(NLV_DAILY_KEY_PREFIX + 'local');
    expect(keys).toContain(NLV_INTRADAY_KEY_PREFIX + 'legacy');
    // Sous la rétention : no-op.
    expect(pruneDatasetHistory('U1:p4:aaaa0004')).toEqual([]);
  });

  it('archiveLegacyDailySnapshots : one-shot, jamais écrasé, rien si vide', () => {
    expect(archiveLegacyDailySnapshots([])).toBe(false);
    expect(archiveLegacyDailySnapshots([snap(1)])).toBe(true);
    const first = window.localStorage.getItem(NLV_DAILY_LEGACY_KEY);
    expect(JSON.parse(first).days).toHaveLength(1);
    // Une archive existante n'est JAMAIS écrasée.
    expect(archiveLegacyDailySnapshots([snap(2), snap(3)])).toBe(false);
    expect(window.localStorage.getItem(NLV_DAILY_LEGACY_KEY)).toBe(first);
  });
});
