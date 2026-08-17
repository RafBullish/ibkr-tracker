// ═══════════════════════════════════════════════════════════════
//  E5 — horodatage d'entrée depuis l'export Flex (Brique Q-B, ajout).
//
//  Verrouille : le DateTime d'exécution (heure de l'ÉCHANGE, ET) est
//  converti en instant absolu avec gestion du DST, posé sur la position
//  par enrichPositionsWithTrades, puis la règle E5 s'allume. Cas réel de
//  l'architecte : 09:42 ET = 15:42 Genève → VIOLATION (avant 15:45).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { instantFromExchangeDateTime } from '../ibkr/csvReader';
import { enrichPositionsWithTrades } from '../ibkr/closedTrades';
import { evaluatePositionViolations, zurichHHMM } from '../violations';

function e5(pos) {
  return evaluatePositionViolations(pos, {}).find((d) => d.code === 'E5');
}

const OPT = { as: 'Option', dir: 'Long', tk: 'AAPL', ty: 'CALL', st: '200', ex: '2026-12-18', ct: '1', mu: '100', pi: '5' };

describe('instantFromExchangeDateTime — heure d’échange (ET) → instant absolu, DST', () => {
  it('09:42 ET en été (EDT, UTC−4) → 13:42 UTC', () => {
    expect(instantFromExchangeDateTime('20260817;094200')).toBe('2026-08-17T13:42:00.000Z');
  });
  it('09:42 ET en hiver (EST, UTC−5) → 14:42 UTC (décalage lu, jamais figé)', () => {
    expect(instantFromExchangeDateTime('20260117;094200')).toBe('2026-01-17T14:42:00.000Z');
  });
  it('été comme hiver, 09:42 ET se reformate à 15:42 Europe/Zurich', () => {
    expect(zurichHHMM(instantFromExchangeDateTime('20260817;094200'))).toBe('15:42');
    expect(zurichHHMM(instantFromExchangeDateTime('20260117;094200'))).toBe('15:42');
  });
  it('vide / trop court → chaîne vide', () => {
    expect(instantFromExchangeDateTime('')).toBe('');
    expect(instantFromExchangeDateTime('2026')).toBe('');
  });
});

describe('E5 — cas réel 09:42 ET = 15:42 Genève', () => {
  it('09:42 ET (15:42 Genève, avant 15:45) → VIOLATION', () => {
    const p = { ...OPT, entryTs: instantFromExchangeDateTime('20260817;094200') };
    expect(e5(p).status).toBe('violation');
  });
  it('09:45 ET (15:45 Genève, borne d’ouverture) → conforme', () => {
    const p = { ...OPT, entryTs: instantFromExchangeDateTime('20260817;094500') };
    expect(e5(p)).toBeUndefined();
  });
  it('10:00 ET (16:00 Genève, dans la fenêtre) → conforme', () => {
    const p = { ...OPT, entryTs: instantFromExchangeDateTime('20260817;100000') };
    expect(e5(p)).toBeUndefined();
  });
  it('16:00 ET (22:00 Genève, après 21:45) → VIOLATION', () => {
    const p = { ...OPT, entryTs: instantFromExchangeDateTime('20260817;160000') };
    expect(e5(p).status).toBe('violation');
  });
});

describe('enrichPositionsWithTrades — pose entryTs depuis l’exécution d’ouverture', () => {
  it('la position reçoit entryTs de l’exécution « O », E5 s’allume', () => {
    const positions = [{ ...OPT, di: '', entryTs: null, lots: [] }];
    const trades = [
      {
        as: 'Option', dir: 'Long', tk: 'AAPL', ty: 'CALL', st: '200', ex: '2026-12-18',
        ct: '1', pi: '5', fi: '1', di: '2026-08-17', fxi: '0.88', mu: '100',
        _ibkrOpenClose: 'O', _ibkrDateTime: '20260817;094200',
      },
    ];
    enrichPositionsWithTrades(positions, trades);
    expect(positions[0].entryTs).toBe('2026-08-17T13:42:00.000Z');
    expect(e5(positions[0]).status).toBe('violation');
  });

  it('sans exécution d’ouverture correspondante → entryTs reste null → E5 indéterminée', () => {
    const positions = [{ ...OPT, di: '', entryTs: null, lots: [] }];
    enrichPositionsWithTrades(positions, []);
    expect(positions[0].entryTs).toBeNull();
    expect(e5(positions[0]).measurable).toBe(false);
  });
});
