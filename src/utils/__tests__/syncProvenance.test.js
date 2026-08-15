// ═══════════════════════════════════════════════════════════════
//  syncProvenance — É3.2 : mapping lastSync → libellé de la ligne de
//  synchro. Verrous : plus jamais « —— », plus jamais une mention
//  Flex pour un import fichier, ligne MORTE sans synchro connue.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { deriveSyncLabel, maskQueryId } from '../syncProvenance';

describe('maskQueryId', () => {
  it('masque tout sauf les 4 derniers caractères', () => {
    expect(maskQueryId('12345678')).toBe('****5678');
  });

  it('null sur vide / non-string (jamais « —— »)', () => {
    expect(maskQueryId('')).toBe(null);
    expect(maskQueryId('   ')).toBe(null);
    expect(maskQueryId(null)).toBe(null);
    expect(maskQueryId(undefined)).toBe(null);
  });
});

describe('deriveSyncLabel — la ligne dit la vérité de lastSync.source', () => {
  it('source=csv → IMPORT CSV + fichier + date, JAMAIS de mention Flex', () => {
    const label = deriveSyncLabel(
      { date: '2026-08-15T08:00:00.000Z', source: 'csv', file: 'Tracker_TEST-2.csv' },
      '12345678'
    );
    expect(label).toContain('IMPORT CSV');
    expect(label).toContain('Tracker_TEST-2.csv');
    expect(label).not.toMatch(/flex/i);
    expect(label).not.toContain('——');
  });

  it('source=flex → IBKR FLEX · Query ****<4 derniers> + date', () => {
    const label = deriveSyncLabel(
      { date: '2026-08-15T08:00:00.000Z', source: 'flex' },
      '987654321'
    );
    expect(label).toContain('IBKR FLEX');
    expect(label).toContain('Query ****4321');
    expect(label).not.toContain('987654321'.slice(0, 5)); // jamais l'ID en clair
  });

  it('source=flex SANS QueryID configuré → pas de segment Query (pas de tirets)', () => {
    const label = deriveSyncLabel({ date: '2026-08-15T08:00:00.000Z', source: 'flex' }, null);
    expect(label).toContain('IBKR FLEX');
    expect(label).not.toContain('Query');
    expect(label).not.toContain('——');
  });

  it('string (bridge SYNC_IBKR) → IBKR BRIDGE + date', () => {
    const label = deriveSyncLabel('2026-08-15T08:00:00.000Z');
    expect(label).toContain('IBKR BRIDGE');
  });

  it('pas de source → ligne MORTE (null), jamais un placeholder', () => {
    expect(deriveSyncLabel(null)).toBe(null);
    expect(deriveSyncLabel(undefined)).toBe(null);
  });

  it('objet pré-rc.4 sans champ source → date honnête sans provenance inventée', () => {
    const label = deriveSyncLabel({ date: '2026-08-10T10:00:00.000Z' });
    expect(label).toContain('SYNCHRO');
    expect(label).not.toMatch(/flex|csv/i);
  });

  it('dates invalides → null (ligne morte plutôt qu\'un mensonge)', () => {
    expect(deriveSyncLabel('pas-une-date')).toBe(null);
    expect(deriveSyncLabel({ date: 'garbage' })).toBe(null);
  });
});
