// ═══════════════════════════════════════════════════════════════
//  computeCalmar — gate relâchée yearsActive > 0 (anciennement ≥ 1).
//
//  Le helper attend désormais une CAGR ANNUALISÉE de la part du caller
//  (calculations.js force l'annualisation avant l'appel, même < 1 an).
//  Le flag `preliminaryRatios` côté metrics + marqueur UI signalent
//  l'artefact d'échantillon court.
//
//  Sharpe / Sortino / Vol n'ont jamais été gated sur years ≥ 1 ; le
//  gating Calmar était l'incohérence visible (cockpit "—" alors que
//  Sharpe affichait une valeur). Corrigé ici.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { computeCalmar } from '../computeCalmar';

describe('computeCalmar — gate years > 0', () => {
  it('years ≥ 1 + valid inputs → finite ratio', () => {
    const result = computeCalmar({
      cagrPct: 12.0,
      maxDrawdownPct: 4.0,
      yearsActive: 1.5,
    });
    expect(result).toBeCloseTo(3.0, 5);
  });

  it('years EXACTLY 1.0 → finite (inclusive boundary)', () => {
    const result = computeCalmar({
      cagrPct: 10,
      maxDrawdownPct: 5,
      yearsActive: 1,
    });
    expect(result).toBeCloseTo(2.0, 5);
  });

  it('years = 0.4 + cagr annualisé fourni → finite (caller a annualisé)', () => {
    // Refonte : Calmar accepte years < 1 si le caller fournit déjà une
    // CAGR annualisée. Le flag preliminaryRatios (côté metrics) signale
    // l'artefact d'échantillon court à l'UI.
    expect(
      computeCalmar({ cagrPct: 118, maxDrawdownPct: 5, yearsActive: 0.4 })
    ).toBeCloseTo(23.6, 1);
  });

  it('years = 0 ou négatif → null', () => {
    expect(
      computeCalmar({ cagrPct: 10, maxDrawdownPct: 5, yearsActive: 0 })
    ).toBeNull();
    expect(
      computeCalmar({ cagrPct: 10, maxDrawdownPct: 5, yearsActive: -1 })
    ).toBeNull();
  });

  it('years missing → null', () => {
    expect(computeCalmar({ cagrPct: 10, maxDrawdownPct: 5 })).toBeNull();
  });

  it('years non-finite → null', () => {
    expect(
      computeCalmar({ cagrPct: 10, maxDrawdownPct: 5, yearsActive: NaN })
    ).toBeNull();
  });

  it('cagrPct=null → null (cascade)', () => {
    expect(
      computeCalmar({ cagrPct: null, maxDrawdownPct: 5, yearsActive: 2 })
    ).toBeNull();
  });

  it('maxDrawdownPct=null → null', () => {
    expect(
      computeCalmar({ cagrPct: 10, maxDrawdownPct: null, yearsActive: 2 })
    ).toBeNull();
  });

  it('maxDrawdownPct=0 → null (undefined ratio)', () => {
    expect(
      computeCalmar({ cagrPct: 50, maxDrawdownPct: 0, yearsActive: 2 })
    ).toBeNull();
  });

  it('maxDrawdownPct negative → null', () => {
    expect(
      computeCalmar({ cagrPct: 50, maxDrawdownPct: -3, yearsActive: 2 })
    ).toBeNull();
  });

  it('non-finite cagrPct → null', () => {
    expect(
      computeCalmar({ cagrPct: Infinity, maxDrawdownPct: 5, yearsActive: 2 })
    ).toBeNull();
    expect(
      computeCalmar({ cagrPct: NaN, maxDrawdownPct: 5, yearsActive: 2 })
    ).toBeNull();
  });
});
