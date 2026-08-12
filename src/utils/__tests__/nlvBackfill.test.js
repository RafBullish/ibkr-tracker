// ═══════════════════════════════════════════════════════════════
//  nlvBackfill — l'histoire reconstituée (FIX-NLV). Verrous :
//    · C0 implicite (avec flux, sans flux, clamp à 0)
//    · série reconstruite jour par jour (dense, cumuls corrects)
//    · arrêt à la VEILLE du premier point réel
//    · flag synth sur chaque point
//    · série vide si zéro trade ET zéro flux (comportement v1.0.0)
//    · série vide sans ancre live (C0 incalculable)
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { buildBackfillDays } from '../nlvBackfill';

const D = (s) => `2026-07-${String(s).padStart(2, '0')}`;

describe('buildBackfillDays — C0 implicite', () => {
  it('C0 = NLV live − unrealized − Σ réalisé − Σ flux (avec flux)', () => {
    const { days, c0, c0Clamped } = buildBackfillDays({
      cashFlows: [{ da: D(10), ty: 'dep_usd', a1: '5000' }],
      closedTrades: [{ do: D(15), pnl: 2000 }],
      liveNlv: 12_000,
      liveRate: 1,
      unrealizedLive: 500,
      firstRealDate: D(20),
    });
    expect(c0).toBe(12_000 - 500 - 2_000 - 5_000); // 4 500
    expect(c0Clamped).toBe(false);
    // J10 (premier événement) → J19 (veille du premier réel) : 10 jours
    expect(days).toHaveLength(10);
    expect(days[0]).toMatchObject({ date: D(10), nlv: 9_500, synth: true }); // C0 + dépôt
    expect(days[4].nlv).toBe(9_500); // J14 : rien depuis
    expect(days[5].nlv).toBe(11_500); // J15 : + réalisé 2000
    expect(days[9]).toMatchObject({ date: D(19), nlv: 11_500 });
  });

  it('sans flux : C0 ancré sur les clôtures seules', () => {
    const { days, c0 } = buildBackfillDays({
      cashFlows: [],
      closedTrades: [
        { do: D(5), pnl: 300 },
        { do: D(8), pnl: -100 },
      ],
      liveNlv: 10_200,
      liveRate: 1,
      unrealizedLive: 0,
      firstRealDate: D(10),
    });
    expect(c0).toBe(10_000); // 10 200 − 0 − 200 − 0
    expect(days.map((d) => d.nlv)).toEqual([10_300, 10_300, 10_300, 10_200, 10_200]); // J5..J9
  });

  it('C0 négatif → clampé à 0 et signalé', () => {
    const { days, c0, c0Clamped } = buildBackfillDays({
      cashFlows: [],
      closedTrades: [{ do: D(5), pnl: 2_000 }],
      liveNlv: 1_000,
      liveRate: 1,
      unrealizedLive: 0,
      firstRealDate: D(8),
    });
    expect(c0).toBe(0);
    expect(c0Clamped).toBe(true);
    expect(days[0].nlv).toBe(2_000); // 0 + réalisé
  });

  it('les flux CHF passent par la même normalisation (dépôt CHF / liveRate)', () => {
    const { c0, days } = buildBackfillDays({
      cashFlows: [{ da: D(10), ty: 'dep_chf', a1: '880' }], // 880 CHF @ 0.88 = 1000 USD
      closedTrades: [],
      liveNlv: 1_500,
      liveRate: 0.88,
      unrealizedLive: 0,
      firstRealDate: D(12),
    });
    expect(c0).toBe(500);
    expect(days[0].nlv).toBe(1_500);
  });
});

describe('buildBackfillDays — bornes & flags', () => {
  it("s'arrête à la VEILLE du premier point réel, jamais dessus", () => {
    const { days } = buildBackfillDays({
      cashFlows: [{ da: D(1), ty: 'dep_usd', a1: '1000' }],
      closedTrades: [],
      liveNlv: 1_000,
      liveRate: 1,
      unrealizedLive: 0,
      firstRealDate: D(4),
    });
    expect(days.map((d) => d.date)).toEqual([D(1), D(2), D(3)]);
  });

  it('chaque point porte synth:true', () => {
    const { days } = buildBackfillDays({
      cashFlows: [{ da: D(1), ty: 'dep_usd', a1: '1000' }],
      closedTrades: [],
      liveNlv: 1_000,
      liveRate: 1,
      unrealizedLive: 0,
      firstRealDate: D(3),
    });
    expect(days.length).toBeGreaterThan(0);
    expect(days.every((d) => d.synth === true)).toBe(true);
  });

  it('zéro trade ET zéro flux → série vide (comportement actuel intact)', () => {
    const out = buildBackfillDays({
      cashFlows: [],
      closedTrades: [],
      liveNlv: 10_000,
      liveRate: 1,
      unrealizedLive: 0,
      firstRealDate: D(10),
    });
    expect(out.days).toEqual([]);
    expect(out.c0).toBe(null);
  });

  it('sans NLV live (ancre) → série vide, C0 incalculable', () => {
    const out = buildBackfillDays({
      cashFlows: [{ da: D(1), ty: 'dep_usd', a1: '1000' }],
      closedTrades: [{ do: D(2), pnl: 100 }],
      liveNlv: null,
      liveRate: 1,
      unrealizedLive: 0,
      firstRealDate: D(10),
    });
    expect(out.days).toEqual([]);
    expect(out.c0).toBe(null);
  });

  it('premier réel ANTÉRIEUR au premier événement → rien à reconstituer', () => {
    const out = buildBackfillDays({
      cashFlows: [{ da: D(20), ty: 'dep_usd', a1: '1000' }],
      closedTrades: [],
      liveNlv: 1_000,
      liveRate: 1,
      unrealizedLive: 0,
      firstRealDate: D(5),
    });
    expect(out.days).toEqual([]);
  });

  it('normalise les dates ISO longues (t.do avec heure) sur le jour', () => {
    const { days } = buildBackfillDays({
      cashFlows: [],
      closedTrades: [{ do: D(5) + 'T14:30:00Z', pnl: 250 }],
      liveNlv: 1_250,
      liveRate: 1,
      unrealizedLive: 0,
      firstRealDate: D(7),
    });
    expect(days.map((d) => d.date)).toEqual([D(5), D(6)]);
    expect(days[0].nlv).toBe(1_250);
  });
});
