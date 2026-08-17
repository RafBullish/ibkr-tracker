// ═══════════════════════════════════════════════════════════════
//  Migration v7 → v8 (Brique Q-B « la saisie »).
//
//  Verrouille : le schéma s'ouvre à ce que la carte V3 exige
//  d'ENREGISTRER, sans détruire aucune donnée réelle.
//    · positions ouvertes : earningsDate + entryNote (null par défaut).
//    · trades clôturés     : picAtteint + porteDeclenchee + porteRespectee.
//  Garde '=== undefined' : toute valeur déjà posée passe INTACTE.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { runMigrations, CURRENT_SCHEMA_VERSION } from '../migrations';

function stateV7() {
  return {
    openPositions: [
      { id: 'p1', tk: 'AAPL', as: 'Option', dir: 'Long', ty: 'CALL', st: '200', ex: '2026-12-18' },
    ],
    closedTrades: [{ id: 't1', tk: 'NVDA', pi: '5', po: '9' }],
    cashFlows: [],
    journalEntries: [],
    settings: {},
  };
}

describe('Migration v7 → v8 — Q-B la saisie', () => {
  it('la version courante du schéma est 8', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(8);
  });

  it('ajoute earningsDate + entryNote (null) aux positions ouvertes', () => {
    const out = runMigrations(stateV7(), 7);
    expect(out.openPositions[0].earningsDate).toBeNull();
    expect(out.openPositions[0].entryNote).toBeNull();
  });

  it('ajoute picAtteint + porteDeclenchee + porteRespectee (null) aux trades clôturés', () => {
    const out = runMigrations(stateV7(), 7);
    expect(out.closedTrades[0].picAtteint).toBeNull();
    expect(out.closedTrades[0].porteDeclenchee).toBeNull();
    expect(out.closedTrades[0].porteRespectee).toBeNull();
  });

  it('PRÉSERVE une valeur déjà saisie (date, AUCUN, note, porte)', () => {
    const s = stateV7();
    s.openPositions[0].earningsDate = '2026-09-01';
    s.openPositions[0].entryNote = 'thèse initiale';
    s.closedTrades[0].porteDeclenchee = 'P1_SL';
    const out = runMigrations(s, 7);
    expect(out.openPositions[0].earningsDate).toBe('2026-09-01');
    expect(out.openPositions[0].entryNote).toBe('thèse initiale');
    expect(out.closedTrades[0].porteDeclenchee).toBe('P1_SL');
  });

  it('PRÉSERVE earningsDate = AUCUN (tri-état)', () => {
    const s = stateV7();
    s.openPositions[0].earningsDate = 'AUCUN';
    const out = runMigrations(s, 7);
    expect(out.openPositions[0].earningsDate).toBe('AUCUN');
  });

  it('ne détruit aucune donnée réelle du trade (pi/po intacts)', () => {
    const out = runMigrations(stateV7(), 7);
    expect(out.closedTrades[0].pi).toBe('5');
    expect(out.closedTrades[0].po).toBe('9');
  });

  it('idempotente sur un état déjà v8', () => {
    const once = runMigrations(stateV7(), 7);
    const twice = runMigrations(once, 7);
    expect(twice.openPositions[0].earningsDate).toBeNull();
    expect(twice.closedTrades[0].picAtteint).toBeNull();
  });
});
