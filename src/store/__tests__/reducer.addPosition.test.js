// ═══════════════════════════════════════════════════════════════
//  ADD_POSITION — le moyennage n'est plus MUET (Brique Q-B).
//
//  Verrouille : une 2ᵉ entrée sur le MÊME contrat fusionne en lots[]
//  (provenance journalisée), pose le drapeau `averaged`, et le moteur
//  de violations en dérive un écart S6 — visible, marqué, jamais bloqué.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { applyAction } from '../reducer';
import { evaluatePositionViolations, violationsOnly } from '../../utils/violations';

function baseState() {
  return {
    openPositions: [],
    closedTrades: [],
    cashFlows: [],
    journalEntries: [],
    watchlist: [],
    settings: {},
  };
}

const POS = {
  as: 'Option',
  dir: 'Long',
  tk: 'AAPL',
  ty: 'CALL',
  st: '200',
  ex: '2026-12-18',
  ct: '1',
  mu: '100',
  pi: '5',
  pc: '5',
  fi: '1',
  fxi: '0.88',
  di: '2026-08-01',
};

describe('ADD_POSITION — moyennage non muet', () => {
  it('1ʳᵉ entrée = append simple (pas de fusion)', () => {
    const s = applyAction(baseState(), { type: 'ADD_POSITION', payload: POS });
    expect(s.openPositions).toHaveLength(1);
    expect(s.openPositions[0].averaged).toBeUndefined();
  });

  it('2ᵉ entrée même contrat = fusion en lots[] + drapeau averaged', () => {
    let s = applyAction(baseState(), { type: 'ADD_POSITION', payload: POS });
    s = applyAction(s, { type: 'ADD_POSITION', payload: { ...POS, pi: '7' } });
    expect(s.openPositions).toHaveLength(1);
    const fused = s.openPositions[0];
    expect(fused.lots).toHaveLength(2);
    expect(fused.averaged).toBe(true);
  });

  it('le moteur de violations marque un écart S6 sur la position moyennée', () => {
    let s = applyAction(baseState(), { type: 'ADD_POSITION', payload: POS });
    s = applyAction(s, { type: 'ADD_POSITION', payload: { ...POS, pi: '7' } });
    const fused = s.openPositions[0];
    const viols = violationsOnly(evaluatePositionViolations(fused, { book: s.openPositions }));
    expect(viols.some((v) => v.code === 'S6')).toBe(true);
  });
});
