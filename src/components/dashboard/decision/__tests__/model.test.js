// ═══════════════════════════════════════════════════════════════
//  BANDE DÉCISION (1.F / Q-C) — tests du modèle PUR. La bande consomme
//  désormais le MOTEUR UNIQUE de portes (utils/gates) : plus de
//  generateAlerts. Rappel doctrine : Vitest vérifie la correctness du
//  code, la preuve de la feature reste visuelle (@1591).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { deriveAttention, SEV } from '../model';

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
