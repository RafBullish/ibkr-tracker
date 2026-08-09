// ═══════════════════════════════════════════════════════════════
//  nlvSeries — série NLV du Héros 1. Deux verrous :
//    1. ANTI-RÉGRESSION FF-données : le drawdown FLOW-NEUTRAL de la
//       série quotidienne est inchangé (un apport ne guérit jamais un
//       drawdown) — c'était non testé jusqu'ici.
//    2. buildIntradaySeries (nouveau) : dépliage du buffer intraday,
//       dépôts soustraits, peak SEEDÉ de l'historique quotidien
//       antérieur à la fenêtre, point live, fenêtre 1/5 séances.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  buildNlvSeries,
  buildIntradaySeries,
  resampleSeries,
  TIMEFRAMES,
  TIMEFRAMES_HERO1,
} from '../nlvSeries';

const D1 = '2026-07-20';
const D2 = '2026-07-21';
const D3 = '2026-07-22';
const D4 = '2026-07-23';

// Epoch (s) d'une heure de séance sur un jour UTC donné.
function ts(dateIso, minute = 0) {
  return Math.floor((new Date(dateIso + 'T15:00:00Z').getTime() + minute * 60_000) / 1000);
}

describe('buildNlvSeries — drawdown flow-neutral (verrou anti-régression)', () => {
  it('un apport ne guérit pas un drawdown : dd mesuré sur nlv − dépôts cumulés', () => {
    const series = buildNlvSeries({
      snapshots: [
        { date: D1, nlv: 10_000 }, // peak flow-neutral
        { date: D2, nlv: 9_000 }, //  dd 1000
        { date: D3, nlv: 11_000 }, // apport +2000 le jour même → fn 9000
      ],
      cashFlows: [{ da: D3, ty: 'dep_usd', a1: 2_000 }],
      closedTrades: [],
      liveNlv: null,
      liveRate: 1,
      today: D3,
    });
    expect(series).toHaveLength(3);
    expect(series[2].nlv).toBe(11_000); // au-dessus du peak nominal…
    expect(series[2].flowNeutral).toBe(9_000);
    expect(series[2].drawdownUsd).toBe(1_000); // …mais toujours 1000 sous l'eau
    expect(series[2].deposit).toBe(true);
  });

  it('point live : écrase le snapshot du jour, sinon s’ajoute marqué live', () => {
    const series = buildNlvSeries({
      snapshots: [{ date: D1, nlv: 10_000 }],
      cashFlows: [],
      closedTrades: [],
      liveNlv: 10_400,
      liveRate: 1,
      today: D2,
    });
    expect(series).toHaveLength(2);
    expect(series[1]).toMatchObject({ date: D2, nlv: 10_400, live: true });
  });
});

describe('buildNlvSeries — fusion dataset (LA COURBE SUIT LE CSV)', () => {
  const csvSeries = {
    source: 'recon',
    baseCurrency: 'CHF',
    days: [
      { d: D1, base: 800 },
      { d: D2, base: 880 },
    ],
  };

  it('série CSV en devise de base convertie via le pipeline existant (÷ liveRate)', () => {
    const series = buildNlvSeries({
      snapshots: [],
      csvSeries,
      cashFlows: [],
      closedTrades: [],
      liveNlv: null,
      liveRate: 0.8,
      today: D4,
    });
    expect(series.map((p) => [p.date, p.nlv, p.src])).toEqual([
      [D1, 1_000, 'recon'],
      [D2, 1_100, 'recon'],
    ]);
  });

  it('priorité par date : CSV > snapshot sur la période ; snapshot au-delà ; live aujourd’hui', () => {
    const series = buildNlvSeries({
      snapshots: [
        { date: D2, nlv: 24_000 }, // relevé app pollué le même jour → PERD contre le CSV
        { date: D3, nlv: 1_150 }, // après la période CSV → gardé
      ],
      csvSeries,
      cashFlows: [],
      closedTrades: [],
      liveNlv: 1_180,
      liveRate: 0.8,
      today: D4,
    });
    expect(series.map((p) => [p.date, p.nlv, p.src])).toEqual([
      [D1, 1_000, 'recon'],
      [D2, 1_100, 'recon'],
      [D3, 1_150, 'snap'],
      [D4, 1_180, 'live'],
    ]);
    expect(series[3].live).toBe(true);
  });

  it('un NAV CSV à 0 est un point légitime (compte vide en début de période)', () => {
    const series = buildNlvSeries({
      snapshots: [],
      csvSeries: { source: 'nav', baseCurrency: 'CHF', days: [{ d: D1, base: 0 }, { d: D2, base: 80 }] },
      cashFlows: [],
      closedTrades: [],
      liveNlv: null,
      liveRate: 0.8,
      today: D4,
    });
    expect(series[0]).toMatchObject({ date: D1, nlv: 0, src: 'nav' });
  });

  it('retraits annotés (flux de financement négatifs), au même titre que les apports', () => {
    const series = buildNlvSeries({
      snapshots: [
        { date: D1, nlv: 10_000 },
        { date: D2, nlv: 9_500 },
      ],
      cashFlows: [{ da: D2, ty: 'wit_usd', a1: 500 }],
      closedTrades: [],
      liveNlv: null,
      liveRate: 1,
      today: D2,
    });
    expect(series[1].withdrawal).toBe(true);
    expect(series[1].withdrawalAmount).toBe(500);
    // Flow-neutral : un retrait ne crée pas de drawdown.
    expect(series[1].drawdownUsd).toBe(0);
  });
});

describe('ranges', () => {
  it('1D est réservé au Héros 1 (TIMEFRAMES partagés inchangés pour Héros 2)', () => {
    expect(TIMEFRAMES).not.toContain('1D');
    expect(TIMEFRAMES_HERO1[0]).toBe('1D');
    expect(TIMEFRAMES_HERO1.slice(1)).toEqual(TIMEFRAMES);
  });

  it('resampleSeries fenêtre 1D en fallback quotidien (points du dernier jour)', () => {
    const daily = buildNlvSeries({
      snapshots: [
        { date: D1, nlv: 10_000 },
        { date: D2, nlv: 10_100 },
        { date: D3, nlv: 10_200 },
      ],
      cashFlows: [],
      closedTrades: [],
      liveNlv: null,
      liveRate: 1,
      today: D3,
    });
    const w = resampleSeries(daily, '1D');
    expect(w.length).toBeLessThanOrEqual(2);
    expect(w[w.length - 1].date).toBe(D3);
  });
});

describe('buildIntradaySeries (FF-données)', () => {
  const dailySeed = () =>
    buildNlvSeries({
      snapshots: [
        { date: D1, nlv: 10_000 },
        { date: D2, nlv: 12_000 }, // high-water mark historique
        { date: D3, nlv: 11_000 },
      ],
      cashFlows: [],
      closedTrades: [],
      liveNlv: null,
      liveRate: 1,
      today: D3,
    });

  it('déplie les échantillons en points datés, chg entre points', () => {
    const s = buildIntradaySeries({
      dailySeries: dailySeed(),
      intradayDays: [{ d: D4, pts: [[ts(D4, 0), 11_500], [ts(D4, 5), 10_800]] }],
      liveNlv: null,
      sessionDays: 1,
    });
    expect(s).toHaveLength(2);
    expect(s[0].nlv).toBe(11_500);
    expect(s[0].chg).toBe(0);
    expect(s[1].chg).toBe(-700);
    // t = epoch décalée à l'heure locale (axe lightweight-charts lisible)
    const off = new Date(ts(D4, 0) * 1000).getTimezoneOffset() * 60;
    expect(s[0].t).toBe(ts(D4, 0) - off);
    expect(s[0].date.startsWith(D4 + 'T')).toBe(true);
  });

  it('drawdown intraday mesuré contre le peak QUOTIDIEN antérieur à la fenêtre', () => {
    const s = buildIntradaySeries({
      dailySeries: dailySeed(), // peak flow-neutral historique = 12 000 (D2)
      intradayDays: [{ d: D4, pts: [[ts(D4, 0), 11_500], [ts(D4, 5), 10_800]] }],
      liveNlv: null,
      sessionDays: 1,
    });
    expect(s[0].drawdownUsd).toBe(500); // 12 000 − 11 500
    expect(s[1].underwater).toBe(-1_200); // 12 000 − 10 800
  });

  it('les dépôts du jour sont soustraits (flow-neutral, comme la série quotidienne)', () => {
    const daily = buildNlvSeries({
      snapshots: [
        { date: D1, nlv: 10_000 },
        { date: D2, nlv: 15_200 }, // apport +5000 le D2 → fn 10 200
      ],
      cashFlows: [{ da: D2, ty: 'dep_usd', a1: 5_000 }],
      closedTrades: [],
      liveNlv: null,
      liveRate: 1,
      today: D2,
    });
    const s = buildIntradaySeries({
      dailySeries: daily,
      intradayDays: [{ d: D2, pts: [[ts(D2, 0), 15_100], [ts(D2, 5), 14_900]] }],
      liveNlv: null,
      sessionDays: 1,
    });
    expect(s[0].flowNeutral).toBe(10_100);
    expect(s[1].drawdownUsd).toBe(200); // 10 100 (peak intraday) − 9 900
  });

  it('point live ajouté en dernier, marqué live', () => {
    const nowMs = (ts(D4, 30) + 90) * 1000;
    const s = buildIntradaySeries({
      dailySeries: dailySeed(),
      intradayDays: [{ d: D4, pts: [[ts(D4, 0), 11_500]] }],
      liveNlv: 11_650,
      sessionDays: 1,
      nowMs,
    });
    expect(s).toHaveLength(2);
    expect(s[1]).toMatchObject({ nlv: 11_650, live: true });
    expect(s[1].t).toBeGreaterThan(s[0].t);
  });

  it('fenêtre : sessionDays limite aux N dernières séances échantillonnées', () => {
    const days = [
      { d: D1, pts: [[ts(D1, 0), 9_900]] },
      { d: D2, pts: [[ts(D2, 0), 11_900]] },
      { d: D3, pts: [[ts(D3, 0), 11_100]] },
    ];
    const one = buildIntradaySeries({ dailySeries: dailySeed(), intradayDays: days, sessionDays: 1 });
    expect(one.map((p) => p.date.slice(0, 10))).toEqual([D3]);
    const five = buildIntradaySeries({ dailySeries: dailySeed(), intradayDays: days, sessionDays: 5 });
    expect(five.map((p) => p.date.slice(0, 10))).toEqual([D1, D2, D3]);
  });

  it('buffer vide → [] (fallback quotidien côté Héros 1)', () => {
    expect(buildIntradaySeries({ dailySeries: dailySeed(), intradayDays: [], sessionDays: 5 })).toEqual([]);
  });
});
