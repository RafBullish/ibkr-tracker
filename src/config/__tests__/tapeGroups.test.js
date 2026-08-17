// ═══════════════════════════════════════════════════════════════
//  BANDEAU · 3 GROUPES (1.G-c · D2) — composition PURE.
//
//  Verrouille : Mag 7 fixe, POSITIONS dédupliqué du Mag 7 + P&L latent
//  sommé, SECTEURS hors Mag 7 ET hors positions, groupes vides absents,
//  liste de fetch dédupliquée. + sanitizeSectors aux bornes.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  MAG7,
  DEFAULT_SECTORS,
  MAX_SECTORS,
  sanitizeSectors,
  buildTapeGroups,
} from '../tapeGroups';

// Position minimale : P&L latent = (mark − entry) × qty × mul − fees.
function pos(tk, { pi = 5, pc = 5, ct = 1, mu = 100, fi = 0, dir = 'Long' } = {}) {
  return { tk, pi: String(pi), pc: String(pc), ct: String(ct), mu: String(mu), fi: String(fi), dir };
}

describe('MAG7 / DEFAULT_SECTORS — intégrité', () => {
  it('Mag 7 = 7 titres, aucun doublon', () => {
    expect(MAG7).toHaveLength(7);
    expect(new Set(MAG7).size).toBe(7);
  });
  it('Secteurs défaut = 8 titres, tous hors Mag 7', () => {
    expect(DEFAULT_SECTORS).toHaveLength(8);
    const mag = new Set(MAG7);
    expect(DEFAULT_SECTORS.some((s) => mag.has(s))).toBe(false);
  });
});

describe('sanitizeSectors — normalisation', () => {
  it('majuscules, trim du charset, dédup, vides retirés', () => {
    expect(sanitizeSectors(['lly', ' jpm ', 'lly', '', 'xo m!'])).toEqual(['LLY', 'JPM', 'XOM']);
  });
  it('plafonné à MAX_SECTORS', () => {
    const many = Array.from({ length: MAX_SECTORS + 5 }, (_, i) => `T${i}`);
    expect(sanitizeSectors(many)).toHaveLength(MAX_SECTORS);
  });
  it('entrée non-tableau → []', () => {
    expect(sanitizeSectors(null)).toEqual([]);
    expect(sanitizeSectors('AAPL')).toEqual([]);
  });
});

describe('buildTapeGroups — composition', () => {
  it('sans positions : Mag 7 + Secteurs seulement (pas de groupe POSITIONS)', () => {
    const { groups } = buildTapeGroups({ openPositions: [], tapeSectors: DEFAULT_SECTORS });
    expect(groups.map((g) => g.key)).toEqual(['mag7', 'sec']);
    expect(groups[0].items.map((i) => i.fetch)).toEqual(MAG7);
  });

  it('POSITIONS : sous-jacents détenus dédupliqués du Mag 7, P&L latent sommé', () => {
    const positions = [
      pos('NFLX', { pi: 5, pc: 8, ct: 1, mu: 100 }), // +300
      pos('NFLX', { pi: 4, pc: 5, ct: 2, mu: 100 }), // +200 → NFLX total +500
      pos('AAPL', { pi: 5, pc: 9, ct: 1, mu: 100 }), // AAPL est dans Mag 7 → exclu du groupe POSITIONS
    ];
    const { groups } = buildTapeGroups({ openPositions: positions, tapeSectors: [] });
    const posGroup = groups.find((g) => g.key === 'pos');
    expect(posGroup).toBeTruthy();
    // AAPL détenu mais dans Mag 7 → PAS dans POSITIONS.
    expect(posGroup.items.map((i) => i.fetch)).toEqual(['NFLX']);
    const nflx = posGroup.items[0];
    expect(nflx.held).toBe(true);
    expect(nflx.pnl).toBeCloseTo(500);
  });

  it('SECTEURS : hors Mag 7 ET hors positions (jamais deux fois)', () => {
    const positions = [pos('JPM')]; // JPM détenu ET dans DEFAULT_SECTORS
    const { groups } = buildTapeGroups({ openPositions: positions, tapeSectors: DEFAULT_SECTORS });
    const sec = groups.find((g) => g.key === 'sec').items.map((i) => i.fetch);
    // JPM apparaît dans POSITIONS, donc retiré de SECTEURS.
    expect(sec).not.toContain('JPM');
    expect(groups.find((g) => g.key === 'pos').items.map((i) => i.fetch)).toContain('JPM');
  });

  it('groupes vides absents : ni positions ni secteurs → Mag 7 seul', () => {
    const { groups } = buildTapeGroups({ openPositions: [], tapeSectors: [] });
    expect(groups.map((g) => g.key)).toEqual(['mag7']);
  });

  it('fetchSymbols dédupliqué sur les 3 groupes', () => {
    const positions = [pos('NFLX'), pos('PLTR')];
    const { fetchSymbols } = buildTapeGroups({ openPositions: positions, tapeSectors: ['NFLX', 'XOM'] });
    // NFLX est en POSITIONS → retiré de SECTEURS → apparaît une seule fois.
    expect(fetchSymbols.filter((s) => s === 'NFLX')).toHaveLength(1);
    expect(new Set(fetchSymbols).size).toBe(fetchSymbols.length);
  });

  it('tickers de position vides / bruités ignorés', () => {
    const { groups } = buildTapeGroups({ openPositions: [pos(''), pos(null)], tapeSectors: [] });
    expect(groups.map((g) => g.key)).toEqual(['mag7']);
  });
});
