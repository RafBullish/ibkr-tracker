// ═══════════════════════════════════════════════════════════════
//  B5-1 — aggregateDailyPnlByDate
//
//  Verrouille le fix anti-double-comptage : sur une série
//  potentiellement avec doublons par date, dé-dupliquer en sommant
//  produit un cumul running égal à la vraie somme des P&L (= realized),
//  pas au double quand plusieurs trades tombent le même jour.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { aggregateDailyPnlByDate } from '../../utils/equity';

describe('B5-1 — aggregateDailyPnlByDate', () => {
  it('série déjà agrégée par date (useDailyPnL nominal) — idempotente', () => {
    const dailyPnL = [
      { date: '2025-03-15', dailyPnl: 150 },
      { date: '2025-03-16', dailyPnl: 30 },
    ];
    const out = aggregateDailyPnlByDate(dailyPnL);
    expect(out).toEqual(dailyPnL);
    // Cumul = realized total
    let cumul = 0;
    for (const p of out) cumul += p.dailyPnl;
    expect(cumul).toBeCloseTo(180, 2);
  });

  it('série avec doublons par date — somme correcte, pas de double-comptage', () => {
    // Reproduit le cas du bug pré-B5 : equityHistory point-par-trade
    // avec 2 trades le même jour. Sans dé-dup, le cumul serait 280 au lieu de 180.
    const seriesWithDupes = [
      { date: '2025-03-15', dailyPnl: 100 },
      { date: '2025-03-15', dailyPnl: 50 },
      { date: '2025-03-16', dailyPnl: 30 },
    ];
    const out = aggregateDailyPnlByDate(seriesWithDupes);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ date: '2025-03-15', dailyPnl: 150 });
    expect(out[1]).toEqual({ date: '2025-03-16', dailyPnl: 30 });
    let cumul = 0;
    for (const p of out) cumul += p.dailyPnl;
    expect(cumul).toBeCloseTo(180, 2);
  });

  it('reproduit le ratio ~2× du bug sur 4 trades / 2 dates (2 par date)', () => {
    // Avec le bug : 4 trades sur 2 dates → ratio 2.0 (chaque dailyPnl
    // agrégé du jour est compté 2 fois). Sans le bug : exactement 1×.
    const realized = 1000; // somme arbitraire
    // dailyPnL agrégé par jour = 2 entries
    const agg = [
      { date: '2025-03-15', dailyPnl: 600 },
      { date: '2025-03-16', dailyPnl: 400 },
    ];
    // Simulation du bug : 4 entries point-par-trade avec dailyPnl agrégé attaché
    const buggy = [
      { date: '2025-03-15', dailyPnl: 600 },
      { date: '2025-03-15', dailyPnl: 600 }, // double-comptage
      { date: '2025-03-16', dailyPnl: 400 },
      { date: '2025-03-16', dailyPnl: 400 }, // double-comptage
    ];
    const dedupedBuggy = aggregateDailyPnlByDate(buggy);
    // Dé-dup somme tout, donc on retombe sur 1200+800=2000 (le bug ×2 est
    // déjà fait en amont). aggregateDailyPnlByDate ne défait PAS le bug
    // a posteriori — il l'évite EN AMONT en agrégeant depuis la source.
    // Le vrai check : sur la série agrégée correctement, cumul = 1000.
    let cumulAgg = 0;
    for (const p of aggregateDailyPnlByDate(agg)) cumulAgg += p.dailyPnl;
    expect(cumulAgg).toBeCloseTo(realized, 2);
    // Et la helper somme bien quand plusieurs entries portent la même date
    expect(dedupedBuggy[0].dailyPnl).toBeCloseTo(1200, 2);
  });

  it('ignore les entries sans date ou dailyPnl invalide', () => {
    const input = [
      { dailyPnl: 999 }, // pas de date
      { date: '2025-03-15', dailyPnl: 100 },
      { date: '2025-03-15', dailyPnl: NaN }, // invalide → 0
    ];
    expect(aggregateDailyPnlByDate(input)).toEqual([
      { date: '2025-03-15', dailyPnl: 100 },
    ]);
  });

  it('input vide / null → []', () => {
    expect(aggregateDailyPnlByDate([])).toEqual([]);
    expect(aggregateDailyPnlByDate(null)).toEqual([]);
    expect(aggregateDailyPnlByDate(undefined)).toEqual([]);
  });

  it('sortie triée ASC par date', () => {
    const out = aggregateDailyPnlByDate([
      { date: '2025-03-16', dailyPnl: 30 },
      { date: '2025-03-14', dailyPnl: 10 },
      { date: '2025-03-15', dailyPnl: 20 },
    ]);
    expect(out.map((p) => p.date)).toEqual(['2025-03-14', '2025-03-15', '2025-03-16']);
  });
});
