// ═══════════════════════════════════════════════════════════════
//  BANDE DÉCISION (1.F / Q-C) — tests du modèle PUR. La bande consomme
//  désormais le MOTEUR UNIQUE de portes (utils/gates) : plus de
//  generateAlerts. Rappel doctrine : Vitest vérifie la correctness du
//  code, la preuve de la feature reste visuelle (@1591).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { deriveAttention, deriveForme, deriveCapital, SEV } from '../model';

// Row de position enrichie (forme fournie par useSniperGates, Q-C).
const gateRow = (over = {}) => ({
  id: 'p1',
  ticker: 'AAPL',
  type: 'Call',
  dir: 'Long',
  strike: 150,
  dte: 120,
  daysHeld: 2,
  unrealPct: 5,
  earningsDate: null,
  picPct: null,
  isPartial: false,
  ...over,
});

describe('deriveAttention — moteur unique de portes (P1..P5)', () => {
  it('P1 exécution −38 % → ligne ROUGE (perte réelle), badge STOP', () => {
    const a = deriveAttention({ gateRows: [gateRow({ unrealPct: -38 })] });
    expect(a.lines).toHaveLength(1);
    expect(a.lines[0].severity).toBe('perte');
    expect(a.lines[0].metric).toContain('SL exéc −35 %');
    expect(a.lines[0].metric).toContain('−38 %');
  });

  it('P1 alerte −32 % → AMBRE (critique), métrique « ≤ alerte −30 % »', () => {
    const a = deriveAttention({ gateRows: [gateRow({ unrealPct: -32 })] });
    expect(a.lines[0].severity).toBe('critique');
    expect(a.lines[0].metric).toBe('P&L −32 % ≤ alerte −30 %');
  });

  it('P3 DTE ≤ 45 → CRITICAL « gate 45 » ; DTE > 50 → rien', () => {
    const g31 = deriveAttention({ gateRows: [gateRow({ dte: 31 })] });
    expect(g31.lines[0].severity).toBe('critique');
    expect(g31.lines[0].metric).toBe('DTE 31 j ≤ gate 45');
    const g60 = deriveAttention({ gateRows: [gateRow({ dte: 60 })], watchedCount: 1 });
    expect(g60.lines).toHaveLength(0);
    expect(g60.empty).toBe(true);
  });

  it('P3 approche : « DTE 46 → gate 45 » (armé)', () => {
    const a = deriveAttention({ gateRows: [gateRow({ dte: 46 })] });
    expect(a.lines[0].severity).toBe('arme');
    expect(a.lines[0].metric).toBe('DTE 46 j → gate 45');
  });

  it('kill switch déclenché → entrée dédiée, même sans ligne de position', () => {
    const a = deriveAttention({
      gateRows: [],
      kill: { triggered: true, dailyPnlUsd: -612, maxLoss: -500 },
    });
    expect(a.kill).toEqual({ dailyPnlUsd: -612, maxLoss: -500 });
    expect(a.empty).toBe(false);
    expect(a.lines).toHaveLength(0);
  });

  it('aucune porte (position saine) → état vide + compteur surveillé', () => {
    const a = deriveAttention({ gateRows: [gateRow()], watchedCount: 4 });
    expect(a.empty).toBe(true);
    expect(a.watchedCount).toBe(4);
  });
});

describe('deriveAttention — dédup, tri, débordement', () => {
  it('une seule ligne par position : la porte la plus urgente gagne (P1 perte > DTE)', () => {
    const a = deriveAttention({ gateRows: [gateRow({ dte: 40, unrealPct: -41 })] });
    expect(a.lines).toHaveLength(1);
    expect(a.lines[0].severity).toBe('perte');
    expect(a.lines[0].metric).toBe('P&L −41 % ≤ SL exéc −35 %');
    expect(a.lines[0].others).toBeGreaterThan(0); // le sujet DTE compte en « +N »
    expect(a.lines[0].otherMetrics.length).toBe(a.lines[0].others);
  });

  it('tri : perte/critique avant armé ; à sévérité égale, proximité du seuil', () => {
    const a = deriveAttention({
      gateRows: [
        gateRow({ id: 'p1', ticker: 'A', dte: 49 }),
        gateRow({ id: 'p2', ticker: 'B', unrealPct: -36 }),
        gateRow({ id: 'p3', ticker: 'C', dte: 46 }),
      ],
    });
    // B = P1 perte (le plus urgent) ; C = DTE46 (approche 80 %) ; A = DTE49 (20 %).
    expect(a.lines.map((l) => l.ticker)).toEqual(['B', 'C', 'A']);
  });

  it('débordement : maxLines affichées + compteur « +N »', () => {
    const gateRows = Array.from({ length: 8 }, (_, i) =>
      gateRow({ id: `p${i}`, ticker: `T${i}`, dte: 10 + i })
    );
    const a = deriveAttention({ gateRows, maxLines: 5 });
    expect(a.shown).toHaveLength(5);
    expect(a.moreCount).toBe(3);
  });

  it('SEV : perte > critique > armé', () => {
    expect(SEV.PERTE).toBeGreaterThan(SEV.CRITIQUE);
    expect(SEV.CRITIQUE).toBeGreaterThan(SEV.ARME);
  });
});

describe('deriveForme — cohérence Héros 2', () => {
  const trades = (n, sign = 1) =>
    Array.from({ length: n }, (_, i) => ({
      pnl: sign * (i + 1) * 10,
      date: `2026-07-${String(i + 1).padStart(2, '0')}`,
      tk: 'AAPL',
    }));

  it('pastilles : 18 max, chronologie conservée, tones win/loss/flat', () => {
    const perTrade = [...trades(20), { pnl: -5, date: '2026-07-25', tk: 'TSLA' }, { pnl: 0, date: '2026-07-26', tk: 'NVDA' }];
    const f = deriveForme({ perTrade, matrix: { n: 22, wins: 20, losses: 1, expectancy: 12 } });
    expect(f.dots).toHaveLength(18);
    expect(f.dots[f.dots.length - 1].tone).toBe('flat');
    expect(f.dots[f.dots.length - 2].tone).toBe('loss');
    expect(f.total).toBe(22);
  });

  it('streak : positif → V, négatif → D, 0 → null', () => {
    expect(deriveForme({ currentStreak: 3 }).streak).toEqual({ count: 3, kind: 'V' });
    expect(deriveForme({ currentStreak: -2 }).streak).toEqual({ count: 2, kind: 'D' });
    expect(deriveForme({ currentStreak: 0 }).streak).toBeNull();
  });

  it('expectancy : « — » (null) sous 10 trades décisifs, valeur Héros 2 sinon', () => {
    const under = deriveForme({ matrix: { n: 9, wins: 5, losses: 4, expectancy: 42 } });
    expect(under.expectancy).toBeNull();
    expect(under.decisive).toBe(9);
    const over = deriveForme({ matrix: { n: 12, wins: 7, losses: 5, expectancy: 42 } });
    expect(over.expectancy).toBe(42);
  });

  it('breakeven ne comptent pas comme décisifs', () => {
    const f = deriveForme({ matrix: { n: 12, wins: 5, losses: 4, expectancy: 42 } });
    expect(f.decisive).toBe(9);
    expect(f.expectancy).toBeNull();
  });
});

describe('deriveCapital — miroir Héros 1 (CAP 70 % retiré en Q-C)', () => {
  const metrics = { netLiquidationValueUsd: 20000, totalExposure: 6800 };
  const greeks = { sumDelta: 142.4, notionalDelta: 4520, thetaDaily: -38.2 };

  it('déployé + % NLV, plus AUCUN cap (doctrine V1 morte contredisant S1)', () => {
    const c = deriveCapital({ metrics, greeks, tier: { notionalMaxPct: 70, label: 'A · E0×C1' } });
    expect(c.deployed).toBe(6800);
    expect(c.deployedPct).toBeCloseTo(34);
    expect(c.capPct).toBeUndefined();
    expect(c.tierLabel).toBe('A · E0×C1');
  });

  it('disponible : réel IBKR seulement si availableIsReal ET valeur présente', () => {
    const real = deriveCapital({ metrics, greeks, availableUsd: 12000, availableIsReal: true, tier: null });
    expect(real.availableIsReal).toBe(true);
    expect(real.availablePct).toBeCloseTo(60);
    const est = deriveCapital({ metrics, greeks, availableUsd: 12000, availableIsReal: false, tier: null });
    expect(est.availableIsReal).toBe(false);
    const none = deriveCapital({ metrics, greeks, availableUsd: null, availableIsReal: true, tier: null });
    expect(none.availableIsReal).toBe(false);
  });

  it('risk $ + greeks neutres transmis tels quels', () => {
    const c = deriveCapital({ metrics, greeks, riskDollar: 1190, tier: null });
    expect(c.riskDollar).toBe(1190);
    expect(c.riskPct).toBeCloseTo(5.95);
    expect(c.deltaShares).toBeCloseTo(142.4);
    expect(c.thetaDay).toBeCloseTo(-38.2);
  });

  it('NLV absent → aucun % fabriqué', () => {
    const c = deriveCapital({ metrics: { totalExposure: 500 }, greeks: {}, riskDollar: 100, tier: null });
    expect(c.deployedPct).toBeNull();
    expect(c.riskPct).toBeNull();
  });
});
