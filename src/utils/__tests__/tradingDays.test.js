// ═══════════════════════════════════════════════════════════════
//  JOURS DE BOURSE — Brique Q-C (P4).
//  2026-01-01 = jeudi ; 01-05 = lundi ; 01-12 = lundi (repères sûrs).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { tradingDaysUntil, withinTradingDayWindow } from '../tradingDays';
import { JOURS_FERIES_US_SET } from '../../config/registre';

describe('tradingDaysUntil', () => {
  it('même jour = 0', () => {
    expect(tradingDaysUntil('2026-01-05', '2026-01-05')).toBe(0);
  });
  it('jeudi → vendredi = 1', () => {
    expect(tradingDaysUntil('2026-01-01', '2026-01-02')).toBe(1);
  });
  it('vendredi → lundi = 1 (saute le week-end)', () => {
    expect(tradingDaysUntil('2026-01-02', '2026-01-05')).toBe(1);
  });
  it('samedi → dimanche = 0', () => {
    expect(tradingDaysUntil('2026-01-03', '2026-01-04')).toBe(0);
  });
  it('lundi → lundi suivant (7 j cal) = 5 jours de bourse', () => {
    expect(tradingDaysUntil('2026-01-05', '2026-01-12')).toBe(5);
  });
  it('signé : sens inverse = négatif', () => {
    expect(tradingDaysUntil('2026-01-12', '2026-01-05')).toBe(-5);
  });
  it('date invalide → null', () => {
    expect(tradingDaysUntil('', '2026-01-05')).toBeNull();
    expect(tradingDaysUntil('pas-une-date', '2026-01-05')).toBeNull();
  });
});

describe('withinTradingDayWindow — fenêtre J−7 à J−5', () => {
  it('5,6,7 jours de bourse = dans la fenêtre ; 4 et 8 = hors', () => {
    // depuis le lundi 01-05 (semaine SANS férié : 01-01 exclu, MLK au 01-19)
    expect(withinTradingDayWindow('2026-01-05', '2026-01-09', 7, 5)).toBe(false); // 4 j (ven)
    expect(withinTradingDayWindow('2026-01-05', '2026-01-12', 7, 5)).toBe(true); // 5 j (lun)
    expect(withinTradingDayWindow('2026-01-05', '2026-01-14', 7, 5)).toBe(true); // 7 j (mer)
    expect(withinTradingDayWindow('2026-01-05', '2026-01-15', 7, 5)).toBe(false); // 8 j (jeu)
  });
});

// ── FÉRIÉS US (recette É4-a) ─────────────────────────────────────────
describe('tradingDaysUntil — fériés NYSE du registre (défaut)', () => {
  it('la table du registre est peuplée (témoin non-vacuous)', () => {
    expect(JOURS_FERIES_US_SET.size).toBeGreaterThan(40); // 10 fériés × 5 ans − obs.
    expect(JOURS_FERIES_US_SET.has('2026-01-19')).toBe(true); // MLK 2026
    expect(JOURS_FERIES_US_SET.has('2026-07-03')).toBe(true); // Independence obs. (04 = samedi)
  });

  it('MLK (lun 19.01.26) retire un jour de bourse dans la semaine', () => {
    // ven 16 → ven 23 : normalement 5 (lun-ven), MLK le 19 → 4.
    expect(tradingDaysUntil('2026-01-16', '2026-01-23')).toBe(4);
  });

  it('week-end prolongé MLK : ven 16 → mar 20 = 1 seul jour (lun férié)', () => {
    expect(tradingDaysUntil('2026-01-16', '2026-01-20')).toBe(1); // seul le mardi compte
  });

  it('Good Friday (ven 03.04.26) : jeu 02 → lun 06 = 1 (ven férié + week-end)', () => {
    expect(tradingDaysUntil('2026-04-02', '2026-04-06')).toBe(1);
  });

  it('Thanksgiving (jeu 26.11.26) : mer 25 → ven 27 = 1 (jeudi férié)', () => {
    expect(tradingDaysUntil('2026-11-25', '2026-11-27')).toBe(1);
  });

  it('une semaine SANS férié reste à 5 (le set ne sur-saute pas)', () => {
    // lun 12 → lun 19.01 : le 19 (MLK) est la BORNE incluse mais un férié
    // borne ne compte de toute façon pas comme jour de bourse → 4, pas 5.
    // On prend une semaine propre : lun 09.02 → lun 16.02 (Presidents = 16,
    // borne) → 4 ; lun 09.03 → lun 16.03 (aucun férié) = 5.
    expect(tradingDaysUntil('2026-03-09', '2026-03-16')).toBe(5);
  });

  it('fenêtre P4 décalée par un férié : earnings à 5 jours calendaires-ouvrés', () => {
    // Sans le MLK, mar 20 serait à 1 j de bourse du ven 16 ; le férié ne
    // change pas ce comptage ici, mais une fenêtre traversant MLK est réduite.
    // ven 16 → jeu 22 : 20,21,22 = 3 (le 19 sauté) au lieu de 4.
    expect(tradingDaysUntil('2026-01-16', '2026-01-22')).toBe(3);
  });
});

describe('tradingDaysUntil — set de fériés INJECTÉ (isolation test)', () => {
  const noHolidays = new Set();
  it('sans férié injecté, MLK ne saute plus : ven 16 → ven 23 = 5', () => {
    expect(tradingDaysUntil('2026-01-16', '2026-01-23', noHolidays)).toBe(5);
  });
  it('férié custom injecté saute le jour visé', () => {
    const custom = new Set(['2026-03-11']); // un mercredi arbitraire
    // lun 09 → lun 16.03 : normalement 5, avec le 11 férié → 4.
    expect(tradingDaysUntil('2026-03-09', '2026-03-16', custom)).toBe(4);
  });
});
