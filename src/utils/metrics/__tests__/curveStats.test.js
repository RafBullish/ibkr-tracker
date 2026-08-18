// ═══════════════════════════════════════════════════════════════
//  curveStats — É3.1 « vérité des chiffres ». Un test par fonction du
//  module, fixtures synthétiques. Verrous des bugs du constat 15.08 :
//  · daysSincePeak en jours CALENDAIRES vers asOf (le « 11 » pour un
//    pic vieux de 110 jours est mort) ;
//  · joursGagnants : verts + rouges = total, toujours ;
//  · deltaNet = Σ Δ×qty×mul×sign (la formule ×prime est morte) ;
//  · recovery : null sans drawdown.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  peakOf,
  currentDrawdownOf,
  maxDrawdownOf,
  daysSincePeakOf,
  recoveryOf,
  joursGagnants,
} from '../curveStats';

const pt = (date, value) => ({ date, value });

// Courbe synthétique : monte à 500 (pic), creux à 100, remonte à 320.
const CURVE = [
  pt('2026-04-20', 200),
  pt('2026-04-27', 500),
  pt('2026-05-10', 100),
  pt('2026-06-01', 320),
];

describe('peakOf', () => {
  it('retourne le maximum daté (premier max strict)', () => {
    expect(peakOf(CURVE)).toEqual({ value: 500, date: '2026-04-27', index: 1 });
  });

  it('null sur courbe vide ou sans valeur finie', () => {
    expect(peakOf([])).toBe(null);
    expect(peakOf([{ date: '2026-01-01', value: NaN }])).toBe(null);
  });
});

describe('currentDrawdownOf — DD courant par courbe', () => {
  it('pic − dernier point, ≥ 0, avec dates', () => {
    const dd = currentDrawdownOf(CURVE);
    expect(dd.usd).toBe(180); // 500 − 320
    expect(dd.peakDate).toBe('2026-04-27');
    expect(dd.lastDate).toBe('2026-06-01');
  });

  it('0 quand le dernier point EST le pic', () => {
    expect(currentDrawdownOf([pt('a', 1), pt('b', 5)]).usd).toBe(0);
  });
});

describe('maxDrawdownOf — max DD de fenêtre par courbe', () => {
  it('pic→creux daté', () => {
    const dd = maxDrawdownOf(CURVE);
    expect(dd.usd).toBe(400); // 500 → 100
    expect(dd.peakDate).toBe('2026-04-27');
    expect(dd.troughDate).toBe('2026-05-10');
  });

  it('0 sur courbe monotone croissante', () => {
    expect(maxDrawdownOf([pt('a', 1), pt('b', 2), pt('c', 3)]).usd).toBe(0);
  });
});

describe('daysSincePeakOf — jours CALENDAIRES + date du pic', () => {
  it('scénario du constat : pic 2026-04-27, asOf 2026-08-15 → 110 j (plus jamais 11)', () => {
    const r = daysSincePeakOf(CURVE, '2026-08-15');
    expect(r).toEqual({ days: 110, date: '2026-04-27' });
  });

  it('sans asOf : référence = dernier point de la courbe', () => {
    expect(daysSincePeakOf(CURVE)).toEqual({ days: 35, date: '2026-04-27' }); // 27.04 → 01.06
  });

  it('0 j quand le pic est le point courant', () => {
    const r = daysSincePeakOf([pt('2026-08-01', 1), pt('2026-08-15', 9)], '2026-08-15');
    expect(r).toEqual({ days: 0, date: '2026-08-15' });
  });
});

describe('recoveryOf — P&L / max DD de la MÊME courbe', () => {
  it('13 240 / 777 = 17.04 (numérateur RÉAL) et 12 947 / 777 = 16.66 (numérateur NLV) : deux courbes, deux valeurs assumées', () => {
    expect(recoveryOf(13_240, 777)).toBeCloseTo(17.04, 2);
    expect(recoveryOf(12_947, 777)).toBeCloseTo(16.66, 2);
  });

  it('null sans drawdown (pas d’Infinity d’affichage)', () => {
    expect(recoveryOf(500, 0)).toBe(null);
    expect(recoveryOf(500, null)).toBe(null);
  });
});

describe('joursGagnants — LA définition unique', () => {
  it('jours avec clôture, signe du P&L net : verts + rouges = total', () => {
    const jg = joursGagnants([
      { date: 'a', pnl: 120 },
      { date: 'b', pnl: -80 },
      { date: 'c', pnl: 40 },
      { date: 'd', pnl: 0 }, // net 0 → non gagnant
    ]);
    expect(jg).toEqual({ verts: 2, rouges: 2, total: 4, pct: 50 });
    expect(jg.verts + jg.rouges).toBe(jg.total);
  });

  it('pct null sans aucun jour de clôture (jamais 0 % mensonger)', () => {
    expect(joursGagnants([]).pct).toBe(null);
  });
});

// É4-b — describe('realCurve / nlvCurve') et describe('greeksTotals')
// SUPPRIMÉS : exports morts retirés (cf. curveStats.js). Les maisons
// vivantes (buildNlvSeries, aggregateGreeks) gardent leurs propres tests.
