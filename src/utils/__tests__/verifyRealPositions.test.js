// Verification spec — exercises positionGreeks via the production import path
// (Vite resolver via vitest) with REAL strikes + quantities provided by user :
//   CVX K=165 qty=3 · MSFT K=520 qty=4 · AVGO K=250 qty=4 · XOM K=115 qty=3 · UNH K=570 qty=3
// Spots/marks/T from the original brief. r=0.04, q=0.
//
// This is the "real data" verification : output goes to stdout for visual
// inspection. The tests assert the targets the user quoted.

import { describe, it, expect } from 'vitest';
import { positionGreeks } from '../positionGreeks';

const R = 0.04;
const dayMs = 86_400_000;
const now = Date.parse('2026-05-28T12:00:00Z');
const exp85 = new Date(now + 85 * dayMs).toISOString().slice(0, 10);
const exp113 = new Date(now + 113 * dayMs).toISOString().slice(0, 10);

const positions = [
  { tk: 'MSFT', as: 'Option', ty: 'CALL', dir: 'Long', st: '520', ex: exp85,  pc: '2.11', ct: 4, mu: 100, spot: 426.25 },
  { tk: 'UNH',  as: 'Option', ty: 'CALL', dir: 'Long', st: '570', ex: exp85,  pc: '2.30', ct: 3, mu: 100, spot: 383.70 },
  { tk: 'CVX',  as: 'Option', ty: 'CALL', dir: 'Long', st: '165', ex: exp113, pc: '3.38', ct: 3, mu: 100, spot: 183.07 },
  { tk: 'AVGO', as: 'Option', ty: 'CALL', dir: 'Long', st: '250', ex: exp113, pc: '2.76', ct: 4, mu: 100, spot: 427.45 },
  { tk: 'XOM',  as: 'Option', ty: 'CALL', dir: 'Long', st: '115', ex: exp113, pc: '2.33', ct: 3, mu: 100, spot: 147.55 },
];

describe('REAL POSITIONS — production positionGreeks cascade', () => {
  it('produces the user-quoted aggregates with real strikes + quantities', () => {
    console.log('\n  REAL DATA — cascade σ (a)→(b)→(c), r=0.04, q=0\n');
    console.log('  Tk     K     Qty  Source    σ        Δ/sh    Δpos     Γpos       θpos/j   νpos/1%');
    console.log('  ────  ────  ───  ────────  ──────  ──────  ───────  ─────────  ────────  ────────');

    let sD = 0, sG = 0, sT = 0, sV = 0;
    const rows = [];
    for (const p of positions) {
      const g = positionGreeks(p, { spot: p.spot, r: R, now });
      expect(g).not.toBeNull();
      const sign = p.dir === 'Short' ? -1 : 1;
      const dPos = g.delta * p.ct * p.mu * sign;
      const gPos = g.gamma * p.ct * p.mu * sign;
      const tPos = (g.theta / 365) * p.ct * p.mu * sign;
      const vPos = (g.vega / 100) * p.ct * p.mu * sign;
      sD += dPos; sG += gPos; sT += tPos; sV += vPos;
      rows.push({ tk: p.tk, source: g.source, sigma: g.sigma, dSh: g.delta, dPos, gPos, tPos, vPos });

      const tag = p.tk.padEnd(4);
      const K = p.st.padStart(4);
      const Q = String(p.ct).padStart(3);
      const src = g.source.padEnd(8);
      const sig = (g.sigma * 100).toFixed(2).padStart(5) + '%';
      const dsh = g.delta.toFixed(3).padStart(6);
      const dp = dPos.toFixed(2).padStart(7);
      const gp = gPos.toFixed(4).padStart(8);
      const tp = tPos.toFixed(2).padStart(8);
      const vp = vPos.toFixed(2).padStart(8);
      console.log(`  ${tag}  ${K}  ${Q}  ${src}  ${sig}  ${dsh}  ${dp}  ${gp}   ${tp}  ${vp}`);
    }

    console.log('  ────  ────  ───  ────────  ──────  ──────  ───────  ─────────  ────────  ────────');
    console.log(`  Σ                                          ${sD.toFixed(2).padStart(7)}  ${sG.toFixed(4).padStart(8)}   ${sT.toFixed(2).padStart(8)}  ${sV.toFixed(2).padStart(8)}`);
    console.log(`\n  Targets : Σ Δ ≈ 973 · Σ θ ≈ -77/j · Σ ν ≈ 315/1%`);
    console.log(`  Got     : Σ Δ = ${sD.toFixed(1)} · Σ θ = ${sT.toFixed(2)}/j · Σ ν = ${sV.toFixed(2)}/1%\n`);

    // Per-position assertions (user-quoted targets, generous tolerance for floating math)
    const byTk = Object.fromEntries(rows.map((r) => [r.tk, r]));
    expect(byTk.MSFT.dPos).toBeCloseTo(34.3, 0); // ±0.5
    expect(byTk.UNH.dPos).toBeCloseTo(19.2, 0);
    expect(byTk.CVX.dPos).toBeCloseTo(235, -1); // ±5
    expect(byTk.AVGO.dPos).toBeCloseTo(400, -1);
    expect(byTk.XOM.dPos).toBeCloseTo(285, -1);

    expect(sD).toBeCloseTo(973, -1); // Σ Δ ±5
    expect(sT).toBeCloseTo(-77, -1); // Σ θ ±5
    expect(sV).toBeCloseTo(315, -1); // Σ ν ±5

    // Sources : MSFT/UNH inverted from mark, CVX/AVGO/XOM fallback default σ=0.30
    expect(byTk.MSFT.source).toBe('mark');
    expect(byTk.UNH.source).toBe('mark');
    expect(byTk.CVX.source).toBe('default');
    expect(byTk.AVGO.source).toBe('default');
    expect(byTk.XOM.source).toBe('default');
  });
});
