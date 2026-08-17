// ═══════════════════════════════════════════════════════════════
//  DÉPLOYABLE + N-max (Brique 1.G-b) — logique du héros CAPITAL.
//  Verrouille : déployable = sizing.S1 × NLV ; le piège N-max (sizing.S4,
//  N=1 sous 6000 CHF) ; NLV absente → indéterminée SANS repli.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { deriveKpisReal } from '../model';
import { SIZING } from '../../../../config/registre';

const ctx = (metrics, positions = []) => ({ metrics, positions });

describe('deriveKpisReal — DÉPLOYABLE', () => {
  it('déployable = sizing.S1 × NLV ; deployablePct = 60 %', () => {
    const k = deriveKpisReal(ctx({ netLiquidationValueUsd: 10000, netLiquidationValueChf: 8000, liveRate: 0.88 }));
    expect(k.deployableUsd).toBeCloseTo(SIZING.S1_pct_max_par_position * 10000);
    expect(k.deployablePct).toBe(SIZING.S1_pct_max_par_position * 100);
  });

  it('NLV absente ou ≤ 0 → déployable null (indéterminée, sans repli)', () => {
    expect(deriveKpisReal(ctx({ netLiquidationValueUsd: null })).deployableUsd).toBeNull();
    expect(deriveKpisReal(ctx({ netLiquidationValueUsd: -500 })).deployableUsd).toBeNull();
  });
});

describe('deriveKpisReal — N-max (piège)', () => {
  it('sous 6000 CHF → nMax 1 ; avec 1 position → atteint', () => {
    const k = deriveKpisReal(ctx({ netLiquidationValueUsd: 3000, netLiquidationValueChf: 2500, liveRate: 0.88 }, [{}]));
    expect(k.nMax).toBe(1);
    expect(k.nMaxReached).toBe(true);
  });

  it('au-dessus de 6000 CHF → nMax 2 ; avec 1 position → NON atteint', () => {
    const k = deriveKpisReal(ctx({ netLiquidationValueUsd: 10000, netLiquidationValueChf: 8000, liveRate: 0.88 }, [{}]));
    expect(k.nMax).toBe(2);
    expect(k.nMaxReached).toBe(false);
  });

  it('N max plafonné à 2 ; 2 positions au-dessus du seuil → atteint', () => {
    const k = deriveKpisReal(ctx({ netLiquidationValueUsd: 20000, netLiquidationValueChf: 16000, liveRate: 0.88 }, [{}, {}]));
    expect(k.nMax).toBe(2);
    expect(k.nMaxReached).toBe(true);
  });

  it('capital CHF inconnu → nMax null (indéterminé), JAMAIS N max atteint', () => {
    const k = deriveKpisReal(ctx({ netLiquidationValueUsd: 3000, netLiquidationValueChf: null, liveRate: 0 }, [{}, {}, {}]));
    expect(k.nMax).toBeNull();
    expect(k.nMaxReached).toBe(false);
  });
});
