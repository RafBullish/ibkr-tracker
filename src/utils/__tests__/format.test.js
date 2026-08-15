// ═══════════════════════════════════════════════════════════════
//  format — É3.3 « langue & formats » : un seul format par famille.
//  Verrous du constat 15.08 : plus de « Sep'26 / Aoû'26 », plus de
//  yyyy-mm-dd ni de dd/mm à l'écran, milliers suisses ≥ 1'000,
//  strikes sans centimes inutiles.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { fmtDate, fmtExpiry, fmtStrike, fmtUsdSigned2, fmtUsd2 } from '../format';

describe('fmtDate — dd.mm.yy partout', () => {
  it('ISO → dd.mm.yy (le « 2026-04-27 » du constat devient 27.04.26)', () => {
    expect(fmtDate('2026-04-27')).toBe('27.04.26');
    expect(fmtDate('2026-08-15T08:00:00.000Z')).toBe('15.08.26');
  });

  it('invalide → « — »', () => {
    expect(fmtDate(null)).toBe('—');
    expect(fmtDate('garbage')).toBe('—');
    expect(fmtDate('26-04')).toBe('—');
  });
});

describe('fmtExpiry — notation IBKR DDMMMYY (registres de Rafael)', () => {
  it("échéances : '2026-09-18' → 18SEP26, '2026-08-21' → 21AUG26", () => {
    expect(fmtExpiry('2026-09-18')).toBe('18SEP26');
    expect(fmtExpiry('2026-08-21')).toBe('21AUG26');
  });

  it("plus jamais « Sep'26 » ni « Aoû'26 »", () => {
    expect(fmtExpiry('2026-09-29')).not.toContain("'");
    expect(fmtExpiry('2026-08-21')).not.toMatch(/Aoû/);
  });

  it('invalide → « — »', () => {
    expect(fmtExpiry(null)).toBe('—');
    expect(fmtExpiry('2026-13-01')).toBe('—');
  });
});

describe('fmtStrike — sans décimales si entier, milliers suisses', () => {
  it('$630 (plus de $630.00), $1’100 avec apostrophe', () => {
    expect(fmtStrike(630)).toBe('$630');
    expect(fmtStrike(1100)).toBe("$1'100");
  });

  it('strike non entier garde 2 décimales', () => {
    expect(fmtStrike(632.5)).toBe('$632.50');
  });

  it('0 / invalide → « — »', () => {
    expect(fmtStrike(0)).toBe('—');
    expect(fmtStrike(null)).toBe('—');
  });
});

describe('fmtUsdSigned2 / fmtUsd2 — milliers suisses sur tout montant ≥ 1’000', () => {
  it('le « +$2676.11 » du constat devient +$2’676.11', () => {
    expect(fmtUsdSigned2(2676.11)).toBe("+$2'676.11");
    expect(fmtUsdSigned2(-1412.01)).toBe("−$1'412.01");
  });

  it('$1’100.00 groupé, sous 1’000 inchangé', () => {
    expect(fmtUsd2(1100)).toBe("$1'100.00");
    expect(fmtUsd2(630)).toBe('$630.00');
  });

  it('0 / invalide honnêtes', () => {
    expect(fmtUsdSigned2(0)).toBe('$0.00');
    expect(fmtUsdSigned2(NaN)).toBe('—');
  });
});
