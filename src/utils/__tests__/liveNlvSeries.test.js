// ═══════════════════════════════════════════════════════════════
//  Héros 1 LIVE (Phase B, brique 1) — courbe bridge : verrous.
//    · fenêtre de séance STRICTE (les lignes d'hier sont exclues) ;
//    · conversion PAR POINT, jointure as-of (taux ≤ T, JAMAIS > T) ;
//    · fx_rates vide → série brute CHF étiquetée, jamais convertie ;
//    · trous VISIBLES (whitespace), jamais interpolés ;
//    · LOI D'UNE SEULE SOURCE : une série mixte bridge + est. ne peut
//      pas être construite (selectHeroSeries retourne l'UNE des deux
//      entrées, par référence).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  asOfRate,
  convertBridgeRows,
  injectHoles,
  buildBridgeSeries,
  selectHeroSeries,
  BRIDGE_HOLE_MS,
} from '../liveNlvSeries';

// Séance de référence : 21.08.2026, fenêtre [10:00Z, 00:00Z+1] (≈ 04:00 →
// 20:00 NY en EDT). Les tests passent la fenêtre en clair — pas d'horloge.
const WIN_START = Date.parse('2026-08-21T08:00:00Z');
const WIN_END = Date.parse('2026-08-22T00:00:00Z');
const T0 = Date.parse('2026-08-21T13:30:00Z');

const chfRow = (tMs, nlv) => ({ t: tMs, nlv, currency: 'CHF' });
const fxRow = (tMs, mid) => ({ t: tMs, mid });

describe('asOfRate — jointure as-of (jamais de lookahead)', () => {
  const fx = [fxRow(1000, 0.8), fxRow(2000, 0.81), fxRow(3000, 0.82)];
  it('un point à T prend le dernier taux ≤ T', () => {
    expect(asOfRate(fx, 2000)).toBe(0.81); // exactement à T → ce taux
    expect(asOfRate(fx, 2500)).toBe(0.81); // entre deux → le précédent
    expect(asOfRate(fx, 9999)).toBe(0.82);
  });
  it('JAMAIS le taux suivant : avant le premier taux → null', () => {
    expect(asOfRate(fx, 999)).toBeNull();
  });
});

describe('convertBridgeRows — conversion PAR POINT', () => {
  it('chaque point prend SON taux as-of (jamais un taux unique)', () => {
    const rows = [chfRow(T0, 81), chfRow(T0 + 60_000, 82)];
    const fx = [fxRow(T0 - 10_000, 0.81), fxRow(T0 + 30_000, 0.82)];
    const { points, currency } = convertBridgeRows({ rows, fxRows: fx });
    expect(currency).toBe('USD');
    expect(points[0].value).toBeCloseTo(81 / 0.81, 10); // taux du cycle précédent
    expect(points[1].value).toBeCloseTo(82 / 0.82, 10); // le sien, pas celui du voisin
  });
  it('fx_rates vide → série BRUTE CHF étiquetée, zéro conversion', () => {
    const rows = [chfRow(T0, 81), chfRow(T0 + 60_000, 82)];
    const { points, currency } = convertBridgeRows({ rows, fxRows: [] });
    expect(currency).toBe('CHF');
    expect(points.map((p) => p.value)).toEqual([81, 82]);
  });
  it('un point antérieur au tout premier taux est ÉCARTÉ (pas de lookahead)', () => {
    const rows = [chfRow(T0 - 60_000, 80), chfRow(T0, 81)];
    const fx = [fxRow(T0 - 10_000, 0.81)];
    const { points, droppedNoRate } = convertBridgeRows({ rows, fxRows: fx });
    expect(points).toHaveLength(1);
    expect(droppedNoRate).toBe(1);
  });
  it('lignes USD → recopiées telles quelles', () => {
    const { points, currency } = convertBridgeRows({
      rows: [{ t: T0, nlv: 100, currency: 'USD' }],
      fxRows: [],
    });
    expect(currency).toBe('USD');
    expect(points[0].value).toBe(100);
  });
});

describe('buildBridgeSeries — fenêtre de séance stricte', () => {
  const fx = [fxRow(WIN_START - 3_600_000, 0.81)]; // ancre pré-séance (as-of OK)
  it("les lignes d'HIER ne construisent jamais la courbe d'aujourd'hui", () => {
    const yesterday = Date.parse('2026-08-20T15:00:00Z');
    const rows = [chfRow(yesterday, 79), chfRow(T0, 81), chfRow(T0 + 21_000, 81.2)];
    const { series } = buildBridgeSeries({
      rows, fxRows: fx, dailySeries: [], windowStartMs: WIN_START, windowEndMs: WIN_END,
    });
    const values = series.filter((p) => p.nlv != null);
    expect(values).toHaveLength(2);
    // 79 CHF (hier) absent — même converti, il n'a aucun droit d'entrée.
    expect(values.every((p) => p.nlv > 90)).toBe(true); // 81/0.81 = 100
  });
  it('série vide si aucune ligne dans la fenêtre', () => {
    const { series } = buildBridgeSeries({
      rows: [chfRow(Date.parse('2026-08-20T15:00:00Z'), 79)],
      fxRows: fx, dailySeries: [], windowStartMs: WIN_START, windowEndMs: WIN_END,
    });
    expect(series).toHaveLength(0);
  });
});

describe('injectHoles — trous visibles, jamais interpolés', () => {
  const pt = (tSec, nlv) => ({ t: tSec, nlv, underwater: 0, date: 'x' });
  it(`un intervalle > ${BRIDGE_HOLE_MS / 1000} s se peuple de whitespace (nlv null) au pas de 60 s`, () => {
    const a = pt(1000, 100);
    const b = pt(1000 + 300, 101); // gap 5 min
    const out = injectHoles([a, b]);
    const gaps = out.filter((p) => p.nlv == null);
    // Pas de 60 s sur ]1000, 1300[ → 1060..1240 = 4 points whitespace
    // (largeur PROPORTIONNELLE : l'axe lightweight-charts est indexé barre).
    expect(gaps).toHaveLength(4);
    expect(gaps.every((p) => p.underwater == null && p.gap === true)).toBe(true);
    expect(gaps.every((p) => p.t > a.t && p.t < b.t)).toBe(true);
    // Ordre strictement croissant conservé (exigence lightweight-charts).
    for (let i = 1; i < out.length; i += 1) expect(out[i].t).toBeGreaterThan(out[i - 1].t);
    // Les deux points réels restent intacts aux extrémités.
    expect(out[0]).toBe(a);
    expect(out[out.length - 1]).toBe(b);
  });
  it('cadence pré/post (90 s) → AUCUN faux trou', () => {
    const out = injectHoles([pt(0, 100), pt(90, 100.5), pt(180, 101)]);
    expect(out).toHaveLength(3);
    expect(out.every((p) => p.nlv != null)).toBe(true);
  });
});

describe('selectHeroSeries — LOI D’UNE SEULE SOURCE (couture interdite)', () => {
  const bridge = [{ t: 1, nlv: 100 }, { t: 2, nlv: null, gap: true }, { t: 3, nlv: 101 }];
  const client = [{ date: '2026-08-20', nlv: 90 }, { date: '2026-08-21', nlv: 91 }];
  it('≥ 1 point bridge → la série bridge, ENTIÈRE, par référence', () => {
    const { source, series } = selectHeroSeries({ bridgeSeries: bridge, clientSeries: client });
    expect(source).toBe('bridge');
    expect(series).toBe(bridge); // la MÊME référence : rien d'ajouté, rien de cousu
  });
  it('zéro point bridge réel (whitespace seuls) → série client', () => {
    const onlyGaps = [{ t: 1, nlv: null, gap: true }];
    const { source, series } = selectHeroSeries({ bridgeSeries: onlyGaps, clientSeries: client });
    expect(source).toBe('est');
    expect(series).toBe(client);
  });
  it('une série mixte bridge + est. NE PEUT PAS être construite', () => {
    const { series } = selectHeroSeries({ bridgeSeries: bridge, clientSeries: client });
    // Chaque point de la sortie appartient à l'entrée bridge — aucun point
    // client ne peut s'y glisser, la sortie EST l'une des deux entrées.
    expect(series.every((p) => bridge.includes(p))).toBe(true);
    expect(client.some((p) => series.includes(p))).toBe(false);
  });
});
