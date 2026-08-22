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
  it('RTH : 59 s → live (vert), 60 s → est (ambre) — inchangés', () => {
    expect(nlvAgeTone(59_000, { phase: 'open' })).toBe('live');
    expect(nlvAgeTone(NLV_AGE.LIVE_MS - 1, { phase: 'open' })).toBe('live');
    expect(nlvAgeTone(60_000, { phase: 'open' })).toBe('est');
  });
  it('pré/post : 199 s → LIVE, 200 s → ambre (seuil de phase 90+90+20)', () => {
    for (const phase of ['pre', 'after']) {
      expect(nlvAgeTone(199_000, { phase })).toBe('live');
      expect(nlvAgeTone(NLV_AGE.LIVE_PREPOST_MS - 1, { phase })).toBe('live');
      expect(nlvAgeTone(200_000, { phase })).toBe('est');
    }
  });
  it('299 s → est · 300 s → TOUJOURS ambre (jamais rouge), toutes phases de séance', () => {
    for (const phase of ['open', 'pre', 'after']) {
      expect(nlvAgeTone(299_000, { phase })).toBe('est');
      expect(nlvAgeTone(300_000, { phase })).toBe('est');
      expect(nlvAgeTone(3 * 3_600_000, { phase })).toBe('est');
    }
  });
  it("le ton 'stale' n'existe plus, quel que soit l'âge ou la phase", () => {
    for (const age of [0, 59_000, 60_000, 199_000, 200_000, 300_000, 86_400_000]) {
      for (const phase of ['open', 'pre', 'after', 'closed']) {
        expect(nlvAgeTone(age, { phase })).not.toBe('stale');
      }
    }
  });
  it('hors séance → idle (neutre), quel que soit l’âge', () => {
    expect(nlvAgeTone(5_000, { phase: 'closed' })).toBe('idle');
    expect(nlvAgeTone(NLV_AGE.EST_MS, { phase: 'closed' })).toBe('idle');
    expect(nlvAgeTone(10 * 3_600_000, { phase: 'closed' })).toBe('idle');
  });
  it('aucun point → null (pastille masquée)', () => {
    expect(nlvAgeTone(null, { phase: 'open' })).toBeNull();
  });
});

describe('nlvFluxBadge — libellés du seul porteur d’état', () => {
  const rth = { phase: 'open' };
  it('RTH 59 s → kind live, « il y a 59 s »', () => {
    expect(nlvFluxBadge(59_000, rth)).toEqual({ tone: 'live', kind: 'live', label: 'il y a 59 s' });
  });
  it('RTH 60 s → kind age, ambre, « il y a 1 min »', () => {
    expect(nlvFluxBadge(60_000, rth)).toEqual({ tone: 'est', kind: 'age', label: 'il y a 1 min' });
  });
  it('pré/post 199 s → LIVE · 200 s → age ambre', () => {
    expect(nlvFluxBadge(199_000, { phase: 'after' }).kind).toBe('live');
    expect(nlvFluxBadge(200_000, { phase: 'after' }).kind).toBe('age');
    expect(nlvFluxBadge(199_000, { phase: 'pre' }).kind).toBe('live');
  });
  it('299 s → kind age (pas encore périmé)', () => {
    expect(nlvFluxBadge(299_000, rth).kind).toBe('age');
  });
  it('300 s → « FLUX PÉRIMÉ · il y a 5 min », couleur AMBRE (tone est), toutes phases', () => {
    expect(nlvFluxBadge(300_000, rth)).toEqual({ tone: 'est', kind: 'stale', label: 'FLUX PÉRIMÉ · il y a 5 min' });
    expect(nlvFluxBadge(300_000, { phase: 'after' }).kind).toBe('stale');
  });
  it('12 min → « FLUX PÉRIMÉ · il y a 12 min »', () => {
    expect(nlvFluxBadge(12 * 60_000, rth).label).toBe('FLUX PÉRIMÉ · il y a 12 min');
  });
  it('hors séance, dernier tick d’AUJOURD’HUI → « MARCHÉ FERMÉ · dernier tick HH:MM »', () => {
    const lastTick = new Date(2026, 7, 21, 22, 0).getTime(); // 22:00 locale
    const b = nlvFluxBadge(30 * 60_000, { phase: 'closed', lastCapturedAt: lastTick }); // now = 22:30 même jour
    expect(b.tone).toBe('idle');
    expect(b.kind).toBe('closed');
    expect(b.label).toBe('MARCHÉ FERMÉ · dernier tick 22:00');
  });
  it('hors séance, dernier tick d’un AUTRE jour → le libellé porte la date', () => {
    const lastTick = new Date(2026, 7, 18, 23, 43).getTime(); // mardi 18.08 23:43 locale
    const b = nlvFluxBadge(3 * 86_400_000, { phase: 'closed', lastCapturedAt: lastTick }); // now = 21.08
    expect(b.label).toBe('MARCHÉ FERMÉ · dernier tick 18.08 23:43');
  });
  it('hors séance sans dernier tick connu → « MARCHÉ FERMÉ » seul', () => {
    expect(nlvFluxBadge(5_000, { phase: 'closed' }).label).toBe('MARCHÉ FERMÉ');
  });
  it('aucun point → null', () => {
    expect(nlvFluxBadge(null, rth)).toBeNull();
  });
});
