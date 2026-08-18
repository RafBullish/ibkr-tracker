// ═══════════════════════════════════════════════════════════════
//  SIDECAR MÉTADONNÉES DE SAISIE — Brique Q-B.
//
//  Verrouille : la métadonnée (earningsDate tri-état + entryNote) est
//  keyée par SIGNATURE stable, la fusion de patch préserve l'autre
//  champ, la lecture est tolérante, et — surtout — l'annotation SURVIT
//  au ré-import (via merge + rehydrate par signature).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  readPositionMeta,
  writePositionMeta,
  readAllPositionMeta,
} from '../positionMeta';
import { positionSignature } from '../positions';
import { mergeIbkrData } from '../ibkr/merge';

// localStorage en mémoire (env node, pas de jsdom).
beforeEach(() => {
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
  };
});
afterEach(() => {
  delete globalThis.window;
});

const POS = { tk: 'AAPL', as: 'Option', dir: 'Long', ty: 'CALL', st: '200', ex: '2026-12-18' };
const SIG = positionSignature(POS);

describe('positionMeta — écriture / lecture par signature', () => {
  it('écrit puis relit une date de résultats', () => {
    writePositionMeta(SIG, { earningsDate: '2026-09-01' }, '2026-08-16T00:00:00Z');
    expect(readPositionMeta(SIG).earningsDate).toBe('2026-09-01');
  });

  it('tri-état : AUCUN accepté, junk → null', () => {
    writePositionMeta(SIG, { earningsDate: 'AUCUN' }, 't');
    expect(readPositionMeta(SIG).earningsDate).toBe('AUCUN');
    writePositionMeta(SIG, { earningsDate: 'pas-une-date' }, 't');
    // earningsDate junk → null ; mais l'entrée peut disparaître si tout est nul
    const after = readPositionMeta(SIG);
    expect(after == null || after.earningsDate == null).toBe(true);
  });

  it('la fusion de patch préserve l’autre champ', () => {
    writePositionMeta(SIG, { earningsDate: '2026-09-01' }, 't1');
    writePositionMeta(SIG, { entryNote: 'thèse' }, 't2');
    const m = readPositionMeta(SIG);
    expect(m.earningsDate).toBe('2026-09-01');
    expect(m.entryNote).toBe('thèse');
  });

  it('readAll renvoie la carte { signature: meta }', () => {
    writePositionMeta(SIG, { entryNote: 'x' }, 't');
    const all = readAllPositionMeta();
    expect(all[SIG].entryNote).toBe('x');
  });

  it('lecture tolérante : signature absente → null', () => {
    expect(readPositionMeta('inconnu|X|Y')).toBeNull();
  });
});

describe('positionMeta — CAPTURE À L’ENTRÉE (mid/bid/ask/θ/δ)', () => {
  it('écrit puis relit les données d’entrée, prix > 0 / θ,δ signés', () => {
    writePositionMeta(
      SIG,
      { midAtEntry: 5, bidAtEntry: 4.9, askAtEntry: 5.1, thetaAtEntryPerDay: -0.02, deltaAtEntry: 0.3 },
      't'
    );
    const m = readPositionMeta(SIG);
    expect(m.midAtEntry).toBe(5);
    expect(m.bidAtEntry).toBe(4.9);
    expect(m.askAtEntry).toBe(5.1);
    expect(m.thetaAtEntryPerDay).toBe(-0.02);
    expect(m.deltaAtEntry).toBe(0.3);
  });

  it('une capture SANS earnings ni note SURVIT (garde vide élargie)', () => {
    writePositionMeta(SIG, { thetaAtEntryPerDay: -0.02, midAtEntry: 5 }, 't');
    const m = readPositionMeta(SIG);
    expect(m).not.toBeNull();
    expect(m.earningsDate).toBeNull();
    expect(m.entryNote).toBeNull();
    expect(m.thetaAtEntryPerDay).toBe(-0.02);
  });

  it('prix ≤ 0 ou non-fini → null (jamais un faux 0)', () => {
    writePositionMeta(SIG, { midAtEntry: 0, bidAtEntry: -1, askAtEntry: 'x', entryNote: 'garde' }, 't');
    const m = readPositionMeta(SIG);
    expect(m.midAtEntry).toBeNull();
    expect(m.bidAtEntry).toBeNull();
    expect(m.askAtEntry).toBeNull();
  });

  it('fusion de patch : une capture partielle préserve les champs déjà posés', () => {
    writePositionMeta(SIG, { midAtEntry: 5, thetaAtEntryPerDay: -0.02 }, 't1');
    writePositionMeta(SIG, { bidAtEntry: 4.9, askAtEntry: 5.1 }, 't2');
    const m = readPositionMeta(SIG);
    expect(m.midAtEntry).toBe(5);
    expect(m.thetaAtEntryPerDay).toBe(-0.02);
    expect(m.bidAtEntry).toBe(4.9);
    expect(m.askAtEntry).toBe(5.1);
  });
});

describe('positionMeta — SURVIE au ré-import (rehydrate par signature)', () => {
  it('une position NOUVELLE reprend la métadonnée du sidecar par signature', () => {
    // 1. l'utilisateur a annoté une position (sidecar).
    writePositionMeta(SIG, { earningsDate: '2026-09-01', entryNote: 'thèse' }, 't');
    // 2. ré-import du même CSV, magasin VIDE (position supprimée puis réimportée).
    const parsed = {
      positions: [{ ...POS, ct: '1', pi: '5', pc: '5' }],
      trades: [],
      cashFlows: [],
      fxRates: {},
      cashReport: null,
      errors: [],
      stats: { totalLines: 1, positionsSkipped: { byLevel: {}, byAssetClass: {} } },
    };
    const currentState = { openPositions: [], closedTrades: [], cashFlows: [], journalEntries: [] };
    const { mergedData } = mergeIbkrData(parsed, currentState, {
      metaBySignature: readAllPositionMeta(),
    });
    const created = mergedData.openPositions[0];
    expect(created.earningsDate).toBe('2026-09-01');
    expect(created.entryNote).toBe('thèse');
  });

  it('CAPTURE À L’ENTRÉE puis IMPORT : les données d’entrée se réhydratent sur la position créée', () => {
    // 1. Le soir de l'achat, capture AUTONOME (aucune position en store).
    writePositionMeta(
      SIG,
      { midAtEntry: 5, bidAtEntry: 4.9, askAtEntry: 5.1, thetaAtEntryPerDay: -0.02, deltaAtEntry: 0.3 },
      't'
    );
    // 2. Des jours plus tard, l'import Flex crée la position (aucune donnée d'entrée).
    const parsed = {
      positions: [{ ...POS, ct: '1', pi: '5', pc: '5' }],
      trades: [],
      cashFlows: [],
      fxRates: {},
      cashReport: null,
      errors: [],
      stats: { totalLines: 1, positionsSkipped: { byLevel: {}, byAssetClass: {} } },
    };
    const currentState = { openPositions: [], closedTrades: [], cashFlows: [], journalEntries: [] };
    const { mergedData } = mergeIbkrData(parsed, currentState, {
      metaBySignature: readAllPositionMeta(),
    });
    const created = mergedData.openPositions[0];
    // Le sidecar s'est réhydraté dessus TOUT SEUL (clé = signature).
    expect(created.midAtEntry).toBe(5);
    expect(created.bidAtEntry).toBe(4.9);
    expect(created.askAtEntry).toBe(5.1);
    expect(created.thetaAtEntryPerDay).toBe(-0.02);
    expect(created.deltaAtEntry).toBe(0.3);
  });

  it('une position EXISTANTE dédupliquée conserve sa métadonnée saisie (skip = objet préservé)', () => {
    const annotated = { ...POS, id: 'p1', ct: '1', pi: '5', pc: '5', earningsDate: '2026-09-01' };
    const parsed = {
      positions: [{ ...POS, ct: '1', pi: '5', pc: '5' }],
      trades: [],
      cashFlows: [],
      fxRates: {},
      cashReport: null,
      errors: [],
      stats: { totalLines: 1, positionsSkipped: { byLevel: {}, byAssetClass: {} } },
    };
    const currentState = { openPositions: [annotated], closedTrades: [], cashFlows: [], journalEntries: [] };
    const { mergedData, report } = mergeIbkrData(parsed, currentState, { metaBySignature: {} });
    // Signature déjà présente → dédupliquée (comptée), objet conservé.
    expect(report.positions.duplicatesSkipped).toBe(1);
    expect(mergedData.openPositions).toHaveLength(1);
    expect(mergedData.openPositions[0].earningsDate).toBe('2026-09-01');
  });
});
