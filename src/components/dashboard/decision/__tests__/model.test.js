// ═══════════════════════════════════════════════════════════════
//  BANDE DÉCISION (1.F) — tests du modèle PUR (tri d'urgence, dédup
//  par sujet, matrice de non-perte AlertsFeed, dérivations FORME et
//  CAPITAL). Rappel doctrine : Vitest vérifie la correctness du code,
//  la preuve de la feature reste visuelle (@1591).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { deriveAttention, deriveForme, deriveCapital, SEV } from '../model';

const alert = (over = {}) => ({
  positionId: 'p1',
  ticker: 'AAPL',
  type: 'STOP_LOSS',
  severity: 'red',
  message: '',
  value: -38,
  ...over,
});

const gateRow = (over = {}) => ({
  id: 'p1',
  ticker: 'AAPL',
  type: 'Call',
  dir: 'Long',
  strike: 150,
  dte: 120,
  daysIn: 2,
  unrealPct: 5,
  gates: [],
  ...over,
});

describe('deriveAttention — matrice de non-perte (chaque signal AlertsFeed a une maison)', () => {
  it('STOP_LOSS (red) → ligne CRITIQUE avec métrique P&L/SL', () => {
    const a = deriveAttention({ alerts: [alert()], gateRows: [gateRow({ unrealPct: -38 })] });
    expect(a.lines).toHaveLength(1);
    expect(a.lines[0].severity).toBe('critique');
    expect(a.lines[0].metric).toContain('SL −35 %');
    expect(a.lines[0].metric).toContain('−38 %');
  });

  it('TIME_STOP (red) → ligne CRITIQUE « j sans +15 % »', () => {
    const a = deriveAttention({
      alerts: [alert({ type: 'TIME_STOP', value: 8 })],
      gateRows: [gateRow()],
    });
    expect(a.lines[0].severity).toBe('critique');
    expect(a.lines[0].metric).toBe('8 j sans +15 %');
  });

  it('DTE_CRITICAL (red) → CRITIQUE ; DTE_WARNING (orange) → ARMÉ', () => {
    const crit = deriveAttention({ alerts: [alert({ type: 'DTE_CRITICAL', value: 82 })], gateRows: [] });
    expect(crit.lines[0].severity).toBe('critique');
    expect(crit.lines[0].metric).toBe('DTE 82 j ≤ 90 j');
    const warn = deriveAttention({ alerts: [alert({ type: 'DTE_WARNING', value: 95 })], gateRows: [] });
    expect(warn.lines[0].severity).toBe('arme');
    expect(warn.lines[0].metric).toBe('DTE 95 j → seuil 90 j');
  });

  it('TP1 / TP2 (orange) → lignes ARMÉ avec seuils 40 / 80', () => {
    const tp1 = deriveAttention({ alerts: [alert({ type: 'TP1_REACHED', value: 46 })], gateRows: [] });
    expect(tp1.lines[0].severity).toBe('arme');
    expect(tp1.lines[0].metric).toBe('+46 % ≥ TP 40 %');
    const tp2 = deriveAttention({ alerts: [alert({ type: 'TP2_REACHED', value: 85 })], gateRows: [] });
    expect(tp2.lines[0].metric).toBe('+85 % ≥ TP 80 %');
  });

  it('kill switch déclenché → entrée dédiée, même sans ligne de position', () => {
    const a = deriveAttention({
      alerts: [],
      gateRows: [],
      kill: { triggered: true, dailyPnlUsd: -612, maxLoss: -500 },
    });
    expect(a.kill).toEqual({ dailyPnlUsd: -612, maxLoss: -500 });
    expect(a.empty).toBe(false);
    expect(a.lines).toHaveLength(0);
  });
});

describe('deriveAttention — gates Sniper câblés (SL35 / DTE45 / TP short)', () => {
  it('DTE ≤ 35 → CRITIQUE gate 35 ; 35 < DTE ≤ 45 → ARMÉ gate 45', () => {
    const g35 = deriveAttention({ alerts: [], gateRows: [gateRow({ dte: 31 })] });
    expect(g35.lines[0].severity).toBe('critique');
    expect(g35.lines[0].metric).toBe('DTE 31 j ≤ gate 35');
    const g45 = deriveAttention({ alerts: [], gateRows: [gateRow({ dte: 42 })] });
    expect(g45.lines[0].severity).toBe('arme');
    expect(g45.lines[0].metric).toBe('DTE 42 j ≤ gate 45');
  });

  it('fenêtre d’approche : « DTE 46 → gate 45 » (exemple architecte)', () => {
    const a = deriveAttention({ alerts: [], gateRows: [gateRow({ dte: 46 })] });
    expect(a.lines[0].severity).toBe('arme');
    expect(a.lines[0].metric).toBe('DTE 46 j → gate 45');
  });

  it('proximité SL (convention 70 %) : « P&L −32 % / SL −35 % »', () => {
    const a = deriveAttention({ alerts: [], gateRows: [gateRow({ unrealPct: -32 })] });
    expect(a.lines[0].severity).toBe('arme');
    expect(a.lines[0].metric).toBe('P&L −32 % / SL −35 %');
  });

  it('TP sniper : short ≥ 50 % listé ; long jamais (gate non servi)', () => {
    const short = deriveAttention({ alerts: [], gateRows: [gateRow({ dir: 'Short', unrealPct: 52 })] });
    expect(short.lines[0].metric).toBe('+52 % ≥ TP 50 %');
    const long = deriveAttention({ alerts: [], gateRows: [gateRow({ dir: 'Long', unrealPct: 52 })] });
    expect(long.lines).toHaveLength(0);
  });
});

describe('deriveAttention — dédup, tri, débordement, état vide', () => {
  it('une seule ligne par position : le signal le plus urgent gagne', () => {
    const a = deriveAttention({
      alerts: [
        alert({ type: 'DTE_CRITICAL', value: 40 }),
        alert({ type: 'STOP_LOSS', value: -41 }),
      ],
      gateRows: [gateRow({ dte: 40, unrealPct: -41 })],
    });
    expect(a.lines).toHaveLength(1);
    // DTE_CRITICAL fill = 100+(90−40)=150 > STOP_LOSS fill = 100+6 → DTE gagne.
    expect(a.lines[0].metric).toBe('DTE 40 j ≤ 90 j');
    expect(a.lines[0].others).toBeGreaterThan(0);
  });

  it('tri : critique avant armé ; à sévérité égale, proximité du seuil', () => {
    const a = deriveAttention({
      alerts: [
        alert({ positionId: 'p1', ticker: 'A', type: 'DTE_WARNING', value: 99 }),
        alert({ positionId: 'p2', ticker: 'B', type: 'STOP_LOSS', value: -36 }),
        alert({ positionId: 'p3', ticker: 'C', type: 'DTE_WARNING', value: 91 }),
      ],
      gateRows: [],
    });
    expect(a.lines.map((l) => l.ticker)).toEqual(['B', 'C', 'A']);
  });

  it('débordement : maxLines affichées + compteur « +N »', () => {
    const alerts = Array.from({ length: 8 }, (_, i) =>
      alert({ positionId: `p${i}`, ticker: `T${i}`, type: 'DTE_CRITICAL', value: 80 - i })
    );
    const a = deriveAttention({ alerts, gateRows: [], maxLines: 5 });
    expect(a.shown).toHaveLength(5);
    expect(a.moreCount).toBe(3);
  });

  it('état vide designé : empty + compteur de positions surveillées', () => {
    const a = deriveAttention({ alerts: [], gateRows: [], watchedCount: 4 });
    expect(a.empty).toBe(true);
    expect(a.watchedCount).toBe(4);
  });

  it('SEV exporte critique > armé', () => {
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

describe('deriveCapital — miroir Héros 1', () => {
  const metrics = { netLiquidationValueUsd: 20000, totalExposure: 6800 };
  const greeks = { sumDelta: 142.4, notionalDelta: 4520, thetaDaily: -38.2 };

  it('déployé + % NLV + cap tier', () => {
    const c = deriveCapital({ metrics, greeks, tier: { notionalMaxPct: 70, label: 'A · E0×C1' } });
    expect(c.deployed).toBe(6800);
    expect(c.deployedPct).toBeCloseTo(34);
    expect(c.capPct).toBe(70);
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
