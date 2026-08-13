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
  isWritableNlv,
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

  it('ignore les points nlv ≤ 0 du buffer (falaises à zéro impossibles)', () => {
    const s = buildIntradaySeries({
      dailySeries: dailySeed(),
      intradayDays: [{ d: D4, pts: [[ts(D4, 0), 0], [ts(D4, 5), 11_000]] }],
      sessionDays: 1,
    });
    expect(s.map((p) => p.nlv)).toEqual([11_000]);
  });
});

// ═══ POLISH-1 (v1.0.1) — gardes & pureté ═════════════════════════
describe('isWritableNlv — garde des writers de snapshots (E5)', () => {
  it('accepte uniquement un nombre fini strictement positif', () => {
    expect(isWritableNlv(10_000.5)).toBe(true);
    expect(isWritableNlv(0.01)).toBe(true);
  });

  it('refuse 0, négatif, NaN, ±Infinity, null, undefined, string', () => {
    for (const bad of [0, -5, NaN, Infinity, -Infinity, null, undefined, '10000']) {
      expect(isWritableNlv(bad)).toBe(false);
    }
  });
});

describe('buildNlvSeries — pureté vis-à-vis du store (E6)', () => {
  it('le merge du point live ne MUTE pas l’objet snapshot du store', () => {
    const snapDuJour = { date: D2, nlv: 10_000 };
    const series = buildNlvSeries({
      snapshots: [snapDuJour],
      cashFlows: [],
      closedTrades: [],
      liveNlv: 10_400,
      liveRate: 1,
      today: D2,
    });
    expect(series[0].nlv).toBe(10_400); // le live écrase… à l'affichage
    expect(snapDuJour.nlv).toBe(10_000); // …jamais l'objet du store
  });
});

// ═══ FIX-NLV (v1.0.1) — l'histoire reconstituée ══════════════════
describe('buildNlvSeries — histoire reconstituée (FIX-NLV)', () => {
  it('reconstitue les jours AVANT le premier snapshot réel depuis clôtures + flux', () => {
    const series = buildNlvSeries({
      snapshots: [{ date: D4, nlv: 21_000 }], // UN snapshot, daté d'aujourd'hui
      cashFlows: [{ da: D1, ty: 'dep_usd', a1: '10000' }],
      closedTrades: [{ do: D2, pnl: 500 }],
      liveNlv: 10_700,
      liveRate: 1,
      today: D4,
      unrealizedLive: 200,
    });
    // C0 = 10 700 − 200 − 500 − 10 000 = 0
    expect(series.map((p) => p.date)).toEqual([D1, D2, D3, D4]);
    expect(series.map((p) => p.nlv)).toEqual([10_000, 10_500, 10_500, 10_700]);
    expect(series.map((p) => p.synth)).toEqual([true, true, true, false]);
    // flow-neutral dès le premier jour reconstitué : dépôt soustrait
    expect(series[0].flowNeutral).toBe(0);
    // le jour de clôture reconstitué porte son marqueur (dayPnl)
    expect(series[1].dayPnl).toBe(500);
  });

  it('un point réel PRIME toujours : la reconstitution s’arrête la veille', () => {
    const series = buildNlvSeries({
      snapshots: [
        { date: D2, nlv: 11_111 }, // réel, valeur divergente
        { date: D4, nlv: 12_000 },
      ],
      cashFlows: [{ da: D1, ty: 'dep_usd', a1: '10000' }],
      closedTrades: [],
      liveNlv: 12_000,
      liveRate: 1,
      today: D4,
      unrealizedLive: 0,
    });
    // C0 = 2 000 → J1 reconstitué = 12 000 ; J2 = snapshot RÉEL intact
    expect(series.map((p) => p.date)).toEqual([D1, D2, D4]);
    expect(series[0]).toMatchObject({ nlv: 12_000, synth: true });
    expect(series[1]).toMatchObject({ nlv: 11_111, synth: false });
  });

  it('sans NLV live (ancre C0) : aucun backfill — comportement v1.0.0', () => {
    const series = buildNlvSeries({
      snapshots: [{ date: D3, nlv: 10_000 }],
      cashFlows: [{ da: D1, ty: 'dep_usd', a1: '9000' }],
      closedTrades: [{ do: D2, pnl: 100 }],
      liveNlv: null,
      liveRate: 1,
      today: D3,
    });
    expect(series).toHaveLength(1);
    expect(series[0].synth).toBe(false);
  });

  it('zéro trade ET zéro flux : série strictement inchangée (pas de synth)', () => {
    const series = buildNlvSeries({
      snapshots: [{ date: D3, nlv: 10_000 }],
      cashFlows: [],
      closedTrades: [],
      liveNlv: 10_100,
      liveRate: 1,
      today: D4,
      unrealizedLive: 50,
    });
    expect(series.map((p) => p.synth)).toEqual([false, false]);
  });

  it('resampleSeries préserve le flag synth au bucketing (fenêtres longues)', () => {
    const mk = (i, synth) => ({
      date: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10),
      nlv: 10_000 + i,
      flowNeutral: 10_000 + i,
      deposit: false,
      tradeCount: 0,
      dayPnl: null,
      synth,
    });
    const long = Array.from({ length: 200 }, (_, i) => mk(i, i < 100));
    const rs = resampleSeries(long, 'ALL');
    expect(rs.length).toBeLessThanOrEqual(190);
    expect(rs.some((p) => p.synth)).toBe(true); // les buckets reconstitués le disent
    expect(rs[rs.length - 1].synth).toBe(false); // la fin réelle reste réelle
  });
});
