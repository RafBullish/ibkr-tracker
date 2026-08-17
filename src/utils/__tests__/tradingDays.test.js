// ═══════════════════════════════════════════════════════════════
//  JOURS DE BOURSE — Brique Q-C (P4).
//  2026-01-01 = jeudi ; 01-05 = lundi ; 01-12 = lundi (repères sûrs).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { tradingDaysUntil, withinTradingDayWindow } from '../tradingDays';

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
    // depuis le lundi 01-05
    expect(withinTradingDayWindow('2026-01-05', '2026-01-09', 7, 5)).toBe(false); // 4 j (ven)
    expect(withinTradingDayWindow('2026-01-05', '2026-01-12', 7, 5)).toBe(true); // 5 j (lun)
    expect(withinTradingDayWindow('2026-01-05', '2026-01-14', 7, 5)).toBe(true); // 7 j (mer)
    expect(withinTradingDayWindow('2026-01-05', '2026-01-15', 7, 5)).toBe(false); // 8 j (jeu)
  });
});
