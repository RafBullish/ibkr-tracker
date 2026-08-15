// ═══════════════════════════════════════════════════════════════
//  heroStats — vérité pré-resample du pied de Héros 1 (HERO-FOOTER).
//  Verrous :
//    · fenêtre courte : le fenêtrage partagé (sliceSeriesWindow) rend
//      EXACTEMENT la même série que resampleSeries sous le cap 190 ;
//    · fenêtre longue (> 190 pts) : les compteurs restent en JOURS /
//      TRADES vrais — le resample (buckets) ne les touche PLUS ;
//    · garde D6 : % de drawdown aberrant (|%| > 100) → null (« — »),
//      le $ reste ;
//    · compteurs de fenêtre : clôtures hors fenêtre exclues.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { deriveHeroWindowStats } from '../heroStats';
import { buildNlvSeries, resampleSeries, sliceSeriesWindow } from '../nlvSeries';

const iso = (i) => new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);

// Série longue RÉALISTE : 260 snapshots quotidiens + 100 clôtures sur
// 50 jours distincts (2 par jour, un jour sur cinq).
function longFixture() {
  const snapshots = [];
  for (let i = 0; i < 260; i++) {
    snapshots.push({ date: iso(i), nlv: 10_000 + i * 20 + (i % 7) * 35 });
  }
  const closedTrades = [];
  for (let k = 0; k < 100; k++) {
    const day = iso(5 + (k % 50) * 5); // 50 jours distincts, espacés de 5 j
    closedTrades.push({ id: `t${k}`, do: day, pnl: k % 3 === 2 ? -80 : 120 });
  }
  const dailyFull = buildNlvSeries({
    snapshots,
    cashFlows: [],
    closedTrades,
    liveNlv: null,
    liveRate: 1,
    today: iso(259),
  });
  return { dailyFull, closedTrades };
}

describe('sliceSeriesWindow — fenêtrage partagé', () => {
  it('sous le cap 190, rend EXACTEMENT la série que resampleSeries affiche', () => {
    const { dailyFull } = longFixture();
    for (const range of ['1M', '3M']) {
      expect(sliceSeriesWindow(dailyFull, range)).toEqual(resampleSeries(dailyFull, range));
    }
  });

  it('ALL rend la série entière (le resample, lui, bucketise au-delà de 190)', () => {
    const { dailyFull } = longFixture();
    expect(sliceSeriesWindow(dailyFull, 'ALL')).toHaveLength(260);
    expect(resampleSeries(dailyFull, 'ALL').length).toBeLessThanOrEqual(190);
  });
});

describe('deriveHeroWindowStats — vérité pré-resample', () => {
  it('fenêtre longue : J. CLÔTURE et TRADES restent VRAIS malgré le bucketing du tracé', () => {
    const { dailyFull, closedTrades } = longFixture();
    const s = deriveHeroWindowStats({ dailyFull, range: 'ALL', closedTrades });
    expect(s.closeDays).toBe(50); // jours distincts avec ≥1 clôture
    expect(s.tradeCount).toBe(100); // clôtures de la fenêtre
    // La maladie qu'on tue : le tracé ALL est bucketisé (≤ 190 pts) —
    // l'ancien modèle y comptait ~38 « clôtures » (semaines).
    const buckets = resampleSeries(dailyFull, 'ALL');
    const oldCount = buckets.filter((p) => p.dayPnl != null).length;
    expect(oldCount).toBeLessThan(50);
  });

  it('extrêmes et meilleurs/pires jours = valeurs QUOTIDIENNES vraies', () => {
    const { dailyFull, closedTrades } = longFixture();
    const s = deriveHeroWindowStats({ dailyFull, range: 'ALL', closedTrades });
    const nlvs = dailyFull.map((p) => p.nlv);
    expect(s.high).toBe(Math.max(...nlvs));
    expect(s.low).toBe(Math.min(...nlvs));
    let best = null;
    let worst = null;
    for (let i = 1; i < dailyFull.length; i++) {
      const d = dailyFull[i].flowNeutral - dailyFull[i - 1].flowNeutral;
      if (best == null || d > best) best = d;
      if (worst == null || d < worst) worst = d;
    }
    expect(s.bestDay).toBe(best);
    expect(s.worstDay).toBe(worst);
  });

  it('compteurs de fenêtre : les clôtures HORS fenêtre sont exclues', () => {
    const { dailyFull, closedTrades } = longFixture();
    const s1m = deriveHeroWindowStats({ dailyFull, range: '1M', closedTrades });
    expect(s1m.tradeCount).toBeLessThan(100);
    expect(s1m.closeDays).toBeLessThanOrEqual(s1m.tradeCount);
    const win = sliceSeriesWindow(dailyFull, '1M');
    const firstDay = win[0].date;
    const manual = closedTrades.filter((t) => t.do >= firstDay).length;
    expect(s1m.tradeCount).toBe(manual);
  });

  it('garde D6 : % de drawdown aberrant → null, le $ reste', () => {
    // Points fabriqués : base flow-neutral quasi nulle → −169.2 %.
    const win = [
      { date: iso(0), nlv: 130, flowNeutral: 130, drawdownUsd: 0, drawdownPct: 0 },
      { date: iso(1), nlv: -90, flowNeutral: -90, drawdownUsd: 220, drawdownPct: -169.2 },
      { date: iso(2), nlv: 40, flowNeutral: 40, drawdownUsd: 90, drawdownPct: -69.2 },
    ];
    const s = deriveHeroWindowStats({ dailyFull: win, range: 'ALL', closedTrades: [] });
    expect(s.maxDDUsd).toBe(220); // le montant reste
    expect(s.maxDDPct).toBe(null); // le % aberrant devient « — »
    expect(s.currentDDPct).toBe(-69.2); // un % sain passe
  });

  it('É3.1 — % J. GAGN. : jours avec clôture (signe du P&L net), verts+rouges = total = J. CLÔTURE', () => {
    const { dailyFull, closedTrades } = longFixture();
    const s = deriveHeroWindowStats({ dailyFull, range: 'ALL', closedTrades });
    const jg = s.joursGagnants;
    // Cohérence constitutionnelle du constat 15.08 : plus jamais
    // « 46↑/19↓ = 65 » à côté d'un « J. CLÔTURE 63 ».
    expect(jg.verts + jg.rouges).toBe(jg.total);
    expect(s.closeDays).toBe(jg.total);
    // Vérité recomptée depuis la fixture (net par jour, clé do||di).
    const byDay = new Map();
    for (const t of closedTrades) byDay.set(t.do, (byDay.get(t.do) || 0) + t.pnl);
    const verts = [...byDay.values()].filter((v) => v > 0).length;
    expect(jg.verts).toBe(verts);
    expect(jg.pct).toBeCloseTo((verts / byDay.size) * 100, 6);
  });

  it('fenêtre < 2 points → { empty: true }', () => {
    expect(deriveHeroWindowStats({ dailyFull: [], range: 'ALL' }).empty).toBe(true);
    const one = [{ date: iso(0), nlv: 100, flowNeutral: 100, drawdownUsd: 0, drawdownPct: 0 }];
    expect(deriveHeroWindowStats({ dailyFull: one, range: 'ALL' }).empty).toBe(true);
  });

  it('P&L de fenêtre = delta flow-neutral (un apport ne gagne rien)', () => {
    const win = [
      { date: iso(0), nlv: 10_000, flowNeutral: 10_000, drawdownUsd: 0, drawdownPct: 0 },
      { date: iso(1), nlv: 15_200, flowNeutral: 10_200, drawdownUsd: 0, drawdownPct: 0 }, // +5000 d'apport
    ];
    const s = deriveHeroWindowStats({ dailyFull: win, range: 'ALL', closedTrades: [] });
    expect(s.pnl).toBe(200); // pas 5 200
  });
});
