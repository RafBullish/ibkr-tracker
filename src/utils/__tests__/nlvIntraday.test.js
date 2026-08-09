// ═══════════════════════════════════════════════════════════════
//  nlvIntraday — buffer roulant d'échantillons NLV en séance
//  (FF-données), ISOLÉ PAR DATASET (chantier NLV). Env vitest = node
//  → stub window.localStorage (même gabarit que ivHistory.test.js).
//  Couvre : écriture datée sous la clé du dataset, garde de cadence
//  4.5 min, buffer roulant 5 séances, lecture défensive, événement de
//  changement, isolation entre datasets, archive one-shot du buffer
//  global legacy, clés ibkr_u_* jamais touchées.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  appendIntradaySample,
  readIntradayDays,
  NLV_INTRADAY_KEY_PREFIX,
  NLV_INTRADAY_EVENT,
  NLV_INTRADAY_MAX_DAYS,
  NLV_INTRADAY_MIN_GAP_MS,
} from '../nlvIntraday';

const DS = 'U1:20250101-20251231:abcd1234';
const KEY = NLV_INTRADAY_KEY_PREFIX + DS;

function makeStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  };
}

let events;

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

// Horloge : jour UTC + minutes de séance (15:00Z ≈ RTH NY).
function at(dateIso, minute = 0) {
  return new Date(dateIso + 'T15:00:00Z').getTime() + minute * 60_000;
}

describe('appendIntradaySample', () => {
  it('écrit un échantillon [epochSec, nlv] sous le jour courant, clé du dataset', () => {
    appendIntradaySample(DS, 12_345.678, at('2026-07-29'));
    const days = readIntradayDays(DS);
    expect(days).toHaveLength(1);
    expect(days[0].d).toBe('2026-07-29');
    expect(days[0].pts).toEqual([[Math.floor(at('2026-07-29') / 1000), 12_345.68]]);
    expect(Array.from(window.localStorage._map.keys())).toEqual([KEY]);
  });

  it('isolation : deux datasets ne partagent RIEN', () => {
    appendIntradaySample(DS, 10_000, at('2026-07-29'));
    appendIntradaySample('autre-ds', 24_000, at('2026-07-29'));
    expect(readIntradayDays(DS)[0].pts[0][1]).toBe(10_000);
    expect(readIntradayDays('autre-ds')[0].pts[0][1]).toBe(24_000);
    expect(readIntradayDays('ds-vierge')).toEqual([]);
  });

  it('garde de cadence : un échantillon < 4.5 min après le dernier est ignoré', () => {
    appendIntradaySample(DS, 10_000, at('2026-07-29', 0));
    appendIntradaySample(DS, 10_050, at('2026-07-29', 4)); // 4 min → droppé
    expect(readIntradayDays(DS)[0].pts).toHaveLength(1);
    appendIntradaySample(DS, 10_100, at('2026-07-29', 5)); // 5 min → accepté
    const pts = readIntradayDays(DS)[0].pts;
    expect(pts).toHaveLength(2);
    expect(pts[1][1]).toBe(10_100);
    expect(NLV_INTRADAY_MIN_GAP_MS).toBeLessThanOrEqual(5 * 60_000);
  });

  it('buffer roulant : au-delà de 5 séances, la plus ancienne est droppée', () => {
    for (let i = 0; i < NLV_INTRADAY_MAX_DAYS + 1; i++) {
      appendIntradaySample(DS, 10_000 + i, at(`2026-07-${String(20 + i).padStart(2, '0')}`));
    }
    const days = readIntradayDays(DS);
    expect(days).toHaveLength(NLV_INTRADAY_MAX_DAYS);
    expect(days[0].d).toBe('2026-07-21'); // 2026-07-20 droppé
    expect(days[days.length - 1].d).toBe('2026-07-25');
  });

  it('NLV invalide (NaN, ≤ 0) → no-op', () => {
    appendIntradaySample(DS, NaN, at('2026-07-29'));
    appendIntradaySample(DS, 0, at('2026-07-29'));
    appendIntradaySample(DS, -5, at('2026-07-29'));
    expect(readIntradayDays(DS)).toEqual([]);
  });

  it('dispatch l’événement de changement à chaque écriture réussie, pas sur un drop', () => {
    appendIntradaySample(DS, 10_000, at('2026-07-29', 0));
    appendIntradaySample(DS, 10_001, at('2026-07-29', 1)); // droppé (garde)
    expect(events).toEqual([NLV_INTRADAY_EVENT]);
  });
});

describe('readIntradayDays', () => {
  it('défensif : JSON corrompu, version inconnue ou points invalides → []/filtrés', () => {
    window.localStorage.setItem(KEY, '{oops');
    expect(readIntradayDays(DS)).toEqual([]);
    window.localStorage.setItem(KEY, JSON.stringify({ v: 2, days: [] }));
    expect(readIntradayDays(DS)).toEqual([]);
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        v: 1,
        days: [{ d: '2026-07-29', pts: [[1, -3], ['x', 2], [2, 9_000]] }],
      })
    );
    expect(readIntradayDays(DS)).toEqual([{ d: '2026-07-29', pts: [[2, 9_000]] }]);
  });

  it('trie les jours par date et les points par timestamp', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        v: 1,
        days: [
          { d: '2026-07-29', pts: [[20, 2], [10, 1]] },
          { d: '2026-07-28', pts: [[5, 3]] },
        ],
      })
    );
    const days = readIntradayDays(DS);
    expect(days.map((x) => x.d)).toEqual(['2026-07-28', '2026-07-29']);
    expect(days[1].pts).toEqual([[10, 1], [20, 2]]);
  });
});

describe('archive one-shot du buffer global legacy', () => {
  it('au chargement du module : qc:nlvIntraday → qc:nlvIntraday:legacy, jamais écrasé', async () => {
    const payload = JSON.stringify({ v: 1, days: [{ d: '2026-08-01', pts: [[1, 24_000]] }] });
    vi.stubGlobal('window', {
      localStorage: makeStorage({ 'qc:nlvIntraday': payload }),
      dispatchEvent: () => {},
    });
    vi.resetModules();
    await import('../nlvIntraday');
    const m = window.localStorage._map;
    expect(m.get('qc:nlvIntraday:legacy')).toBe(payload); // archivé
    expect(m.has('qc:nlvIntraday')).toBe(false); // ancienne clé retirée (contenu préservé)

    // Ré-archivage : une archive existante n'est JAMAIS écrasée.
    window.localStorage.setItem('qc:nlvIntraday', '{"v":1,"days":[]}');
    vi.resetModules();
    await import('../nlvIntraday');
    expect(m.get('qc:nlvIntraday:legacy')).toBe(payload);
    expect(m.has('qc:nlvIntraday')).toBe(false);
  });
});
