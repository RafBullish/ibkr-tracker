// ═══════════════════════════════════════════════════════════════
//  Addendum 2 n°1 — PORTE DE FRAÎCHEUR du writer du pic.
//  Principe : la porte juge la fraîcheur de la SOURCE du chiffre qu'elle
//  enregistre. `pos.pc` n'a aucun producteur quotes (UPDATE_LIVE_PRICE :
//  0 dispatcheur) — sa source = l'import de rapport, horodaté
//  `settings.pcSyncedAt`. Seuil 5 min. `ibkrLiveData.timestamp` (bridge)
//  n'entre PLUS JAMAIS dans ce jugement (défaut Q3 : bridge frais + pc
//  périmé enregistrait un mid douteux comme sain).
//  Scénarios mandatés : source pc fraîche + bridge périmé → ENREGISTRE ;
//  source pc périmée + bridge frais → TROU isPartial, jamais un mid ;
//  rien → trou.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pcSourceFresh } from '../usePositionMarks';
import { recordSessionClose, readMark } from '../../utils/positionMarks';
import { positionSignature } from '../../utils/positions';
import { FRESHNESS } from '../../constants/timing';

const NOW = Date.parse('2026-08-21T21:00:00Z'); // 17:00 ET — after-hours

function makeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}
beforeEach(() => {
  vi.stubGlobal('CustomEvent', class { constructor(type) { this.type = type; } });
  vi.stubGlobal('window', { localStorage: makeStorage(), dispatchEvent: () => {} });
});
afterEach(() => vi.unstubAllGlobals());

const iso = (msAgo) => new Date(NOW - msAgo).toISOString();

describe('pcSourceFresh — bornes 5 min sur la provenance du pc', () => {
  it('import à l’instant / à 4 min 59 → frais', () => {
    expect(pcSourceFresh(iso(0), NOW)).toBe(true);
    expect(pcSourceFresh(iso(FRESHNESS.PC_SOURCE_MAX_AGE_MS - 1), NOW)).toBe(true);
  });
  it('5 min pile / 59 min (l’ex-seuil 1 h est ABANDONNÉ) → périmé', () => {
    expect(pcSourceFresh(iso(FRESHNESS.PC_SOURCE_MAX_AGE_MS), NOW)).toBe(false);
    expect(pcSourceFresh(iso(59 * 60_000), NOW)).toBe(false);
  });
  it('absent / illisible / futur → jamais frais', () => {
    expect(pcSourceFresh(undefined, NOW)).toBe(false);
    expect(pcSourceFresh(null, NOW)).toBe(false);
    expect(pcSourceFresh('pas-une-date', NOW)).toBe(false);
    expect(pcSourceFresh(iso(-60_000), NOW)).toBe(false);
  });
  it('le jugement ne dépend QUE de pcSyncedAt — le bridge n’a aucune voix', () => {
    // La signature même de la fonction l'impose (un seul horodatage) ;
    // ce test documente le contrat : aucun paramètre bridge n'existe.
    expect(pcSourceFresh.length).toBe(2);
  });
});

describe('recordSessionClose — les trois scénarios mandatés', () => {
  const POS = { tk: 'AAPL', as: 'Option', dir: 'Long', ty: 'CALL', st: '200', ex: '2026-12-18', pi: '5', pc: '6', di: '2026-08-21', entryTs: '2026-08-21T14:00:00Z' };
  const SIG = positionSignature(POS);
  const opts = (fresh) => ({ day: '2026-08-21', stamp: new Date(NOW).toISOString(), sig: positionSignature, fresh });

  it('source pc FRAÎCHE + bridge PÉRIMÉ → le mid est enregistré', () => {
    // bridge périmé = hors sujet : la porte ne le consulte pas.
    const fresh = pcSourceFresh(iso(60_000), NOW); // import il y a 1 min
    expect(fresh).toBe(true);
    recordSessionClose([POS], opts(fresh));
    expect(readMark(SIG).series).toEqual([{ d: '2026-08-21', mid: 6 }]);
  });
  it('source pc PÉRIMÉE + bridge FRAIS → TROU isPartial, jamais un mid', () => {
    const fresh = pcSourceFresh(iso(45 * 60_000), NOW); // import il y a 45 min
    expect(fresh).toBe(false);
    recordSessionClose([POS], opts(fresh));
    const rec = readMark(SIG);
    // Record jamais amorcé avec un mid douteux : aucun point de série.
    expect(rec?.series?.length ?? 0).toBe(0);
  });
  it('rien (aucune provenance) → trou', () => {
    const fresh = pcSourceFresh(undefined, NOW);
    expect(fresh).toBe(false);
    recordSessionClose([POS], opts(fresh));
    expect(readMark(SIG)?.series?.length ?? 0).toBe(0);
  });
});
