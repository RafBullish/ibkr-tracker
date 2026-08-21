// ═══════════════════════════════════════════════════════════════
//  Âge du flux + ton de fraîcheur — briquette partagée (Phase B).
//  Verrouille (Héros 1 LIVE, pré-vol b+c) : le langage « il y a N … »,
//  la LOI DE COULEUR de la fraîcheur (le ROUGE = perte d'argent, JAMAIS
//  une péremption — au-delà de 5 min le LIBELLÉ change, la couleur reste
//  ambre) et l'état « MARCHÉ FERMÉ · dernier tick HH:MM » distinct de la
//  péremption. Bornes EXACTES : 59 s → LIVE · 60 s → ambre · 299 s →
//  ambre · 300 s → « FLUX PÉRIMÉ » ambre · hors séance → neutre.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { formatAge, nlvAgeTone, nlvFluxBadge } from '../formatAge';
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

describe('nlvAgeTone — loi de couleur de la fraîcheur (le rouge est MORT)', () => {
  it('59 s → live (vert)', () => {
    expect(nlvAgeTone(59_000, { marketOpen: true })).toBe('live');
    expect(nlvAgeTone(NLV_AGE.LIVE_MS - 1, { marketOpen: true })).toBe('live');
  });
  it('60 s → est (ambre)', () => {
    expect(nlvAgeTone(60_000, { marketOpen: true })).toBe('est');
  });
  it('299 s → est (ambre)', () => {
    expect(nlvAgeTone(299_000, { marketOpen: true })).toBe('est');
  });
  it("300 s → TOUJOURS ambre (jamais 'stale'/rouge, même en séance)", () => {
    expect(nlvAgeTone(300_000, { marketOpen: true })).toBe('est');
    expect(nlvAgeTone(3 * 3_600_000, { marketOpen: true })).toBe('est');
  });
  it("le ton 'stale' n'existe plus, quel que soit l'âge ou la séance", () => {
    for (const age of [0, 59_000, 60_000, 299_000, 300_000, 86_400_000]) {
      for (const open of [true, false]) {
        expect(nlvAgeTone(age, { marketOpen: open })).not.toBe('stale');
      }
    }
  });
  it('hors séance → idle (neutre), quel que soit l’âge', () => {
    expect(nlvAgeTone(5_000, { marketOpen: false })).toBe('idle');
    expect(nlvAgeTone(NLV_AGE.EST_MS, { marketOpen: false })).toBe('idle');
    expect(nlvAgeTone(10 * 3_600_000, { marketOpen: false })).toBe('idle');
  });
  it('aucun point → null (pastille masquée)', () => {
    expect(nlvAgeTone(null, { marketOpen: true })).toBeNull();
  });
});

describe('nlvFluxBadge — libellés du seul porteur d’état', () => {
  const open = { marketOpen: true };
  it('59 s → kind live, « il y a 59 s »', () => {
    expect(nlvFluxBadge(59_000, open)).toEqual({ tone: 'live', kind: 'live', label: 'il y a 59 s' });
  });
  it('60 s → kind age, ambre, « il y a 1 min »', () => {
    expect(nlvFluxBadge(60_000, open)).toEqual({ tone: 'est', kind: 'age', label: 'il y a 1 min' });
  });
  it('299 s → kind age (pas encore périmé)', () => {
    expect(nlvFluxBadge(299_000, open).kind).toBe('age');
  });
  it('300 s → « FLUX PÉRIMÉ · il y a 5 min », couleur AMBRE (tone est)', () => {
    const b = nlvFluxBadge(300_000, open);
    expect(b).toEqual({ tone: 'est', kind: 'stale', label: 'FLUX PÉRIMÉ · il y a 5 min' });
  });
  it('12 min → « FLUX PÉRIMÉ · il y a 12 min »', () => {
    expect(nlvFluxBadge(12 * 60_000, open).label).toBe('FLUX PÉRIMÉ · il y a 12 min');
  });
  it('hors séance → « MARCHÉ FERMÉ · dernier tick HH:MM », neutre, aucune couleur d’alerte', () => {
    const lastTick = new Date(2026, 7, 21, 22, 0).getTime(); // 22:00 locale
    const b = nlvFluxBadge(10 * 3_600_000, { marketOpen: false, lastCapturedAt: lastTick });
    expect(b.tone).toBe('idle');
    expect(b.kind).toBe('closed');
    expect(b.label).toBe('MARCHÉ FERMÉ · dernier tick 22:00');
  });
  it('hors séance sans dernier tick connu → « MARCHÉ FERMÉ » seul', () => {
    expect(nlvFluxBadge(5_000, { marketOpen: false }).label).toBe('MARCHÉ FERMÉ');
  });
  it('aucun point → null', () => {
    expect(nlvFluxBadge(null, open)).toBeNull();
  });
});
