// ═══════════════════════════════════════════════════════════════
//  WRITER DU PIC — qc:positionMarks (Brique Q-C).
//  Verrouille : base = mid de CLÔTURE (1/jour), amorce pic=max(mid
//  entrée, 1er close), peakSince, drapeau PARTIEL, idempotence par jour.
//  Env vitest = node → window stubbé (comme nlvIntraday.test.js).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  recordSessionClose,
  readMark,
  picPctOf,
  readPositionMarks,
  POSITION_MARKS_KEY,
} from '../positionMarks';
import { positionSignature } from '../positions';

function makeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

let events;
beforeEach(() => {
  events = [];
  vi.stubGlobal('CustomEvent', class { constructor(type) { this.type = type; } });
  vi.stubGlobal('window', {
    localStorage: makeStorage(),
    dispatchEvent: (e) => events.push(e.type),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const POS = { tk: 'AAPL', as: 'Option', dir: 'Long', ty: 'CALL', st: '200', ex: '2026-12-18', pi: '5', pc: '6', di: '2026-08-10', entryTs: '2026-08-10T14:00:00.000Z' };
const SIG = positionSignature(POS);
const opts = (day) => ({ day, stamp: `${day}T22:00:00Z`, sig: positionSignature });

describe('positionMarks — amorce', () => {
  it('1er passage : entryMid = prime d’entrée, pic = max(entrée, close), peakSince = jour', () => {
    recordSessionClose([POS], opts('2026-08-17'));
    const rec = readMark(SIG);
    expect(rec.entryMid).toBe(5);
    expect(rec.pic).toBe(6); // max(5, close 6)
    expect(rec.peakSince).toBe('2026-08-17');
    expect(rec.series).toEqual([{ d: '2026-08-17', mid: 6 }]);
  });
  it('peakSince > date d’entrée → pic PARTIEL (dit à l’écran par TRAIL)', () => {
    recordSessionClose([POS], opts('2026-08-17')); // entrée le 08-10, 1er enregistrement le 08-17
    expect(readMark(SIG).isPartial).toBe(true);
  });
  it('enregistrement dès le jour d’entrée → pic COMPLET', () => {
    recordSessionClose([{ ...POS, di: '2026-08-17', entryTs: '2026-08-17T14:00:00Z' }], opts('2026-08-17'));
    expect(readMark(SIG).isPartial).toBe(false);
  });
  it('pic < mid d’entrée → pic reste au mid d’entrée (jamais sous l’amorce)', () => {
    recordSessionClose([{ ...POS, pc: '3' }], opts('2026-08-17'));
    expect(readMark(SIG).pic).toBe(5); // max(entryMid 5, close 3)
  });
});

describe('positionMarks — cadence de clôture (1 mid/jour), pic croissant', () => {
  it('un nouveau jour ajoute un point et fait monter le pic', () => {
    recordSessionClose([POS], opts('2026-08-17')); // close 6
    recordSessionClose([{ ...POS, pc: '9' }], opts('2026-08-18')); // close 9
    const rec = readMark(SIG);
    expect(rec.series.map((p) => p.mid)).toEqual([6, 9]);
    expect(rec.pic).toBe(9);
  });
  it('idempotent : même jour rappelé ne réécrit pas le mid', () => {
    recordSessionClose([POS], opts('2026-08-17')); // close 6
    recordSessionClose([{ ...POS, pc: '99' }], opts('2026-08-17')); // même jour → ignoré
    expect(readMark(SIG).series).toEqual([{ d: '2026-08-17', mid: 6 }]);
  });
  it('un pic postérieur ne redescend pas si un close plus bas suit', () => {
    recordSessionClose([{ ...POS, pc: '10' }], opts('2026-08-17'));
    recordSessionClose([{ ...POS, pc: '4' }], opts('2026-08-18'));
    expect(readMark(SIG).pic).toBe(10);
  });
});

describe('positionMarks — picPctOf + robustesse', () => {
  it('picPctOf = (pic − entrée)/entrée', () => {
    recordSessionClose([{ ...POS, pc: '10' }], opts('2026-08-17'));
    expect(picPctOf(readMark(SIG))).toBeCloseTo((10 - 5) / 5, 6); // +100 %
  });
  it('actions ignorées (portes = premium long)', () => {
    recordSessionClose([{ ...POS, as: 'Action' }], opts('2026-08-17'));
    expect(readPositionMarks()).toEqual({});
  });
  it('close ≤ 0 ignoré ; dispatch d’un évènement au write', () => {
    recordSessionClose([{ ...POS, pc: '0' }], opts('2026-08-17'));
    expect(readMark(SIG)).toBeNull();
    recordSessionClose([POS], opts('2026-08-17'));
    expect(events).toContain('qc:positionMarks:change');
  });
  it('clé de stockage dédiée hors store', () => {
    expect(POSITION_MARKS_KEY).toBe('qc:positionMarks');
  });
});
