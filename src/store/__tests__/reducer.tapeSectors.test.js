// ═══════════════════════════════════════════════════════════════
//  SET_TAPE_SECTORS + préservation RESET_ALL (1.G-c · D2).
//
//  Le groupe SECTEURS du bandeau est éditable : le reducer normalise
//  (sanitizeSectors), retombe sur le défaut si vide, et le traite comme
//  une PRÉFÉRENCE (survit à RESET_ALL, comme la watchlist).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { applyAction } from '../reducer';
import { DEFAULT_SECTORS } from '../../config/tapeGroups';

function baseState(settings = {}) {
  return {
    openPositions: [],
    closedTrades: [],
    cashFlows: [],
    journalEntries: [],
    watchlist: [],
    settings,
  };
}

describe('SET_TAPE_SECTORS', () => {
  it('normalise (majuscules, dédup) et pose settings.tapeSectors', () => {
    const next = applyAction(baseState(), { type: 'SET_TAPE_SECTORS', payload: ['lly', 'jpm', 'lly'] });
    expect(next.settings.tapeSectors).toEqual(['LLY', 'JPM']);
  });

  it('payload vide/invalide → retour au défaut (jamais un groupe amputé)', () => {
    expect(applyAction(baseState(), { type: 'SET_TAPE_SECTORS', payload: [] }).settings.tapeSectors).toEqual(
      DEFAULT_SECTORS
    );
    expect(
      applyAction(baseState(), { type: 'SET_TAPE_SECTORS', payload: null }).settings.tapeSectors
    ).toEqual(DEFAULT_SECTORS);
  });

  it('ne touche pas les autres clés de settings', () => {
    const next = applyAction(baseState({ liveRate: 0.9, fxMode: 'auto' }), {
      type: 'SET_TAPE_SECTORS',
      payload: ['XOM'],
    });
    expect(next.settings.liveRate).toBe(0.9);
    expect(next.settings.fxMode).toBe('auto');
  });
});

describe('RESET_ALL — SECTEURS = préférence préservée', () => {
  it('conserve tapeSectors (comme la watchlist / les prefs FX)', () => {
    const custom = ['XOM', 'CVX', 'COP'];
    const state = baseState({ liveRate: 0.88, fxMode: 'auto', tapeSectors: custom });
    const next = applyAction(state, { type: 'RESET_ALL' });
    expect(next.settings.tapeSectors).toEqual(custom);
    expect(next.openPositions).toEqual([]);
  });

  it('EFFACE dailySnapshots (donnée, pas préférence) — pas de faux zéro post-reset', () => {
    // É4-b correction : les snapshots de l'ère démo doivent partir au reset,
    // sinon ils se mêlent à la vraie courbe dès le 1er dépôt (qui crée une
    // ancre que la garde buildNlvSeries ne couvre pas).
    const state = baseState({
      liveRate: 0.88,
      dailySnapshots: [{ date: '2026-01-02', nlv: 24000 }, { date: '2026-01-03', nlv: 24500 }],
    });
    const next = applyAction(state, { type: 'RESET_ALL' });
    expect(next.settings.dailySnapshots).toEqual([]);
  });
});
