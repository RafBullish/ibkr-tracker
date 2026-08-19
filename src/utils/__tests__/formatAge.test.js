// ═══════════════════════════════════════════════════════════════
//  Âge du flux + ton de fraîcheur — briquette partagée (Phase B).
//  Verrouille : le langage « il y a N … » et la LOI DE COULEUR de la
//  fraîcheur (rouge SEULEMENT en séance ouverte ; jamais marché fermé).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { formatAge, nlvAgeTone } from '../formatAge';
import { NLV_AGE } from '../../constants/timing';

describe('formatAge', () => {
  it('secondes / minutes / heures / jours', () => {
    expect(formatAge(5_000)).toBe('il y a 5 s');
    expect(formatAge(90_000)).toBe('il y a 1 min');
    expect(formatAge(3 * 3_600_000)).toBe('il y a 3 h');
    expect(formatAge(2 * 86_400_000)).toBe('il y a 2 j');
  });
  it('âge absent / invalide → null', () => {
    expect(formatAge(null)).toBeNull();
    expect(formatAge(-1)).toBeNull();
    expect(formatAge(NaN)).toBeNull();
  });
});

describe('nlvAgeTone — loi de couleur de la fraîcheur', () => {
  it('< 60 s → live (vert)', () => {
    expect(nlvAgeTone(NLV_AGE.LIVE_MS - 1, { marketOpen: true })).toBe('live');
  });
  it('60 s .. 5 min → est (ambre)', () => {
    expect(nlvAgeTone(NLV_AGE.LIVE_MS, { marketOpen: true })).toBe('est');
    expect(nlvAgeTone(NLV_AGE.EST_MS - 1, { marketOpen: true })).toBe('est');
  });
  it('au-delà de 5 min : ROUGE seulement si marché OUVERT', () => {
    expect(nlvAgeTone(NLV_AGE.EST_MS, { marketOpen: true })).toBe('stale');
  });
  it('au-delà de 5 min, marché FERMÉ → neutre (idle), JAMAIS rouge', () => {
    expect(nlvAgeTone(NLV_AGE.EST_MS, { marketOpen: false })).toBe('idle');
    expect(nlvAgeTone(10 * 3_600_000, { marketOpen: false })).toBe('idle');
  });
  it('aucun point → null (pastille masquée)', () => {
    expect(nlvAgeTone(null, { marketOpen: true })).toBeNull();
  });
});
