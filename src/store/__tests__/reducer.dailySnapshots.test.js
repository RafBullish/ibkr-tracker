// ═══════════════════════════════════════════════════════════════
//  UPDATE_DAILY_SNAPSHOT — rétention longue (FF-données).
//
//  Verrouille : idempotence par date (même référence d'état), merge
//  par date, et surtout la LEVÉE DU CAP FIFO 60 → DAILY_SNAPSHOT_MAX_DAYS
//  (3650) : l'historique NLV > 60 j n'est PLUS effacé ; au-delà du cap
//  long, drop du plus ancien après tri par date. La « migration » est
//  un no-op par construction (lever un cap préserve l'existant) — le
//  test 60+ le prouve.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { applyAction, DAILY_SNAPSHOT_MAX_DAYS } from '../reducer';

// Jour n (1-based) → date ISO déterministe sur ~10 ans à partir de 2016-01-01.
function dateAt(n) {
  return new Date(Date.UTC(2016, 0, 1) + (n - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function stateWith(snapshots) {
  return {
    openPositions: [],
    closedTrades: [],
    cashFlows: [],
    journalEntries: [],
    watchlist: [],
    settings: { liveRate: 0.88, dailySnapshots: snapshots },
  };
}

function snap(n, nlv = 10_000 + n) {
  return { date: dateAt(n), nlv };
}

describe('UPDATE_DAILY_SNAPSHOT — rétention longue', () => {
  it('le cap est ≥ 3650 jours (rétention ~10 ans)', () => {
    expect(DAILY_SNAPSHOT_MAX_DAYS).toBeGreaterThanOrEqual(3650);
  });

  it('idempotent par date : mêmes valeurs → MÊME référence d’état (zéro write)', () => {
    const s0 = stateWith([snap(1)]);
    const s1 = applyAction(s0, { type: 'UPDATE_DAILY_SNAPSHOT', payload: snap(1) });
    expect(s1).toBe(s0);
  });

  it('merge par date : nouvelles valeurs du même jour écrasent sans dupliquer', () => {
    const s0 = stateWith([snap(1, 10_000)]);
    const s1 = applyAction(s0, {
      type: 'UPDATE_DAILY_SNAPSHOT',
      payload: { date: dateAt(1), nlv: 10_500 },
    });
    expect(s1.settings.dailySnapshots).toHaveLength(1);
    expect(s1.settings.dailySnapshots[0].nlv).toBe(10_500);
  });

  it('PRÉSERVE l’historique au-delà de 60 jours (l’ancien cap n’efface plus rien)', () => {
    const hundred = Array.from({ length: 100 }, (_, i) => snap(i + 1));
    const s1 = applyAction(stateWith(hundred), {
      type: 'UPDATE_DAILY_SNAPSHOT',
      payload: snap(101),
    });
    expect(s1.settings.dailySnapshots).toHaveLength(101);
    // Le plus ancien est toujours là — c’était le point effacé par le cap 60.
    expect(s1.settings.dailySnapshots[0].date).toBe(dateAt(1));
  });

  it('au-delà du cap long : FIFO — drop du plus ancien, garde les plus récents triés', () => {
    const full = Array.from({ length: DAILY_SNAPSHOT_MAX_DAYS }, (_, i) => snap(i + 1));
    const s1 = applyAction(stateWith(full), {
      type: 'UPDATE_DAILY_SNAPSHOT',
      payload: snap(DAILY_SNAPSHOT_MAX_DAYS + 1),
    });
    const list = s1.settings.dailySnapshots;
    expect(list).toHaveLength(DAILY_SNAPSHOT_MAX_DAYS);
    expect(list[0].date).toBe(dateAt(2)); // jour 1 droppé
    expect(list[list.length - 1].date).toBe(dateAt(DAILY_SNAPSHOT_MAX_DAYS + 1));
  });

  it('payload sans date → no-op (même référence)', () => {
    const s0 = stateWith([snap(1)]);
    expect(applyAction(s0, { type: 'UPDATE_DAILY_SNAPSHOT', payload: { nlv: 1 } })).toBe(s0);
  });
});
