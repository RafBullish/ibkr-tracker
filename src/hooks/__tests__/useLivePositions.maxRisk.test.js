// ═══════════════════════════════════════════════════════════════
//  B5-3 — Σ MAX RISK = -Σ costBasisUsd (prime payée)
//
//  Verrouille la nouvelle convention : pour la stratégie Sniper OTM
//  long-premium, le Max Risk d'une position = la prime engagée
//  (capitalTiedUp = pi × mul × ct + fi). Σ Max Risk est donc négatif
//  (perte potentielle = -prime). Indépendant du mark-to-market courant.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { buildLivePositions } from '../useLivePositions';

const NOW = new Date('2026-05-25T12:00:00Z');

function longCall({ tk, pi, ct, fi, pc }) {
  return {
    id: `pos-${tk}`,
    as: 'Option',
    dir: 'Long',
    ty: 'CALL',
    tk,
    st: '100',
    ex: '2026-12-19',
    di: '2025-12-01',
    ct: String(ct),
    mu: '100',
    pi: String(pi),
    pc: String(pc),
    fi: String(fi),
    fxi: '0',
  };
}

describe('B5-3 — Σ MAX RISK utilise costBasisUsd (prime payée)', () => {
  it('5 long calls — Σ Max Risk = -Σ costBasisUsd', () => {
    // costBasisUsd long = pi × mul × ct + fi
    const positions = [
      longCall({ tk: 'AAPL', pi: 5, ct: 1, fi: 1, pc: 4 }), // 5×100×1+1=501
      longCall({ tk: 'MSFT', pi: 3, ct: 2, fi: 2, pc: 2.5 }), // 3×100×2+2=602
      longCall({ tk: 'XOM', pi: 2, ct: 1, fi: 0.5, pc: 1.5 }), // 2×100×1+0.5=200.5
      longCall({ tk: 'NVDA', pi: 4, ct: 3, fi: 1.5, pc: 3 }), // 4×100×3+1.5=1201.5
      longCall({ tk: 'TSLA', pi: 6, ct: 1, fi: 1, pc: 5 }), // 6×100×1+1=601
    ];
    // Σ costBasis = 501 + 602 + 200.5 + 1201.5 + 601 = 3106
    // Σ Max Risk attendu = -3106
    const result = buildLivePositions(positions, { now: NOW });
    expect(result.totalMaxRisk).toBeCloseTo(-3106, 2);
  });

  it('Σ Max Risk indépendant du mark courant — varie pc ne bouge PAS Max Risk', () => {
    const pos = longCall({ tk: 'AAPL', pi: 5, ct: 1, fi: 1, pc: 0.1 });
    const r1 = buildLivePositions([pos], { now: NOW });
    pos.pc = '100';
    const r2 = buildLivePositions([pos], { now: NOW });
    // costBasisUsd inchangé (ne dépend pas de pc), donc Max Risk stable
    expect(r1.totalMaxRisk).toBeCloseTo(r2.totalMaxRisk, 2);
    expect(r1.totalMaxRisk).toBeCloseTo(-501, 2);
  });

  it('signe négatif — Σ Max Risk = -Σ |prime| (loss convention)', () => {
    const positions = [longCall({ tk: 'AAPL', pi: 5, ct: 1, fi: 0, pc: 5 })];
    const result = buildLivePositions(positions, { now: NOW });
    expect(result.totalMaxRisk).toBeLessThan(0);
    expect(Math.abs(result.totalMaxRisk)).toBeCloseTo(500, 2);
  });

  it('aucune position → Σ Max Risk = 0', () => {
    const result = buildLivePositions([], { now: NOW });
    expect(result.totalMaxRisk).toBe(0);
  });

  it('régression — Σ Max Risk N\'EST PLUS la somme des unrealized losses', () => {
    // Pré-B5 : Σ Max Risk = Σ unrealDollar | < 0.
    // Sur 2 longs profitables (pc > pi), Σ unrealDollar < 0 vaudrait 0.
    // Avec le fix : Σ Max Risk = -(prime totale) = négatif non nul.
    const positions = [
      longCall({ tk: 'AAPL', pi: 5, ct: 1, fi: 0, pc: 10 }), // profit, costBasis=500
      longCall({ tk: 'MSFT', pi: 3, ct: 1, fi: 0, pc: 6 }), // profit, costBasis=300
    ];
    const result = buildLivePositions(positions, { now: NOW });
    // Tous profitables → ancien calcul aurait donné 0
    // Nouveau calcul → -800
    expect(result.totalMaxRisk).toBeCloseTo(-800, 2);
    expect(result.totalMaxRisk).not.toBe(0);
  });
});
