// ═══════════════════════════════════════════════════════════════
//  RAPPORT D'IMPORT — zéro skip muet, zéro fusion muette (Brique Q-B).
//
//  Verrouille : mergeIbkrData renvoie un `report` véridique — lignes
//  lues, positions créées, doublons dédupliqués, lignes IGNORÉES avec
//  le MOTIF — et la signature de dédup partagée (positionSignature).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { mergeIbkrData } from '../ibkr/merge';
import { positionSignature } from '../positions';

function parsedWith(overrides = {}) {
  return {
    positions: [],
    trades: [],
    cashFlows: [],
    fxRates: {},
    cashReport: null,
    errors: [],
    stats: {
      totalLines: 42,
      positionsSkipped: { byLevel: { LOT: 0, POSITION: 0, OTHER: 0 }, byAssetClass: { STK: 0, OPT: 0, CASH: 0, OTHER: 0 } },
      tradesSkipped: 0,
    },
    ...overrides,
  };
}
function emptyState() {
  return { openPositions: [], closedTrades: [], cashFlows: [], journalEntries: [] };
}

const POS = { tk: 'AAPL', as: 'Option', dir: 'Long', ty: 'CALL', st: '200', ex: '2026-12-18', ct: '1', pi: '5', pc: '5' };

describe('mergeIbkrData — rapport', () => {
  it('report.linesRead reflète le total du parser', () => {
    const { report } = mergeIbkrData(parsedWith(), emptyState());
    expect(report.linesRead).toBe(42);
  });

  it('compte les positions créées + expose les positions créées', () => {
    const { report } = mergeIbkrData(parsedWith({ positions: [POS] }), emptyState());
    expect(report.positions.created).toBe(1);
    expect(report.createdPositions).toHaveLength(1);
  });

  it('un doublon (signature déjà présente) est DÉDUPLIQUÉ et REPORTÉ, jamais muet', () => {
    const current = { ...emptyState(), openPositions: [{ ...POS, id: 'p1' }] };
    const { report } = mergeIbkrData(parsedWith({ positions: [POS] }), current);
    expect(report.positions.created).toBe(0);
    expect(report.positions.duplicatesSkipped).toBe(1);
  });

  it('les lignes IGNORÉES portent un MOTIF (classe d’actif hors OPT/STK)', () => {
    const parsed = parsedWith();
    parsed.stats.positionsSkipped.byAssetClass.CASH = 3;
    const { report } = mergeIbkrData(parsed, emptyState());
    const cash = report.ignored.find((r) => /cash/i.test(r.reason));
    expect(cash).toBeDefined();
    expect(cash.count).toBe(3);
  });

  it('les trades ignorés (non-ordre / FX) portent un motif', () => {
    const parsed = parsedWith();
    parsed.stats.tradesSkipped = 5;
    const { report } = mergeIbkrData(parsed, emptyState());
    expect(report.ignored.some((r) => r.count === 5)).toBe(true);
  });

  it('l’import ne moyenne pas (lotsMerged = 0) — honnête', () => {
    const { report } = mergeIbkrData(parsedWith({ positions: [POS] }), emptyState());
    expect(report.lotsMerged).toBe(0);
  });

  it('la signature de dédup est la signature partagée', () => {
    expect(positionSignature(POS)).toBe('AAPL|Option|Long|CALL|200|2026-12-18');
  });
});
